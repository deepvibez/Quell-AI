const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const db = require('../db');
const router = express.Router();


router.get('/debug', (req, res) => {
  res.json({
    BACKEND_URL: process.env.BACKEND_URL,
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SCOPES: process.env.SHOPIFY_API_SCOPES,
    redirect_uri: `${process.env.BACKEND_URL}/api/shopify/callback`
  });
});


router.get('/install', (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.status(400).json({ 
      error: 'Missing shop parameter',
      usage: 'GET /api/shopify/install?shop=your-store.myshopify.com'
    });
  }

  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  if (!shopRegex.test(shop)) {
    return res.status(400).json({ 
      error: 'Invalid shop domain format',
      expected: 'your-store.myshopify.com' 
    });
  }

  const scopes = process.env.SHOPIFY_API_SCOPES;
  const redirectUri = `${process.env.BACKEND_URL}/api/shopify/callback`;
  const clientId = process.env.SHOPIFY_API_KEY;
  
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  console.log('🚀 Starting OAuth Flow');
  console.log('📍 Shop:', shop);
  console.log('🔗 Redirect URI:', redirectUri);
  
  res.redirect(installUrl);
});


/**
 * Shopify OAuth callback endpoint
 * Called when seller installs the app
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, shop, hmac, timestamp } = req.query;
    
    console.log('');
    console.log('========================================');
    console.log('🔔 OAUTH CALLBACK RECEIVED');
    console.log('========================================');
    console.log('📋 Query Parameters:');
    console.log('   Shop:', shop);
    console.log('   Code:', code ? `${code.substring(0, 20)}...` : 'MISSING');
    console.log('   HMAC:', hmac ? 'Present' : 'Missing');
    console.log('   Timestamp:', timestamp);
    console.log('----------------------------------------');
    
    // Validate required parameters
    if (!code || !shop) {
      console.error('❌ VALIDATION FAILED: Missing code or shop parameter');
      console.log('Full query params:', req.query);
      return res.status(400).send('Missing required parameters');
    }
    
    // Exchange authorization code for access token
    console.log('🔄 Exchanging code for access token...');
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code
      })
    });
    
    const tokenData = await tokenResponse.json();
    const access_token = tokenData.access_token;
    
    if (!access_token) {
      console.error('❌ Failed to get access token from Shopify');
      console.error('Response:', tokenData);
      throw new Error('Failed to get access token from Shopify');
    }
    
    const storeId = shop.split('.')[0];
    console.log(`✅ Access token received successfully`);
    console.log('   Token length:', access_token.length);
    console.log('   Store ID:', storeId);
    console.log('----------------------------------------');
    
    // Check if store already exists (reinstall scenario)
    console.log('🔍 Checking for existing store in database...');
    console.log('   Query: SELECT id, user_id FROM stores WHERE shop_domain = ?');
    console.log('   Shop domain:', shop);
    
    const [existingStores] = await db.query(
      'SELECT id, user_id FROM stores WHERE shop_domain = ?',
      [shop]
    );
    
    console.log('📊 Database query result:');
    console.log('   Rows found:', existingStores.length);
    if (existingStores.length > 0) {
      console.log('   Store data:', JSON.stringify(existingStores, null, 2));
    } else {
      console.log('   No existing stores found');
    }
    console.log('----------------------------------------');
    
    if (existingStores.length > 0) {
      console.log('🔄 REINSTALL PATH TRIGGERED');
      console.log('   Store ID:', existingStores[0].id);
      console.log('   User ID:', existingStores[0].user_id || 'NULL');
      
      // Store already connected - update token and status
      console.log('💾 Updating store with new access token...');
      await db.query(
        'UPDATE stores SET access_token = ?, installed_at = NOW(), status = ? WHERE shop_domain = ?',
        [access_token, 'active', shop]
      );
      console.log('✅ Store updated successfully');
      
      const redirectUrl = `${process.env.FRONTEND_URL}/login?shop=${shop}&message=reinstalled`;
      console.log('');
      console.log('➡️  REDIRECTING TO LOGIN');
      console.log('   URL:', redirectUrl);
      console.log('   FRONTEND_URL:', process.env.FRONTEND_URL);
      console.log('========================================');
      console.log('');
      
      return res.redirect(redirectUrl);
    }
    
    // New installation - create temporary registration token
    console.log('🆕 NEW INSTALLATION PATH TRIGGERED');
    const tempToken = crypto.randomBytes(32).toString('hex');
    console.log('   Generated temp token:', tempToken.substring(0, 16) + '...');
    
    // Save to pending_stores table (expires in 1 hour)
    console.log('💾 Saving to pending_stores table...');
    await db.query(
      `INSERT INTO pending_stores (shop_domain, access_token, store_id, temp_token, expires_at) 
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))
       ON DUPLICATE KEY UPDATE access_token = ?, temp_token = ?, expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR)`,
      [shop, access_token, storeId, tempToken, access_token, tempToken]
    );
    console.log('✅ Saved to pending_stores successfully');
    
    const redirectUrl = `${process.env.FRONTEND_URL}/signup?shop=${shop}&token=${tempToken}`;
    console.log('');
    console.log('➡️  REDIRECTING TO SIGNUP');
    console.log('   URL:', redirectUrl);
    console.log('   FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('   Shop param:', shop);
    console.log('   Token param:', tempToken.substring(0, 16) + '...');
    console.log('========================================');
    console.log('');

    res.redirect(redirectUrl);
    
  } catch (error) {
    console.log('');
    console.log('========================================');
    console.error('❌ CALLBACK ERROR');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    console.log('========================================');
    console.log('');
    
    res.redirect(
      `${process.env.FRONTEND_URL}/error?message=installation_failed&details=${encodeURIComponent(error.message)}`
    );
  }
});


module.exports = router;

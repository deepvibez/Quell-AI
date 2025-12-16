const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/auth/signup
 * Register new user with Shopify store
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, shopToken } = req.body;
    
    // Validate input
    if (!email || !password || !name || !shopToken) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Email, password, name, and shop token are required' 
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password too short',
        message: 'Password must be at least 8 characters' 
      });
    }
    
    console.log(` Signup attempt for: ${email}`);
    
    // Get pending store from temp token
    const [pending] = await db.query(
      'SELECT * FROM pending_stores WHERE temp_token = ? AND expires_at > NOW()',
      [shopToken]
    );
    
    if (pending.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid or expired registration link',
        message: 'Please reinstall the app from Shopify' 
      });
    }
    
    const { shop_domain, access_token, store_id } = pending[0];
    
    // Check if email already exists
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        error: 'Email already registered',
        message: 'Please login or use a different email' 
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const [userResult] = await db.query(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [email, passwordHash, name]
    );
    
    const userId = userResult.insertId;
    
    // Link store to user
    await db.query(
      'INSERT INTO stores (user_id, shop_domain, access_token, store_id) VALUES (?, ?, ?, ?)',
      [userId, shop_domain, access_token, store_id]
    );
    
    // Delete pending store record
    await db.query('DELETE FROM pending_stores WHERE temp_token = ?', [shopToken]);
    
    console.log(`User ${email} created and store ${shop_domain} linked`);
    
    // Trigger n8n initial product sync
    try {
      const syncResponse = await fetch(`${process.env.N8N_WEBHOOK_URL}/initialsync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          shop: shop_domain,
          accessToken: access_token,
          storeId: store_id
        }),
        timeout: 5000
      });
      
      if (syncResponse.ok) {
        console.log(`Product sync triggered for ${shop_domain}`);
      } else {
        console.error(`  Product sync failed: ${syncResponse.statusText}`);
      }
    } catch (syncError) {
      console.error(' Product sync error:', syncError.message);
      // Don't fail signup if sync fails - it can be retried
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      token,
      user: { 
        id: userId, 
        email, 
        name 
      },
      store: { 
        shop: shop_domain, 
        storeId: store_id 
      }
    });
    
  } catch (error) {
    console.error(' Signup error:', error);
    res.status(500).json({ 
      error: 'Signup failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Missing credentials',
        message: 'Email and password are required' 
      });
    }
    
    console.log(`Login attempt for: ${email}`);
    
    // Find user
    const [users] = await db.query(
      'SELECT id, email, password_hash, name FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect' 
      });
    }
    
    const user = users[0];
    
    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect' 
      });
    }
    
    // Get user's stores
    const [stores] = await db.query(
      'SELECT shop_domain, store_id, product_count, status, last_sync_at, installed_at FROM stores WHERE user_id = ?',
      [user.id]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    console.log(`User ${email} logged in successfully`);
    
    res.json({
      success: true,
      token: token,
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name 
      },
      stores
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Get user details
    const [users] = await db.query(
      'SELECT id, email, name, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'Please login again' 
      });
    }
    
    // Get user's stores
    const [stores] = await db.query(
      'SELECT shop_domain, store_id, product_count, status, last_sync_at, installed_at FROM stores WHERE user_id = ?',
      [req.user.userId]
    );
    
    res.json({
      user: users[0],
      stores
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Failed to get user info',
      message: error.message 
    });
  }
});

module.exports = router;

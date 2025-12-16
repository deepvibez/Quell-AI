// routes/stores.js  (updated)
const express = require('express');
const fetch = require('node-fetch');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/stores
 * Get all stores for authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [stores] = await db.query(
      `SELECT id, shop_domain, store_id, widget_token, product_count, status, last_sync_at, installed_at
       FROM stores
       WHERE user_id = ?
       ORDER BY installed_at DESC`,
      [req.user.userId]
    );
    
    res.json({ 
      success: true,
      stores 
    });
    
  } catch (error) {
    console.error(' Get stores error:', error);
    res.status(500).json({ 
      error: 'Failed to get stores',
      message: error.message 
    });
  }
});

/**
 * POST /api/stores/:storeId/sync
 * Trigger manual product sync for a store
 */
router.post('/:storeId/sync', authenticateToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    
    console.log(`🔄 Manual sync requested for store: ${storeId}`);
    
    // Verify store belongs to user
    const [stores] = await db.query(
      'SELECT * FROM stores WHERE store_id = ? AND user_id = ?',
      [storeId, req.user.userId]
    );
    
    if (stores.length === 0) {
      return res.status(404).json({ 
        error: 'Store not found',
        message: 'Store does not exist or does not belong to you' 
      });
    }
    
    const store = stores[0];
    
    // Trigger n8n product sync
    const syncResponse = await fetch(`${process.env.N8N_WEBHOOK_URL}/initialsync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: req.user.userId,
        shop: store.shop_domain,
        accessToken: store.access_token,
        storeId: store.store_id,
        syncType: 'manual'
      }),
      timeout: 5000
    });
    
    if (!syncResponse.ok) {
      throw new Error(`Sync webhook returned ${syncResponse.status}`);
    }
    
    console.log(`Manual sync triggered for ${store.shop_domain}`);
    
    res.json({ 
      success: true, 
      message: 'Product sync started. This may take a few minutes.' 
    });
    
  } catch (error) {
    console.error(' Sync trigger error:', error);
    res.status(500).json({ 
      error: 'Failed to trigger sync',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/stores/:storeId
 * Disconnect/deactivate a store
 */
router.delete('/:storeId', authenticateToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    
    console.log(`🔌 Disconnect requested for store: ${storeId}`);
    
    // Update status instead of deleting (soft delete)
    const [result] = await db.query(
      'UPDATE stores SET status = ? WHERE store_id = ? AND user_id = ?',
      ['disconnected', storeId, req.user.userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Store not found',
        message: 'Store does not exist or does not belong to you' 
      });
    }
    
    console.log(`✅ Store ${storeId} disconnected`);
    
    res.json({ 
      success: true, 
      message: 'Store disconnected successfully' 
    });
    
  } catch (error) {
    console.error('❌ Disconnect error:', error);
    res.status(500).json({ 
      error: 'Failed to disconnect store',
      message: error.message 
    });
  }
});

/**
 * GET /api/stores/:storeId
 * Get details of a specific store
 */
router.get('/:storeId', authenticateToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    
    const [stores] = await db.query(
      `SELECT id, shop_domain, store_id, widget_token, product_count, status, last_sync_at, installed_at
       FROM stores
       WHERE store_id = ? AND user_id = ?`,
      [storeId, req.user.userId]
    );
    
    if (stores.length === 0) {
      return res.status(404).json({ 
        error: 'Store not found',
        message: 'Store does not exist or does not belong to you' 
      });
    }
    
    res.json({ 
      success: true,
      store: stores[0]
    });
    
  } catch (error) {
    console.error('❌ Get store error:', error);
    res.status(500).json({ 
      error: 'Failed to get store details',
      message: error.message 
    });
  }
});

module.exports = router;

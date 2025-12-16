// routes/customerTicketRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise pool

/**
 * Expected payload from chatbot (logged-in user):
 *
 * POST /api/customer-tickets
 * {
 *   store: "deep999-2.myshopify.com",
 *   customerId: "gid://shopify/Customer/...",
 *   name: "John Doe",
 *   email: "john@example.com",
 *   subject: "Issue with my order",
 *   description: "Details about the issue...",
 *   orderId: "1234",
 *   sessionId: "session-...",
 *   cartID: "shopify-cart-id"
 * }
 */

// ✅ CREATE ticket from chatbot
router.post('/customer-tickets', async (req, res) => {
  try {
    const {
      store,
      customerId,
      name,
      email,
      subject,
      description,
      orderId,
      sessionId,
      cartID,
    } = req.body || {};

    if (!store || !customerId || !subject || !description) {
      return res.status(400).json({
        error: 'store, customerId, subject and description are required',
      });
    }

    const insertSql = `
      INSERT INTO customer_tickets (
        store_url,
        customer_id,
        customer_name,
        customer_email,
        subject,
        description,
        order_id,
        status,
        channel,
        session_id,
        cart_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      store,
      customerId,
      name || null,
      email || null,
      subject,
      description,
      orderId || null,
      'open',               // default status
      'chatbot',            // channel
      sessionId || null,
      cartID || null,
    ];

    const [result] = await db.query(insertSql, params);

    const [rows] = await db.query(
      'SELECT * FROM customer_tickets WHERE id = ?',
      [result.insertId]
    );
    const newTicket = rows[0];

    // Optional: emit via Socket.IO to store room (so seller dashboard updates live)
    try {
      const io = req.app.get('io');
      if (io && newTicket) {
        io.to(`store_${store}`).emit('customer_ticket_created', newTicket);
      }
    } catch (e) {
      console.warn('Socket emit failed for customer_ticket_created:', e.message);
    }

    return res.status(201).json({ data: newTicket });
  } catch (err) {
    console.error('Error creating customer ticket:', err);
    return res.status(500).json({ error: 'Failed to create customer ticket' });
  }
});

// ✅ LIST tickets (for seller dashboard)
// GET /api/customer-tickets?store_url=&status=&customer_id=
router.get('/customer-tickets', async (req, res) => {
  const { store_url, status, customer_id } = req.query;

  try {
    let sql = 'SELECT * FROM customer_tickets WHERE 1=1';
    const params = [];

    if (store_url) {
      sql += ' AND store_url = ?';
      params.push(store_url);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (customer_id) {
      sql += ' AND customer_id = ?';
      params.push(customer_id);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sql, params);
    return res.json({ data: rows });
  } catch (err) {
    console.error('Error fetching customer tickets:', err);
    return res.status(500).json({ error: 'Failed to fetch customer tickets' });
  }
});

// ✅ SINGLE ticket
// GET /api/customer-tickets/:id
router.get('/customer-tickets/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT * FROM customer_tickets WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer ticket not found' });
    }

    return res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error fetching customer ticket:', err);
    return res.status(500).json({ error: 'Failed to fetch customer ticket' });
  }
});

// ✅ UPDATE ticket (status, priority, etc.)
// PATCH /api/customer-tickets/:id
router.patch('/customer-tickets/:id', async (req, res) => {
  const { id } = req.params;
  const {
    status,      // 'open' | 'pending' | 'resolved' | 'closed'
    priority,    // 'Low' | 'Medium' | 'High' | 'Urgent'
    subject,
    description,
  } = req.body || {};

  try {
    const fields = [];
    const params = [];

    if (status) {
      fields.push('status = ?');
      params.push(status);
    }
    if (priority) {
      fields.push('priority = ?');
      params.push(priority);
    }
    if (subject) {
      fields.push('subject = ?');
      params.push(subject);
    }
    if (description) {
      fields.push('description = ?');
      params.push(description);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `UPDATE customer_tickets SET ${fields.join(', ')} WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer ticket not found' });
    }

    const [rows] = await db.query(
      'SELECT * FROM customer_tickets WHERE id = ?',
      [id]
    );

    const updatedTicket = rows[0];

    // Optional: notify dashboard via Socket.IO
    try {
      const io = req.app.get('io');
      if (io && updatedTicket) {
        io.to(`store_${updatedTicket.store_url}`).emit(
          'customer_ticket_updated',
          updatedTicket
        );
      }
    } catch (e) {
      console.warn('Socket emit failed for customer_ticket_updated:', e.message);
    }

    return res.json({ data: updatedTicket });
  } catch (err) {
    console.error('Error updating customer ticket:', err);
    return res.status(500).json({ error: 'Failed to update customer ticket' });
  }
});

module.exports = router;

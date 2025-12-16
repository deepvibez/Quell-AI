// routes/ticketRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise pool

// GET /support/tickets?store_url=&status=
router.get('/tickets', async (req, res) => {
  const { store_url, status } = req.query;

  try {
    let sql = 'SELECT * FROM tickets WHERE 1=1';
    const params = [];

    if (store_url) {
      sql += ' AND store_url = ?';
      params.push(store_url);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sql, params);
    return res.json({ data: rows });
  } catch (err) {
    console.error('Error fetching tickets:', err);
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// ✅ GET /support/tickets/:id  (single ticket detail)
router.get('/tickets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM tickets WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    return res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error fetching ticket:', err);
    return res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// POST /support/tickets  (create new ticket)
router.post('/tickets', async (req, res) => {
  try {
    const {
      store_url,
      subject,
      issue_type,
      priority,
      channel,
      related_session_id,
      description,
      include_logs,
    } = req.body || {};

    if (!store_url || !subject || !description) {
      return res.status(400).json({
        error: 'store_url, subject and description are required',
      });
    }

    const insertSql = `
      INSERT INTO tickets (
        store_url,
        subject,
        issue_type,
        priority,
        status,
        channel,
        related_session_id,
        description,
        include_logs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      store_url,
      subject,
      issue_type || 'Other',
      priority || 'Medium',
      'open', // default status
      channel || 'Website widget',
      related_session_id || null,
      description,
      include_logs ? 1 : 0,
    ];

    const [result] = await db.query(insertSql, params);

    const [rows] = await db.query('SELECT * FROM tickets WHERE id = ?', [
      result.insertId,
    ]);
    const newTicket = rows[0];

    return res.status(201).json({ data: newTicket });
  } catch (err) {
    console.error('Error creating ticket:', err);
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// ✅ PATCH /support/tickets/:id  (update status/priority/etc)
router.patch('/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const {
    status,        // 'open' | 'pending' | 'closed'
    priority,      // 'Low' | 'Medium' | 'High' | 'Urgent'
    issue_type,    // optional update
    channel,       // optional
    subject,       // optional
    description,   // optional (e.g. internal update)
  } = req.body || {};

  try {
    // Build dynamic SET clause based on fields provided
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
    if (issue_type) {
      fields.push('issue_type = ?');
      params.push(issue_type);
    }
    if (channel) {
      fields.push('channel = ?');
      params.push(channel);
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

    // Always update timestamp
    fields.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // return updated row
    const [rows] = await db.query('SELECT * FROM tickets WHERE id = ?', [id]);
    return res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error updating ticket:', err);
    return res.status(500).json({ error: 'Failed to update ticket' });
  }
});

module.exports = router;

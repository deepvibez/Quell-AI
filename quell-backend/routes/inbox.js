// routes/inbox.js
const express = require("express");
const db = require("../db"); // mysql2/promise pool
const router = express.Router();

/* -----------------------------------------------------
   GET /api/inbox
   Return list of conversation sessions grouped by session_id
----------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const store_url = req.query.store_url;
    if (!store_url) return res.status(400).json({ error: "store_url is required" });

    const page = Math.max(1, parseInt(req.query.page || "1"));
    const perPage = Math.min(100, parseInt(req.query.per_page || "30"));
    const offset = (page - 1) * perPage;

    const channel = req.query.channel || null;
    const onlyUnread = req.query.only_unread === "true";
    const search = req.query.search ? req.query.search.trim() : null;

    const where = ["m.store_url = ?"];
    const params = [store_url];

    if (channel) {
      where.push("m.channel = ?");
      params.push(channel);
    }

    if (onlyUnread) {
      where.push("m.is_read = 0");
    }

    if (search) {
      where.push("(m.user_message LIKE ? OR m.bot_response LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Count distinct sessions
    const countSql = `
      SELECT COUNT(DISTINCT m.session_id) AS total
      FROM messages m
      ${whereSQL}
    `;
    const [countRows] = await db.execute(countSql, params);
    const total = countRows[0]?.total || 0;

    // Fetch grouped sessions
    // FIX 1: Added MAX(m.channel) to handle ONLY_FULL_GROUP_BY mode
    // FIX 2: Inject LIMIT/OFFSET directly into string to avoid ER_WRONG_ARGUMENTS
    const listSql = `
      SELECT 
        m.session_id,
        MAX(m.channel) AS channel,
        MAX(m.created_at) AS last_message_at,
        SUBSTRING_INDEX(
          GROUP_CONCAT(m.user_message ORDER BY m.created_at DESC SEPARATOR '||~||'),
          '||~||', 1
        ) AS last_user_message,
        SUBSTRING_INDEX(
          GROUP_CONCAT(m.bot_response ORDER BY m.created_at DESC SEPARATOR '||~||'),
          '||~||', 1
        ) AS last_bot_response,
        SUM(CASE WHEN m.is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
        MAX(m.user_name) AS user_name,
        MAX(m.user_email) AS user_email
      FROM messages m
      ${whereSQL}
      GROUP BY m.session_id
      ORDER BY (unread_count > 0) DESC, last_message_at DESC
      LIMIT ${Number(perPage)} OFFSET ${Number(offset)};
    `;

    // Only use the params array constructed above (store_url, channel, search), 
    // DO NOT append perPage/offset to it.
    const [rows] = await db.execute(listSql, params);

    res.json({ meta: { total, page, perPage }, data: rows });
  } catch (err) {
    console.error("Inbox list error:", err.message);
    console.error("SQL Error Code:", err.code);
    console.error("SQL State:", err.sqlState);
    res.status(500).json({ 
        error: "Internal server error", 
        details: err.message 
    });
  }
});

/* -----------------------------------------------------
   GET /api/inbox/:sessionId/messages
   Fetch full thread history for a session
----------------------------------------------------- */
router.get("/:sessionId/messages", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const store_url = req.query.store_url;

    if (!store_url) return res.status(400).json({ error: "store_url required" });

    const sql = `
      SELECT 
        id, session_id, channel, user_email, user_name, 
        user_message, bot_response, message_json, 
        is_read, created_at
      FROM messages
      WHERE store_url = ? AND session_id = ?
      ORDER BY created_at ASC;
    `;

    const [rows] = await db.execute(sql, [store_url, sessionId]);
    res.json({ sessionId, data: rows });
  } catch (err) {
    console.error("Thread fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* -----------------------------------------------------
   POST /api/inbox/:sessionId/mark-read
   Mark session as read
----------------------------------------------------- */
router.post("/:sessionId/mark-read", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { store_url } = req.body;

    if (!store_url) return res.status(400).json({ error: "store_url required" });

    // Mark all messages in this session as read
    const sql = `
      UPDATE messages 
      SET is_read = 1
      WHERE store_url = ? AND session_id = ?;
    `;
    await db.execute(sql, [store_url, sessionId]);

    // Emit real-time update so other dashboard tabs update unread counts
    const io = req.app.get("io");
    if (io) {
      io.to(`store_${store_url}`).emit("conversation:read", {
        session_id: sessionId,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Mark-read error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* -----------------------------------------------------
   POST /api/inbox/:sessionId/reply
   Allows the seller to send a message to the customer
----------------------------------------------------- */
router.post("/:sessionId/reply", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { store_url, message, channel, user_email } = req.body;

    if (!store_url || !message) {
      return res.status(400).json({ error: "store_url and message are required" });
    }

    // 1. Save the Seller's message to the DB
    const insertSql = `
      INSERT INTO messages 
      (store_url, session_id, channel, user_email, bot_response, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 1, NOW())
    `; 
    
    const [result] = await db.execute(insertSql, [
      store_url, 
      sessionId, 
      channel || 'website', 
      user_email || null, 
      message
    ]);

    const messageId = result.insertId;

    // 2. Emit event so the dashboard updates instantly (optimistic UI)
    const io = req.app.get("io");
    if (io) {
      io.to(`store_${store_url}`).emit("conversation:new_message", {
        id: messageId,
        session_id: sessionId,
        bot_response: message,
        created_at: new Date(),
        is_read: 1
      });
    }

    res.json({ success: true, messageId });

  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

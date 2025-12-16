// routes/adminAnalytics.js - COMPLETE FIXED VERSION

const express = require("express");
const router = express.Router();
const db = require("../db");

// Helper: safe numeric parse
function toInt(v, def = 0) {
  const n = parseInt(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * GET /admin/platform-overview
 * Platform-wide metrics aggregated across ALL stores
 */
router.get("/platform-overview", async (req, res) => {
  try {
    const { since } = req.query;
    const sinceClause = since ? "AND created_at >= ?" : "";
    const params = since ? [since] : [];

    // 1) Total stores and status distribution
    const storesSql = `
      SELECT 
        COUNT(*) as total_stores,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_stores,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_stores,
        SUM(CASE WHEN status = 'disconnected' THEN 1 ELSE 0 END) as disconnected_stores
      FROM stores
    `;
    const [storesRows] = await db.execute(storesSql);

    // 2) New signups (last 30 days)
    const signupsSql = `
      SELECT COUNT(*) as new_signups
      FROM stores
      WHERE installed_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `;
    const [signupsRows] = await db.execute(signupsSql);

    // 3) Platform-wide conversation metrics
    const conversationsSql = `
      SELECT 
        COUNT(DISTINCT session_id) as total_conversations,
        COUNT(*) as total_messages,
        COUNT(DISTINCT store_url) as stores_with_activity
      FROM messages
      WHERE 1=1 ${sinceClause}
    `;
    const [conversationsRows] = await db.execute(conversationsSql, params);

    // 4) Token usage aggregation - FIXED: using tokencount
    const tokensSql = `
      SELECT 
        SUM(total_tokens) as total_tokens,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        COUNT(DISTINCT store_url) as stores_using_tokens
      FROM tokencount
      WHERE 1=1 ${sinceClause}
    `;
    const [tokensRows] = await db.execute(tokensSql, params);

    // Calculate estimated cost (Google Gemini pricing example)
    const totalTokens = Number(tokensRows[0]?.total_tokens || 0);
    // Gemini 1.5 Flash pricing: ~$0.35 per 1M tokens (adjust based on your model)
    const estimatedCost = (totalTokens / 1000000) * 0.35;

    // 5) Support tickets aggregation
    const ticketsSql = `
      SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
        SUM(CASE WHEN priority = 'Urgent' THEN 1 ELSE 0 END) as urgent_tickets
      FROM tickets
      WHERE 1=1 ${sinceClause}
    `;
    const [ticketsRows] = await db.execute(ticketsSql, params);

    return res.json({
      stores: {
        total_stores: Number(storesRows[0]?.total_stores || 0),
        active_stores: Number(storesRows[0]?.active_stores || 0),
        suspended_stores: Number(storesRows[0]?.suspended_stores || 0),
        disconnected_stores: Number(storesRows[0]?.disconnected_stores || 0),
      },
      signups: {
        new_signups: Number(signupsRows[0]?.new_signups || 0),
      },
      conversations: {
        total_conversations: Number(conversationsRows[0]?.total_conversations || 0),
        total_messages: Number(conversationsRows[0]?.total_messages || 0),
        stores_with_activity: Number(conversationsRows[0]?.stores_with_activity || 0),
      },
      tokens: {
        total_tokens: totalTokens,
        total_input_tokens: Number(tokensRows[0]?.total_input_tokens || 0),
        total_output_tokens: Number(tokensRows[0]?.total_output_tokens || 0),
        stores_using_tokens: Number(tokensRows[0]?.stores_using_tokens || 0),
        estimated_cost: estimatedCost.toFixed(2),
      },
      tickets: {
        total_tickets: Number(ticketsRows[0]?.total_tickets || 0),
        open_tickets: Number(ticketsRows[0]?.open_tickets || 0),
        pending_tickets: Number(ticketsRows[0]?.pending_tickets || 0),
        urgent_tickets: Number(ticketsRows[0]?.urgent_tickets || 0),
      },
      meta: {
        since: since || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ Error in /admin/platform-overview:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /admin/top-stores
 * Top stores by activity - FIXED: LIMIT cannot be parameterized in MySQL
 */
router.get("/top-stores", async (req, res) => {
  try {
    const { since, limit = 10, sortBy = "conversations" } = req.query;
    const limitNum = Math.max(1, Math.min(parseInt(limit) || 10, 100)); // Sanitize: 1-100

    // Validate sortBy to prevent SQL injection
    const validSortColumns = ["conversations", "messages", "tokens_used"];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "conversations";

    let sql, params;

    if (since) {
      // With date filter
      sql = `
        SELECT 
          m.store_url,
          s.shop_domain,
          s.status as store_status,
          COUNT(DISTINCT m.session_id) as conversations,
          COUNT(*) as messages,
          COALESCE(SUM(tc.total_tokens), 0) as tokens_used
        FROM messages m
        LEFT JOIN stores s ON (m.store_url = s.shop_domain OR m.store_url = s.store_id)
        LEFT JOIN tokencount tc ON m.session_id = tc.session_id
        WHERE m.created_at >= ?
        GROUP BY m.store_url, s.shop_domain, s.status
        ORDER BY ${sortColumn} DESC
        LIMIT ${limitNum}
      `;
      params = [since];
    } else {
      // No date filter
      sql = `
        SELECT 
          m.store_url,
          s.shop_domain,
          s.status as store_status,
          COUNT(DISTINCT m.session_id) as conversations,
          COUNT(*) as messages,
          COALESCE(SUM(tc.total_tokens), 0) as tokens_used
        FROM messages m
        LEFT JOIN stores s ON (m.store_url = s.shop_domain OR m.store_url = s.store_id)
        LEFT JOIN tokencount tc ON m.session_id = tc.session_id
        GROUP BY m.store_url, s.shop_domain, s.status
        ORDER BY ${sortColumn} DESC
        LIMIT ${limitNum}
      `;
      params = [];
    }

    const [rows] = await db.execute(sql, params);

    return res.json({
      top_stores: rows.map(row => ({
        store_url: row.store_url,
        shop_domain: row.shop_domain,
        store_status: row.store_status,
        conversations: Number(row.conversations),
        messages: Number(row.messages),
        tokens_used: Number(row.tokens_used),
      })),
      meta: {
        since: since || null,
        sort_by: sortColumn,
        limit: limitNum,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ Error in /admin/top-stores:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});


/**
 * GET /admin/token-usage
 * Token usage grouped by store or by date
 */
router.get("/token-usage", async (req, res) => {
  try {
    const { since, groupBy = "store" } = req.query;
    const sinceClause = since ? "AND created_at >= ?" : "";
    const params = since ? [since] : [];

    if (groupBy === "store") {
      const sql = `
        SELECT 
          store_url,
          SUM(total_tokens) as total_tokens,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          COUNT(DISTINCT session_id) as sessions_with_tokens
        FROM tokencount
        WHERE 1=1 ${sinceClause}
        GROUP BY store_url
        ORDER BY total_tokens DESC
      `;
      const [rows] = await db.execute(sql, params);

      return res.json({
        by_store: rows.map(row => ({
          store_url: row.store_url,
          total_tokens: Number(row.total_tokens),
          input_tokens: Number(row.input_tokens),
          output_tokens: Number(row.output_tokens),
          sessions_with_tokens: Number(row.sessions_with_tokens),
        })),
        meta: {
          since: since || null,
          group_by: "store",
          timestamp: new Date().toISOString(),
        },
      });
    } else if (groupBy === "date") {
      const sql = `
        SELECT 
          DATE(created_at) as date,
          SUM(total_tokens) as total_tokens,
          COUNT(DISTINCT store_url) as active_stores
        FROM tokencount
        WHERE 1=1 ${sinceClause}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
      const [rows] = await db.execute(sql, params);

      return res.json({
        by_date: rows.map(row => ({
          date: row.date,
          total_tokens: Number(row.total_tokens),
          active_stores: Number(row.active_stores),
        })),
        meta: {
          since: since || null,
          group_by: "date",
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.status(400).json({ error: "Invalid groupBy parameter. Use 'store' or 'date'" });
  } catch (err) {
    console.error("❌ Error in /admin/token-usage:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /admin/token-usage/session
 * Params: store_url (required), since (optional)
 * Returns: session-level token usage for a given store (optionally since date)
 */
router.get("/token-usage/session", async (req, res) => {
  try {
    const { store_url, since } = req.query;
    if (!store_url) {
      return res.status(400).json({ error: "store_url is required" });
    }
    const sinceClause = since ? "AND created_at >= ?" : "";
    const params = since ? [store_url, since] : [store_url];
    // Group by session for store, order by last_message desc
    const sql = `
      SELECT session_id,
             SUM(input_tokens) as input_tokens,
             SUM(output_tokens) as output_tokens,
             SUM(total_tokens) as total_tokens,
             MIN(created_at) as first_message,
             MAX(created_at) as last_message
      FROM tokencount
      WHERE store_url = ?
        ${sinceClause}
      GROUP BY session_id
      ORDER BY last_message DESC
    `;
    const [rows] = await db.execute(sql, params);
    return res.json({
      sessions: rows.map(row => ({
        session_id: row.session_id,
        input_tokens: Number(row.input_tokens),
        output_tokens: Number(row.output_tokens),
        total_tokens: Number(row.total_tokens),
        first_message: row.first_message,
        last_message: row.last_message,
      })),
      meta: {
        store_url,
        since: since || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ Error in /admin/token-usage/session:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /admin/growth
 * Store growth over time (new signups per day)
 */
router.get("/growth", async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = toInt(days, 30);

    const sql = `
      SELECT 
        DATE(installed_at) as date,
        COUNT(*) as new_stores
      FROM stores
      WHERE installed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(installed_at)
      ORDER BY date ASC
    `;
    const [rows] = await db.execute(sql, [daysNum]);

    return res.json({
      growth_data: rows.map(row => ({
        date: row.date,
        new_stores: Number(row.new_stores),
      })),
      meta: {
        days: daysNum,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ Error in /admin/growth:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /admin/stores
 * Get all stores with their details
 */
router.get("/stores", async (req, res) => {
  try {
    const { status } = req.query;
    const statusClause = status ? "WHERE status = ?" : "";
    const params = status ? [status] : [];

    const sql = `
      SELECT 
        id,
        shop_domain,
        store_id,
        status,
        installed_at,
        last_sync_at,
        product_count
      FROM stores
      ${statusClause}
      ORDER BY installed_at DESC
    `;
    const [rows] = await db.execute(sql, params);

    return res.json({
      stores: rows,
      total: rows.length,
      meta: {
        status_filter: status || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ Error in /admin/stores:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /admin/tickets
 * Get all support tickets across all stores
 */
router.get("/tickets", async (req, res) => {
  try {
    const { status, priority } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    if (priority) {
      conditions.push("priority = ?");
      params.push(priority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        id,
        store_url,
        subject,
        issue_type,
        priority,
        status,
        channel,
        created_at,
        updated_at
      FROM tickets
      ${whereClause}
      ORDER BY 
        FIELD(priority, 'Urgent', 'High', 'Medium', 'Low'),
        created_at DESC
    `;
    const [rows] = await db.execute(sql, params);

    return res.json({
      tickets: rows,
      total: rows.length,
      meta: {
        status_filter: status || null,
        priority_filter: priority || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ Error in /admin/tickets:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /admin/stats/daily
 * Daily platform statistics for trends
 */
router.get("/stats/daily", async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = toInt(days, 30);

    const sql = `
      SELECT 
        DATE(m.created_at) as date,
        COUNT(DISTINCT m.session_id) as conversations,
        COUNT(*) as messages,
        COUNT(DISTINCT m.store_url) as active_stores,
        COALESCE(SUM(tc.total_tokens), 0) as tokens
      FROM messages m
      LEFT JOIN tokencount tc ON m.session_id = tc.session_id AND DATE(m.created_at) = DATE(tc.created_at)
      WHERE m.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(m.created_at)
      ORDER BY date ASC
    `;
    const [rows] = await db.execute(sql, [daysNum]);

    return res.json({
      daily_stats: rows.map(row => ({
        date: row.date,
        conversations: Number(row.conversations),
        messages: Number(row.messages),
        active_stores: Number(row.active_stores),
        tokens: Number(row.tokens),
      })),
      meta: {
        days: daysNum,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ Error in /admin/stats/daily:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

module.exports = router;

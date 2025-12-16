const express = require("express");
const router = express.Router();
const db = require("../db");
const axios = require("axios");

// Helper: safe numeric parse
function toInt(v, def = 0) {
  const n = parseInt(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Helper: load Shopify credentials for a store
 * Looks up by store_url, matching either stores.shop_domain or stores.store_id
 */
async function getShopifyCredentials(store_url) {
  const sql = `
    SELECT shop_domain, access_token
    FROM stores
    WHERE shop_domain = ? OR store_id = ?
    LIMIT 1
  `;
  const [rows] = await db.execute(sql, [store_url, store_url]);

  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    shopifyDomain: row.shop_domain,
    accessToken: row.access_token,
    apiVersion: "2025-10",
  };
}

/**
 * Helper: fetch Shopify orders via GraphQL, filtered by tag "quell-order"
 * Optionally also filters by created_at >= `since` if provided.
 */
async function fetchShopifyGraphQLOrders({
  shopifyDomain,
  accessToken,
  apiVersion,
  since,
}) {
  const url = `https://${shopifyDomain}/admin/api/${apiVersion}/graphql.json`;

  let queryFilter = "tag:quell-order";

  if (since) {
    const d = new Date(since);
    if (!isNaN(d.getTime())) {
      queryFilter += ` AND created_at:>='${d.toISOString()}'`;
    }
  }

  const graphqlBody = {
    query: `
      query GetQuellOrders($first: Int!, $query: String!) {
        orders(first: $first, query: $query) {
          edges {
            node {
              id
              name
              email
              createdAt
              tags
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              lineItems(first: 5) {
                edges {
                  node {
                    name
                    quantity
                    sku
                    variant {
                      id
                      title
                    }
                  }
                }
              }
              displayFinancialStatus
              displayFulfillmentStatus
            }
          }
        }
      }
    `,
    variables: {
      first: 50,
      query: queryFilter,
    },
  };

  const response = await axios.post(url, graphqlBody, {
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
  });

  const edges = response?.data?.data?.orders?.edges || [];
  return edges.map((e) => e.node);
}

/**
 * GET /analytics/conversations?store_url=...&channel=...&days=...
 * Conversation KPIs for a store.
 */
router.get("/conversations", async (req, res) => {
  try {
    const store_url = req.query.store_url;
    if (!store_url)
      return res.status(400).json({ error: "store_url is required" });

    const channelFilter = req.query.channel || null;
    const days = toInt(req.query.days, 30);

    const baseWhere = ["store_url = ?"];
    const paramsBase = [store_url];
    if (channelFilter) {
      baseWhere.push("channel = ?");
      paramsBase.push(channelFilter);
    }
    const baseWhereSQL = baseWhere.join(" AND ");

    // Total conversations
    const totalSql = `
      SELECT COUNT(DISTINCT session_id) AS total_conversations
      FROM messages
      WHERE ${baseWhereSQL}
    `;
    const [totalRows] = await db.execute(totalSql, paramsBase);
    const total_conversations = Number(
      totalRows?.[0]?.total_conversations || 0
    );

    // Active sessions today
    const todaySql = `
      SELECT COUNT(DISTINCT session_id) AS active_sessions_today
      FROM messages
      WHERE ${baseWhereSQL}
        AND DATE(created_at) = CURDATE()
    `;
    const [todayRows] = await db.execute(todaySql, paramsBase);
    const active_sessions_today = Number(
      todayRows?.[0]?.active_sessions_today || 0
    );

    // Active sessions this week
    const weekSql = `
      SELECT COUNT(DISTINCT session_id) AS active_sessions_week
      FROM messages
      WHERE ${baseWhereSQL}
        AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)
    `;
    const [weekRows] = await db.execute(weekSql, paramsBase);
    const active_sessions_week = Number(
      weekRows?.[0]?.active_sessions_week || 0
    );

    // Messages by customer vs bot
    const msgSql = `
      SELECT
        SUM(
          CASE
            WHEN user_message IS NOT NULL AND TRIM(user_message) <> ''
            THEN 1 ELSE 0
          END
        ) AS customer_messages,
        SUM(
          CASE
            WHEN bot_response IS NOT NULL AND TRIM(bot_response) <> ''
            THEN 1 ELSE 0
          END
        ) AS bot_messages
      FROM messages
      WHERE ${baseWhereSQL}
    `;
    const [msgRows] = await db.execute(msgSql, paramsBase);
    const customer_messages = Number(msgRows?.[0]?.customer_messages || 0);
    const bot_messages = Number(msgRows?.[0]?.bot_messages || 0);

    // Conversations by channel
    const channelSql = `
      SELECT channel, COUNT(DISTINCT session_id) AS sessions
      FROM messages
      WHERE store_url = ?
      GROUP BY channel
      ORDER BY sessions DESC
    `;
    const [channelsRows] = await db.execute(channelSql, [store_url]);

    // Daily usage (last N days)
    const dailySql = `
      SELECT
        DATE(created_at) AS date,
        COUNT(DISTINCT session_id) AS conversations
      FROM messages
      WHERE ${baseWhereSQL}
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;
    const [dailyRows] = await db.execute(dailySql, [...paramsBase, days]);

    // Hourly usage (last 24 hours)
    const hourlySql = `
      SELECT
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00') AS hour_label,
        COUNT(DISTINCT session_id) AS conversations
      FROM messages
      WHERE ${baseWhereSQL}
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY hour_label
      ORDER BY hour_label ASC
    `;
    const [hourlyRows] = await db.execute(hourlySql, paramsBase);

    res.json({
      total_conversations,
      active_sessions_today,
      active_sessions_week,
      messages: { customer: customer_messages, bot: bot_messages },
      conversations_by_channel: channelsRows.map((r) => ({
        channel: r.channel,
        sessions: Number(r.sessions),
      })),
      daily_usage: dailyRows.map((r) => ({
        date: r.date,
        conversations: Number(r.conversations),
      })),
      hourly_usage: hourlyRows.map((r) => ({
        hour: r.hour_label,
        conversations: Number(r.conversations),
      })),
      meta: {
        store_url,
        channel_filter: channelFilter || null,
        days,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /analytics/sales?store_url=...&since=YYYY-MM-DD
 *
 * Returns:
 * - add_to_cart_events
 * - orders
 * - ai_assisted_conversions
 * - add_to_cart_by_channel
 * - orders_by_channel
 * - top_products
 * - shopify (orders with tag "quell-order" from Shopify GraphQL)
 */
router.get("/sales", async (req, res) => {
  try {
    const store_url = req.query.store_url;
    if (!store_url)
      return res.status(400).json({ error: "store_url is required" });

    const since = req.query.since || null;
    const sinceClause = since ? "AND created_at >= ?" : "";
    const baseParams = since ? [store_url, since] : [store_url];

    // JSON conditions
    const addToCartCondition = `
      (
        JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.event')) = 'add_to_cart'
        OR JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.type')) = 'checkout'
        OR JSON_EXTRACT(message_json, '$.checkoutUrl') IS NOT NULL
      )
    `;

    const orderCondition = `
      (
        JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.event')) = 'order'
        OR JSON_EXTRACT(message_json, '$.order_id') IS NOT NULL
        OR JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.type')) = 'order'
      )
    `;

    // 1) Add to cart events
    const addCartSql = `
      SELECT COUNT(*) AS add_to_cart_events
      FROM messages
      WHERE store_url = ?
        AND ${addToCartCondition}
        ${sinceClause}
    `;
    const [addCartRows] = await db.execute(addCartSql, baseParams);
    const add_to_cart_events = Number(
      addCartRows?.[0]?.add_to_cart_events || 0
    );

    // 2) Orders
    const ordersSql = `
      SELECT COUNT(*) AS orders
      FROM messages
      WHERE store_url = ?
        AND ${orderCondition}
        ${sinceClause}
    `;
    const [ordersRows] = await db.execute(ordersSql, baseParams);
    const orders = Number(ordersRows?.[0]?.orders || 0);

    // 3) AI-assisted conversions
    const aiParams = since
      ? [store_url, since, store_url, since]
      : [store_url, store_url];

    const aiSql = `
      SELECT COUNT(DISTINCT o.session_id) AS ai_assisted_conversions
      FROM (
        SELECT session_id, MIN(created_at) AS order_time
        FROM messages
        WHERE store_url = ?
          AND ${orderCondition}
          ${since ? "AND created_at >= ?" : ""}
        GROUP BY session_id
      ) o
      JOIN messages m
        ON m.session_id = o.session_id
        AND m.store_url = ?
      WHERE (
        ${addToCartCondition}
        OR JSON_UNQUOTE(JSON_EXTRACT(m.message_json, '$.event')) = 'product_view'
      )
      AND m.created_at <= o.order_time
      ${since ? "AND m.created_at >= ?" : ""}
    `;
    const [aiRows] = await db.execute(aiSql, aiParams);
    const ai_assisted_conversions = Number(
      aiRows?.[0]?.ai_assisted_conversions || 0
    );

    // 4) Add to cart by channel
    const addCartByChannelSql = `
      SELECT channel, COUNT(*) AS cnt
      FROM messages
      WHERE store_url = ?
        AND ${addToCartCondition}
        ${sinceClause}
      GROUP BY channel
      ORDER BY cnt DESC
    `;
    const [addCartByChannelRows] = await db.execute(
      addCartByChannelSql,
      baseParams
    );

    // 5) Orders by channel
    const ordersByChannelSql = `
      SELECT channel, COUNT(*) AS cnt
      FROM messages
      WHERE store_url = ?
        AND ${orderCondition}
        ${sinceClause}
      GROUP BY channel
      ORDER BY cnt DESC
    `;
    const [ordersByChannelRows] = await db.execute(
      ordersByChannelSql,
      baseParams
    );

    // 6) Top products
    const topProductsSql = `
      SELECT
        JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.product.id')) AS product_id,
        JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.product.title')) AS title,
        COUNT(*) AS cnt
      FROM messages
      WHERE store_url = ?
        AND JSON_EXTRACT(message_json, '$.product.id') IS NOT NULL
        ${sinceClause}
      GROUP BY product_id, title
      ORDER BY cnt DESC
      LIMIT 20
    `;
    const [topProductsRows] = await db.execute(topProductsSql, baseParams);

    // 7) Shopify orders tagged "quell-order" via GraphQL
    const shopifyCreds = await getShopifyCredentials(store_url);
    let shopifySummary = null;

    if (shopifyCreds) {
      try {
        const { shopifyDomain, accessToken, apiVersion } = shopifyCreds;

        const shopifyOrders = await fetchShopifyGraphQLOrders({
          shopifyDomain,
          accessToken,
          apiVersion,
          since,
        });

        const totalOrdersShopify = shopifyOrders.length;

        const totalRevenueShopify = shopifyOrders.reduce((sum, o) => {
          const amountStr =
            o.totalPriceSet?.shopMoney?.amount != null
              ? o.totalPriceSet.shopMoney.amount
              : "0";
          const amount = parseFloat(amountStr);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

        const currency =
          shopifyOrders[0]?.totalPriceSet?.shopMoney?.currencyCode || null;

        shopifySummary = {
          total_orders: totalOrdersShopify,
          total_revenue: totalRevenueShopify,
          currency,
          recent_orders: shopifyOrders.slice(0, 10).map((o) => ({
            id: o.id,
            name: o.name,
            email: o.email,
            created_at: o.createdAt,
            tags: o.tags,
            total_price: o.totalPriceSet?.shopMoney?.amount,
            currency: o.totalPriceSet?.shopMoney?.currencyCode,
            financial_status: o.displayFinancialStatus,
            fulfillment_status: o.displayFulfillmentStatus,
            line_items:
              o.lineItems?.edges?.map((li) => ({
                name: li.node.name,
                quantity: li.node.quantity,
                sku: li.node.sku,
                variant: li.node.variant
                  ? {
                      id: li.node.variant.id,
                      title: li.node.variant.title,
                    }
                  : null,
              })) || [],
          })),
        };
      } catch (shopifyErr) {
        // Silently fail - shopifySummary remains null
      }
    }

    return res.json({
      add_to_cart_events,
      orders,
      ai_assisted_conversions,
      add_to_cart_by_channel: addCartByChannelRows,
      orders_by_channel: ordersByChannelRows,
      top_products: topProductsRows,
      shopify: shopifySummary,
      meta: {
        store_url,
        since: since || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /analytics/customer-behavior?store_url=...&since=YYYY-MM-DD
 * 
 * Returns customer behavior metrics tracked by user_email
 */
router.get("/customer-behavior", async (req, res) => {
  try {
    const store_url = req.query.store_url;
    if (!store_url)
      return res.status(400).json({ error: "store_url is required" });

    const since = req.query.since || null;
    const sinceClause = since ? "AND created_at >= ?" : "";
    const baseParams = since ? [store_url, since] : [store_url];

    // 1) Total sessions and unique customers (by user_email)
    const sessionsSql = `
      SELECT 
        COUNT(DISTINCT session_id) AS total_sessions,
        COUNT(DISTINCT 
          CASE 
            WHEN user_email IS NOT NULL AND user_email != '' THEN user_email
            WHEN JSON_EXTRACT(message_json, '$.email') IS NOT NULL 
              THEN JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.email'))
            ELSE NULL
          END
        ) AS unique_customers
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
    `;
    const [sessionsRows] = await db.execute(sessionsSql, baseParams);
    const total_sessions = Number(sessionsRows?.[0]?.total_sessions || 0);
    const unique_customers = Number(sessionsRows?.[0]?.unique_customers || 0);

    // 2) Total messages (user + bot)
    const messagesSql = `
      SELECT 
        COUNT(*) AS total_messages,
        SUM(CASE WHEN user_message IS NOT NULL AND TRIM(user_message) != '' THEN 1 ELSE 0 END) AS user_messages,
        SUM(CASE WHEN bot_response IS NOT NULL AND TRIM(bot_response) != '' THEN 1 ELSE 0 END) AS bot_messages
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
    `;
    const [messagesRows] = await db.execute(messagesSql, baseParams);
    const total_messages = Number(messagesRows?.[0]?.total_messages || 0);
    const user_messages = Number(messagesRows?.[0]?.user_messages || 0);
    const bot_messages = Number(messagesRows?.[0]?.bot_messages || 0);

    // 3) Average messages per session
    const avg_messages_per_session = total_sessions > 0 
      ? (total_messages / total_sessions).toFixed(1) 
      : 0;

    // 4) Session duration
    const durationSql = `
      SELECT 
        session_id,
        TIMESTAMPDIFF(SECOND, MIN(created_at), MAX(created_at)) AS duration_seconds
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
      GROUP BY session_id
      HAVING COUNT(*) > 1
    `;
    const [durationRows] = await db.execute(durationSql, baseParams);
    
    const durations = durationRows.map(r => Number(r.duration_seconds));
    const avg_session_duration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // 5) Peak hours
    const peakHoursSql = `
      SELECT 
        HOUR(created_at) AS hour,
        COUNT(DISTINCT session_id) AS sessions
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `;
    const [peakHoursRows] = await db.execute(peakHoursSql, baseParams);

    // 6) Peak days
    const peakDaysSql = `
      SELECT 
        DAYNAME(created_at) AS day_name,
        COUNT(DISTINCT session_id) AS sessions
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
      GROUP BY DAYNAME(created_at), DAYOFWEEK(created_at)
      ORDER BY DAYOFWEEK(created_at)
    `;
    const [peakDaysRows] = await db.execute(peakDaysSql, baseParams);

    // 7) Engagement levels
    const engagementSql = `
      SELECT 
        session_id,
        COUNT(*) AS message_count
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
      GROUP BY session_id
    `;
    const [engagementRows] = await db.execute(engagementSql, baseParams);

    const engagement_distribution = {
      low: 0,
      medium: 0,
      high: 0,
      very_high: 0
    };

    engagementRows.forEach(row => {
      const count = Number(row.message_count);
      if (count <= 2) engagement_distribution.low++;
      else if (count <= 5) engagement_distribution.medium++;
      else if (count <= 10) engagement_distribution.high++;
      else engagement_distribution.very_high++;
    });

    // 8) Return vs new visitors (based on user_email)
    const returningVisitorsSql = `
      SELECT 
        COALESCE(
          NULLIF(user_email, ''),
          JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.email'))
        ) AS customer_email,
        COUNT(DISTINCT DATE(created_at)) AS visit_days
      FROM messages
      WHERE store_url = ?
        AND (
          (user_email IS NOT NULL AND user_email != '')
          OR JSON_EXTRACT(message_json, '$.email') IS NOT NULL
        )
        ${sinceClause}
      GROUP BY customer_email
      HAVING customer_email IS NOT NULL AND customer_email != ''
    `;
    const [returningRows] = await db.execute(returningVisitorsSql, baseParams);

    const new_visitors = returningRows.filter(r => Number(r.visit_days) === 1).length;
    const returning_visitors = returningRows.filter(r => Number(r.visit_days) > 1).length;

    // 9) Most common user queries
    const commonQueriesSql = `
      SELECT 
        user_message,
        COUNT(*) AS frequency
      FROM messages
      WHERE store_url = ?
        AND user_message IS NOT NULL
        AND TRIM(user_message) != ''
        ${sinceClause}
      GROUP BY user_message
      ORDER BY frequency DESC
      LIMIT 10
    `;
    const [commonQueriesRows] = await db.execute(commonQueriesSql, baseParams);

    // 10) Channel preference
    const channelPreferenceSql = `
      SELECT 
        channel,
        COUNT(DISTINCT session_id) AS sessions,
        COUNT(DISTINCT 
          CASE 
            WHEN user_email IS NOT NULL AND user_email != '' THEN user_email
            WHEN JSON_EXTRACT(message_json, '$.email') IS NOT NULL 
              THEN JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.email'))
            ELSE NULL
          END
        ) AS unique_users
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
      GROUP BY channel
      ORDER BY sessions DESC
    `;
    const [channelRows] = await db.execute(channelPreferenceSql, baseParams);

    // 11) Session depth (products viewed)
    const sessionDepthSql = `
      SELECT 
        session_id,
        COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(message_json, '$.product.id'))) AS products_viewed
      FROM messages
      WHERE store_url = ?
        AND JSON_EXTRACT(message_json, '$.product.id') IS NOT NULL
        ${sinceClause}
      GROUP BY session_id
    `;
    const [sessionDepthRows] = await db.execute(sessionDepthSql, baseParams);

    const avg_products_per_session = sessionDepthRows.length > 0
      ? (sessionDepthRows.reduce((sum, r) => sum + Number(r.products_viewed), 0) / sessionDepthRows.length).toFixed(1)
      : 0;

    return res.json({
      overview: {
        total_sessions,
        unique_customers,
        total_messages,
        user_messages,
        bot_messages,
        avg_messages_per_session: Number(avg_messages_per_session),
        avg_session_duration_seconds: avg_session_duration,
        avg_products_per_session: Number(avg_products_per_session),
      },
      visitor_types: {
        new_visitors,
        returning_visitors,
        return_rate: unique_customers > 0 
          ? ((returning_visitors / unique_customers) * 100).toFixed(1) + '%'
          : '0%'
      },
      engagement_distribution,
      peak_hours: peakHoursRows.map(r => ({
        hour: Number(r.hour),
        sessions: Number(r.sessions)
      })),
      peak_days: peakDaysRows.map(r => ({
        day: r.day_name,
        sessions: Number(r.sessions)
      })),
      channel_preference: channelRows.map(r => ({
        channel: r.channel,
        sessions: Number(r.sessions),
        unique_users: Number(r.unique_users)
      })),
      common_queries: commonQueriesRows.map(r => ({
        query: r.user_message,
        frequency: Number(r.frequency)
      })),
      meta: {
        store_url,
        since: since || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

/**
 * POST /analytics/ai-analyze
 * Trigger n8n workflow for AI conversation analysis
 */
router.post("/ai-analyze", async (req, res) => {
  console.log("🚀 /ai-analyze called");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));
  
  try {
    const { store_url, session_id, limit } = req.body;
    
    if (!store_url) {
      console.log("❌ No store_url provided");
      return res.status(400).json({ error: "store_url is required" });
    }

    const n8nWebhookUrl = process.env.N8N_ANALYSIS_WEBHOOK_URL;

    console.log("🔗 n8n Webhook URL:", n8nWebhookUrl);
    console.log("🔍 Environment check:", {
      hasEnvVar: !!process.env.N8N_ANALYSIS_WEBHOOK_URL,
      envValue: process.env.N8N_ANALYSIS_WEBHOOK_URL
    });

    // If specific session provided, analyze only that one
    if (session_id) {
      console.log("📍 Analyzing single session:", session_id);
      try {
        console.log("🌐 Calling n8n webhook...");
        const response = await axios.post(n8nWebhookUrl, {
          session_id,
          store_url,
        }, {
          timeout: 60000
        });

        console.log("✅ n8n responded successfully");
        return res.json({
          success: true,
          session_id,
          analysis: response.data,
          message: "Session analyzed successfully"
        });
      } catch (err) {
        console.error("❌ n8n webhook call failed:", err.message);
        console.error("Error details:", {
          message: err.message,
          code: err.code,
          response: err.response?.data
        });
        return res.status(500).json({
          success: false,
          error: "Failed to analyze session",
          details: err.message
        });
      }
    }

    // Batch analysis
    console.log("📦 Starting batch analysis, limit:", limit || 50);
    const analysisLimit = limit || 50;
    const safeLimitValue = Math.max(1, Math.min(parseInt(analysisLimit) || 50, 500));
    
    console.log("🔍 Querying database for unanalyzed sessions...");
    const [sessions] = await db.execute(
      `SELECT DISTINCT m.session_id, MAX(m.created_at) as last_message
       FROM messages m
       LEFT JOIN conversation_analysis ca ON m.session_id = ca.session_id
       WHERE m.store_url = ?
         AND ca.id IS NULL
         AND m.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY m.session_id
       ORDER BY last_message DESC
       LIMIT ${safeLimitValue}`,
       [store_url]
    );

    console.log(`📊 Found ${sessions.length} sessions to analyze`);

    if (sessions.length === 0) {
      console.log("ℹ️ No new conversations to analyze");
      return res.json({
        success: true,
        message: "No new conversations to analyze",
        analyzed_count: 0,
        total_sessions: 0,
      });
    }

    // Trigger n8n workflow for each session
    const results = [];
    let successCount = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      console.log(`🔄 Analyzing session ${i + 1}/${sessions.length}: ${session.session_id}`);
      
      try {
        console.log("🌐 Calling n8n webhook...");
        const response = await axios.post(n8nWebhookUrl, {
          session_id: session.session_id,
          store_url,
        }, {
          timeout: 60000
        });

        console.log(`✅ Session ${session.session_id} analyzed successfully`);
        results.push({
          session_id: session.session_id,
          success: true,
          data: response.data,
        });
        
        successCount++;

        // Rate limiting
        if (i < sessions.length - 1) {
          console.log("⏳ Waiting 2 seconds...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err) {
        console.error(`❌ Failed to analyze session ${session.session_id}:`, err.message);
        results.push({
          session_id: session.session_id,
          success: false,
          error: err.message,
        });
      }
    }

    console.log(`✅ Batch analysis complete: ${successCount}/${sessions.length} successful`);

    return res.json({
      success: true,
      analyzed_count: successCount,
      failed_count: sessions.length - successCount,
      total_sessions: sessions.length,
      results: results.slice(0, 5),
      message: `Successfully analyzed ${successCount} out of ${sessions.length} conversations`
    });
    
  } catch (err) {
    console.error("❌❌❌ CRITICAL ERROR in /ai-analyze:", err);
    console.error("Stack trace:", err.stack);
    return res.status(500).json({ 
      success: false,
      error: "AI analysis failed", 
      details: err.message 
    });
  }
});

/**
 * GET /analytics/ai-insights?store_url=...&since=YYYY-MM-DD
 * Get AI-powered behavior insights from analyzed conversations
 */
router.get("/ai-insights", async (req, res) => {
  try {
    const store_url = req.query.store_url;
    if (!store_url) {
      return res.status(400).json({ error: "store_url is required" });
    }

    const since = req.query.since || null;
    const sinceClause = since ? "AND analyzed_at >= ?" : "";
    const baseParams = since ? [store_url, since] : [store_url];

    // 1) Sentiment Distribution
    const sentimentSql = `
      SELECT 
        sentiment,
        COUNT(*) as count,
        AVG(sentiment_score) as avg_score
      FROM conversation_analysis
      WHERE store_url = ? ${sinceClause}
      GROUP BY sentiment
    `;
    const [sentimentRows] = await db.execute(sentimentSql, baseParams);

    // 2) Intent Distribution
    const intentSql = `
      SELECT 
        primary_intent,
        COUNT(*) as count,
        AVG(intent_confidence) as avg_confidence
      FROM conversation_analysis
      WHERE store_url = ? ${sinceClause}
      GROUP BY primary_intent
      ORDER BY count DESC
    `;
    const [intentRows] = await db.execute(intentSql, baseParams);

    // 3) Average CSAT Prediction
    const csatSql = `
      SELECT 
        AVG(csat_prediction) as avg_csat,
        COUNT(*) as total_analyzed
      FROM conversation_analysis
      WHERE store_url = ? ${sinceClause}
    `;
    const [csatRows] = await db.execute(csatSql, baseParams);

    // 4) Resolution Status
    const resolutionSql = `
      SELECT 
        resolution_status,
        COUNT(*) as count
      FROM conversation_analysis
      WHERE store_url = ? ${sinceClause}
      GROUP BY resolution_status
    `;
    const [resolutionRows] = await db.execute(resolutionSql, baseParams);

    // 5) Top Topics (aggregate from JSON array)
    const topicsSql = `
      SELECT topics
      FROM conversation_analysis
      WHERE store_url = ? 
        AND topics IS NOT NULL
        ${sinceClause}
    `;
    const [topicsRows] = await db.execute(topicsSql, baseParams);
    
    const topicsCount = {};
    topicsRows.forEach(row => {
      try {
        const topics = JSON.parse(row.topics);
        topics.forEach(topic => {
          topicsCount[topic] = (topicsCount[topic] || 0) + 1;
        });
      } catch (e) {}
    });
    
    const topTopics = Object.entries(topicsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // 6) Risk Metrics
    const riskSql = `
      SELECT 
        AVG(drop_off_risk) as avg_drop_off_risk,
        AVG(purchase_likelihood) as avg_purchase_likelihood,
        AVG(user_frustration_level) as avg_frustration
      FROM conversation_analysis
      WHERE store_url = ? ${sinceClause}
    `;
    const [riskRows] = await db.execute(riskSql, baseParams);

    // 7) Conversation Stage Distribution
    const stageSql = `
      SELECT 
        conversation_stage,
        COUNT(*) as count
      FROM conversation_analysis
      WHERE store_url = ? ${sinceClause}
      GROUP BY conversation_stage
    `;
    const [stageRows] = await db.execute(stageSql, baseParams);

    // 8) Engagement Quality
    const engagementSql = `
      SELECT 
        engagement_quality,
        COUNT(*) as count
      FROM conversation_analysis
      WHERE store_url = ? ${sinceClause}
      GROUP BY engagement_quality
    `;
    const [engagementRows] = await db.execute(engagementSql, baseParams);

    // 9) Emotion Distribution (aggregate from JSON)
    const emotionsSql = `
      SELECT emotions
      FROM conversation_analysis
      WHERE store_url = ? 
        AND emotions IS NOT NULL
        ${sinceClause}
    `;
    const [emotionsRows] = await db.execute(emotionsSql, baseParams);
    
    const emotionsTotals = {
      frustration: 0,
      satisfaction: 0,
      confusion: 0,
      excitement: 0
    };
    let emotionCount = 0;
    
    emotionsRows.forEach(row => {
      try {
        const emotions = JSON.parse(row.emotions);
        Object.keys(emotionsTotals).forEach(key => {
          if (emotions[key] !== undefined) {
            emotionsTotals[key] += parseFloat(emotions[key]);
          }
        });
        emotionCount++;
      } catch (e) {}
    });
    
    const avgEmotions = {};
    Object.keys(emotionsTotals).forEach(key => {
      avgEmotions[key] = emotionCount > 0 
        ? (emotionsTotals[key] / emotionCount).toFixed(2) 
        : 0;
    });

    return res.json({
      sentiment_distribution: sentimentRows.map(r => ({
        sentiment: r.sentiment,
        count: Number(r.count),
        avg_score: Number(r.avg_score || 0).toFixed(2),
      })),
      intent_distribution: intentRows.map(r => ({
        intent: r.primary_intent,
        count: Number(r.count),
        confidence: Number(r.avg_confidence || 0).toFixed(2),
      })),
      csat_metrics: {
        avg_predicted_csat: Number(csatRows[0]?.avg_csat || 0).toFixed(2),
        total_analyzed: Number(csatRows[0]?.total_analyzed || 0),
      },
      resolution_status: resolutionRows.map(r => ({
        status: r.resolution_status,
        count: Number(r.count),
      })),
      top_topics: topTopics,
      risk_metrics: {
        avg_drop_off_risk: Number(riskRows[0]?.avg_drop_off_risk || 0).toFixed(2),
        avg_purchase_likelihood: Number(riskRows[0]?.avg_purchase_likelihood || 0).toFixed(2),
        avg_frustration: Number(riskRows[0]?.avg_frustration || 0).toFixed(2),
      },
      conversation_stages: stageRows.map(r => ({
        stage: r.conversation_stage,
        count: Number(r.count),
      })),
      engagement_quality: engagementRows.map(r => ({
        quality: r.engagement_quality,
        count: Number(r.count),
      })),
      avg_emotions: avgEmotions,
      meta: {
        store_url,
        since: since || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ 
      error: "Internal server error", 
      details: err.message 
    });
  }
});


/**
 * GET /analytics/performance?store_url=...&since=YYYY-MM-DD
 * 
 * Bot performance and response quality metrics
 */
router.get("/performance", async (req, res) => {
  try {
    const store_url = req.query.store_url;
    if (!store_url)
      return res.status(400).json({ error: "store_url is required" });

    const since = req.query.since || null;
    const sinceClause = since ? "AND created_at >= ?" : "";
    const baseParams = since ? [store_url, since] : [store_url];

    // 1) Total messages and response metrics
    const totalSql = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT session_id) as total_sessions,
        SUM(CASE WHEN bot_response IS NOT NULL AND TRIM(bot_response) != '' THEN 1 ELSE 0 END) as bot_responses,
        SUM(CASE WHEN user_message IS NOT NULL AND TRIM(user_message) != '' THEN 1 ELSE 0 END) as user_messages
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
    `;
    const [totalRows] = await db.execute(totalSql, baseParams);
    const total_messages = Number(totalRows?.[0]?.total_messages || 0);
    const total_sessions = Number(totalRows?.[0]?.total_sessions || 0);
    const bot_responses = Number(totalRows?.[0]?.bot_responses || 0);
    const user_messages = Number(totalRows?.[0]?.user_messages || 0);

    // 2) Calculate ACTUAL bot response time (time between consecutive messages)
    // Get all messages ordered by session and time
    const messagesSql = `
      SELECT 
        id,
        session_id,
        created_at,
        user_message,
        bot_response
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
      ORDER BY session_id, created_at ASC
    `;
    const [messagesRows] = await db.execute(messagesSql, baseParams);

    // Calculate response times between consecutive messages
    let responseTimes = [];
    for (let i = 1; i < messagesRows.length; i++) {
      const prevMsg = messagesRows[i - 1];
      const currMsg = messagesRows[i];
      
      // Only calculate if same session and previous had user message, current has bot response
      if (prevMsg.session_id === currMsg.session_id &&
          prevMsg.user_message && prevMsg.user_message.trim() !== '' &&
          currMsg.bot_response && currMsg.bot_response.trim() !== '') {
        
        const timeDiff = Math.floor(
          (new Date(currMsg.created_at) - new Date(prevMsg.created_at)) / 1000
        );
        
        // Only include reasonable response times (< 5 minutes = 300 seconds)
        if (timeDiff >= 0 && timeDiff < 300) {
          responseTimes.push(timeDiff);
        }
      }
    }

    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
      : 0;

    // 3) Average session duration (what was previously called response time)
    const sessionDurationSql = `
      SELECT 
        session_id,
        TIMESTAMPDIFF(SECOND, MIN(created_at), MAX(created_at)) as duration_seconds
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
      GROUP BY session_id
      HAVING COUNT(*) > 1
    `;
    const [sessionDurationRows] = await db.execute(sessionDurationSql, baseParams);
    
    const avgSessionDuration = sessionDurationRows.length > 0
      ? Math.round(
          sessionDurationRows.reduce((sum, r) => sum + Number(r.duration_seconds), 0) / 
          sessionDurationRows.length
        )
      : 0;

    // 4) Response rate (% of user messages that got bot response)
    const responseRate = user_messages > 0 
      ? ((bot_responses / user_messages) * 100).toFixed(1)
      : 0;

    // 5) Fallback detection: when bot never responded to a user message
    const fallbackSql = `
      SELECT COUNT(*) as fallback_count
      FROM messages
      WHERE store_url = ?
        AND (bot_response IS NULL OR TRIM(bot_response) = '')
        AND user_message IS NOT NULL
        AND TRIM(user_message) != ''
        ${sinceClause}
    `;
    const [fallbackRows] = await db.execute(fallbackSql, baseParams);
    const fallback_count = Number(fallbackRows?.[0]?.fallback_count || 0);

    // Fallback rate = % of user messages that got no bot response
    const fallback_rate = user_messages > 0 
      ? ((fallback_count / user_messages) * 100).toFixed(1)
      : 0;

    // 6) Session completion rate (sessions with at least 3 messages)
    const completionSql = `
      SELECT 
        session_id,
        COUNT(*) as message_count
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
      GROUP BY session_id
    `;
    const [completionRows] = await db.execute(completionSql, baseParams);
    
    const completed_sessions = completionRows.filter(r => Number(r.message_count) >= 3).length;
    const completion_rate = total_sessions > 0
      ? ((completed_sessions / total_sessions) * 100).toFixed(1)
      : 0;

    // 7) Response time by hour (last 24 hours)
    const hourlyResponseSql = `
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as message_count
      FROM messages
      WHERE store_url = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND bot_response IS NOT NULL
        AND TRIM(bot_response) != ''
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `;
    const [hourlyResponseRows] = await db.execute(hourlyResponseSql, [store_url]);

    // 8) Daily response performance
    const dailyPerformanceSql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(*) as messages,
        SUM(CASE WHEN bot_response IS NOT NULL AND TRIM(bot_response) != '' THEN 1 ELSE 0 END) as bot_responses
      FROM messages
      WHERE store_url = ?
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;
    const [dailyPerformanceRows] = await db.execute(dailyPerformanceSql, [store_url]);

    // 9) Error detection (looking for error messages or failed responses)
    const errorSql = `
      SELECT COUNT(*) as error_count
      FROM messages
      WHERE store_url = ?
        AND (
          LOWER(bot_response) LIKE '%error%'
          OR LOWER(bot_response) LIKE '%failed%'
          OR bot_response IS NULL
          OR bot_response = ''
        )
        ${sinceClause}
    `;
    const [errorRows] = await db.execute(errorSql, baseParams);
    const error_count = Number(errorRows?.[0]?.error_count || 0);
    const error_rate = total_messages > 0
      ? ((error_count / total_messages) * 100).toFixed(1)
      : 0;

    // 10) Most common user queries (to identify popular topics)
    const topQueriesSql = `
      SELECT 
        user_message,
        COUNT(*) as frequency
      FROM messages
      WHERE store_url = ?
        AND user_message IS NOT NULL
        AND TRIM(user_message) != ''
        ${sinceClause}
      GROUP BY user_message
      ORDER BY frequency DESC
      LIMIT 10
    `;
    const [topQueriesRows] = await db.execute(topQueriesSql, baseParams);

    // 11) Channel-wise performance
    const channelPerformanceSql = `
      SELECT 
        channel,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(*) as messages
      FROM messages
      WHERE store_url = ?
        ${sinceClause}
      GROUP BY channel
      ORDER BY sessions DESC
    `;
    const [channelPerformanceRows] = await db.execute(channelPerformanceSql, baseParams);

    return res.json({
      overview: {
        total_messages,
        total_sessions,
        bot_responses,
        user_messages,
        avg_session_duration_seconds: avgSessionDuration,  
        response_rate: parseFloat(responseRate),
        fallback_rate: parseFloat(fallback_rate),
        error_rate: parseFloat(error_rate),
        completion_rate: parseFloat(completion_rate),
      },
      performance_metrics: {
        fallback_count,
        error_count,
        completed_sessions,
        avg_messages_per_session: total_sessions > 0 
          ? (total_messages / total_sessions).toFixed(1)
          : 0,
        response_time_samples: responseTimes.length,
      },
      hourly_response_time: hourlyResponseRows.map(r => ({
        hour: Number(r.hour),
        message_count: Number(r.message_count),
      })),
      daily_performance: dailyPerformanceRows.map(r => ({
        date: r.date,
        sessions: Number(r.sessions),
        messages: Number(r.messages),
        bot_responses: Number(r.bot_responses),
        response_rate: Number(r.messages) > 0 
          ? ((Number(r.bot_responses) / Number(r.messages)) * 100).toFixed(1)
          : 0,
      })),
      top_queries: topQueriesRows.map(r => ({
        query: r.user_message,
        frequency: Number(r.frequency),
      })),
      channel_performance: channelPerformanceRows.map(r => ({
        channel: r.channel,
        sessions: Number(r.sessions),
        messages: Number(r.messages),
      })),
      meta: {
        store_url,
        since: since || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ Performance analytics error:", err);
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

module.exports = router;

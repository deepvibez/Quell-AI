const express = require("express");
const axios = require("axios");
const { saveChatTurn } = require("../Services/messageService");

const router = express.Router();

const N8N_CHAT_WEBHOOK = process.env.N8N_CHAT_WEBHOOK;
const N8N_CUSTOMER_CHECK_WEBHOOK = process.env.N8N_CUSTOMERCHECK_WEBHOOK;

router.options("/", (req, res) => {
  res.sendStatus(204);
});

router.post("/", async (req, res) => {
  const data = req.body || {};
  const isUserInfo = data.type === "user_info";
  let webhookUrl;

  if (isUserInfo) {
    webhookUrl = N8N_CUSTOMER_CHECK_WEBHOOK;
  } else if (data.queryType && String(data.queryType).toLowerCase() === "account") {
    webhookUrl = N8N_CUSTOMER_CHECK_WEBHOOK;
  } else {
    webhookUrl = N8N_CHAT_WEBHOOK;
  }

  try {
    const response = await axios.post(webhookUrl, data, {
      headers: { "Content-Type": "application/json" },
      timeout: 120000,
    });

    let webhookResp = response.data;

    if (typeof webhookResp === "string") {
      try {
        webhookResp = JSON.parse(webhookResp);
        console.log("✅ Parsed stringified JSON from n8n");
      } catch (e) {
        console.log("ℹ️ Response is plain text, not JSON:", webhookResp);
      }
    }

    console.log("📤 Sending to widget:", JSON.stringify(webhookResp).substring(0, 200));

    res.status(response.status).set("Content-Type", "application/json").json(webhookResp);

    if (!isUserInfo && data.type === "chat_message") {
      const store_url = data.store || data.storeUrl || "unknown_store";
      const session_id = data.sessionId || `sess-${Date.now()}`;
      const channel = data.channel || "website";
      const customer_id = data.customerId || null;
      const user_email = data.email || null;
      const user_name = data.name || null;
      const user_message = data.message || null;
      let bot_response = null;
      let message_json = null;

      if (typeof webhookResp === "object" && webhookResp !== null) {
        if (webhookResp.reply && String(webhookResp.reply).trim() !== "") {
          bot_response = webhookResp.reply;
        } else if (webhookResp.message) {
          bot_response = webhookResp.message;
        } else if (webhookResp.output) {
          bot_response = webhookResp.output;
        } else if (webhookResp.text) {
          bot_response = webhookResp.text;
        } else {
          bot_response = "Here's what I found for you:";
        }

        const hasProducts = webhookResp.products && Array.isArray(webhookResp.products) && webhookResp.products.length > 0;
        const hasCheckout = webhookResp.checkoutUrl || webhookResp.checkout_url || webhookResp.checkout;

        if (hasProducts) {
          message_json = {
            type: "product_card",
            products: webhookResp.products,
            reply: webhookResp.reply || ""
          };
        } else if (hasCheckout) {
          message_json = {
            type: "checkout",
            checkoutUrl: webhookResp.checkoutUrl || webhookResp.checkout_url || webhookResp.checkout,
            cartTotal: webhookResp.cartTotal || webhookResp.cart_total || null,
            itemCount: webhookResp.itemCount || webhookResp.item_count || null,
            cartQuantity: webhookResp.cartQuantity || null,
            reply: webhookResp.reply || ""
          };
        }
      } else if (typeof webhookResp === "string") {
        bot_response = webhookResp;
      } else {
        bot_response = "I received your message.";
      }

      try {
        const insertId = await saveChatTurn({
          store_url,
          session_id,
          customer_id,
          channel,
          user_email,
          user_name,
          user_message,
          bot_response,
          message_json,
          query_type: data.queryType || "general",
        });

        console.log("💾 Chat saved:", {
          id: insertId,
          session_id,
          customer_id,
          bot_response,
          message_type: message_json?.type || "text",
          has_checkout: message_json?.type === "checkout",
          has_products: message_json?.type === "product_card"
        });

        const io = req.app.get("io");
        if (io) {
          io.to(`store_${store_url}`).emit("conversation:new_message", {
            id: insertId,
            session_id,
            customer_id,
            channel,
            user_message,
            bot_response,
            message_json,
            created_at: new Date(),
            is_read: 0,
            user_name,
            user_email,
          });
          console.log(`📡 Emitted to store_${store_url}`);
        }
      } catch (dbErr) {
        console.error("❌ DB Save Error:", dbErr);
      }
    }
  } catch (err) {
    console.error("❌ n8n webhook error:", err.message);

    if (!res.headersSent) {
      res.status(err.response?.status || 500).json({
        error: "Failed to call n8n webhook",
        message: err.message,
      });
    }
  }
});

module.exports = router;

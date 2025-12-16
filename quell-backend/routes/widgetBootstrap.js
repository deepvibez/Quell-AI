// routes/widgetBootstrap.js
const express = require("express");
const router = express.Router();
const db = require("../db");

function cleanDomain(domain) {
  if (!domain) return "";
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

router.get("/:token", async (req, res) => {
  const widgetToken = req.params.token;

  if (!widgetToken) {
    console.warn("❌ widget-bootstrap: missing widget token");
    return res.status(400).json({ error: "Missing widget token" });
  }

  try {
    const origin = req.headers.origin || "";
    console.log("🔍 widget-bootstrap hit", {
      widgetToken,
      origin,
    });

    // 1) Look up store by token
    const [stores] = await db.execute(
      "SELECT id, shop_domain, widget_token FROM stores WHERE widget_token = ? LIMIT 1",
      [widgetToken]
    );

    if (!stores.length) {
      console.warn("❌ widget-bootstrap: invalid token (no store found)", {
        widgetToken,
      });
      return res.status(403).json({ error: "Invalid widget token" });
    }

    const store = stores[0];
    const storeDomain = cleanDomain(store.shop_domain);
    console.log("🔍 widget-bootstrap store match", {
      shop_domain: store.shop_domain,
      storeDomain,
    });

    // 2) Validate Origin against store domain (if Origin header exists)
    if (origin) {
      const originHost = cleanDomain(origin);
      console.log("🔍 widget-bootstrap origin check", {
        origin,
        originHost,
        storeDomain,
      });

      if (originHost !== storeDomain) {
        console.warn(
          "⛔ widget-bootstrap: origin mismatch",
          "originHost=",
          originHost,
          "storeDomain=",
          storeDomain
        );
        return res
          .status(403)
          .json({ error: "Origin not allowed", originHost, storeDomain });
      }
    } else {
      console.log("ℹ️ widget-bootstrap: no Origin header present");
    }

    // 3) Fetch appearance settings for this store
    const [appearanceRows] = await db.execute(
      "SELECT * FROM chatbot_appearance WHERE store_url = ? LIMIT 1",
      [storeDomain]
    );

    const appearanceRow = appearanceRows.length ? appearanceRows[0] : {};
    console.log("🔍 widget-bootstrap appearance row found:", !!appearanceRows.length);

    // Safely parse conversation_starters if it's JSON
    let starters = ["Browse Products", "Track Order", "Support"];
    if (appearanceRow.conversation_starters) {
      try {
        const parsed = JSON.parse(appearanceRow.conversation_starters);
        if (Array.isArray(parsed) && parsed.length) {
          starters = parsed;
        }
      } catch (e) {
        console.warn(
          "⚠️ widget-bootstrap: invalid conversation_starters JSON, using default"
        );
      }
    }

    // 4) Return everything widget needs
    return res.json({
      storeUrl: store.shop_domain,
      widgetToken: store.widget_token,
      appearance: {
        primary_color: appearanceRow.primary_color || "#1d306d",
        button_bg_color:
          appearanceRow.button_bg_color || appearanceRow.primary_color || "#1d306d",
        button_text_color: appearanceRow.button_text_color || "#ffffff",
        button_shape: appearanceRow.button_shape || "circle",
        button_position: appearanceRow.button_position || "right",
        header_title: appearanceRow.header_title || "Quell AI",
        welcome_message:
          appearanceRow.welcome_message || "Hi! 👋 How can I help?",
        conversation_starters: starters,
        logo_url: appearanceRow.logo_url || "",
        show_logo: appearanceRow.show_logo === 1 || appearanceRow.show_logo === true,
      },
    });
  } catch (err) {
    console.error("❌ widget-bootstrap error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

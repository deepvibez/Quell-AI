(function () {
  if (window.QuellAI) return;

  class QuellAI {
    constructor() {
      this.iframe = null;
      this.button = null;
      this.isOpen = false;
      this.isExpanded = false;

      this.config = {
        widgetBaseUrl: import.meta.env.VITE_WIDGET_IFRAME_URL,
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
        webhookUrl: import.meta.env.VITE_WEBHOOK_URL,
        customerCheckWebhook: import.meta.env.VITE_CUSTOMER_CHECK_WEBHOOK,
        defaultGreeting: import.meta.env.VITE_DEFAULT_GREETING,
        primaryColor: import.meta.env.VITE_PRIMARY_COLOR,
      };

      this.scriptConfig = this._readConfigFromScript();

      this.appearanceSettings = null;
      this.widgetToken = this.scriptConfig.widgetToken || null;

      window.addEventListener("message", this._handleMessage.bind(this));
    }

    /* -----------------------------------------
       ONLY allow new secure URL: /widget.js/<token>
       Old ?shopUrl embedding is DISABLED
    ----------------------------------------- */
    _readConfigFromScript() {
      try {
        let script = document.currentScript;
        if (!script) {
          const scripts = document.getElementsByTagName("script");
          for (const s of scripts) {
            if (s.src && s.src.includes("widget.js")) {
              script = s;
              break;
            }
          }
        }
        if (!script || !script.src) return {};

        const url = new URL(script.src);

        // ✅ Only support /widget.js/<token>
        let widgetToken = null;
        const parts = url.pathname.split("/").filter(Boolean);
        const last = parts[parts.length - 1];
        if (last && last !== "widget.js") widgetToken = last;

        const cfg = {};
        if (widgetToken) cfg.widgetToken = widgetToken;

        return cfg;
      } catch (err) {
        console.warn("Error reading config from script:", err);
        return {};
      }
    }

    async init() {
      // 🔥 REQUIRE widgetToken — otherwise do NOT run widget
      if (!this.widgetToken) {
        console.error(
          'QuellAI Error: Missing widget token. Use <script src="https://.../widget.js/<TOKEN>"></script>'
        );
        return; // stop widget
      }

      // 🔥 Always bootstrap with token
      try {
        const resp = await fetch(
          `${this.config.apiBaseUrl}/api/widget-bootstrap/${encodeURIComponent(
            this.widgetToken
          )}`,
          { headers: { "ngrok-skip-browser-warning": "1" } }
        );

        if (!resp.ok) {
          console.error("QuellAI Bootstrap Error:", resp.status);
          return; // invalid token → widget won't load
        }

        const data = await resp.json();

        this.scriptConfig.storeUrl = data.storeUrl;
        this.widgetToken = data.widgetToken;
        this.appearanceSettings = data.appearance;
      } catch (err) {
        console.error("Bootstrap failed:", err);
        return;
      }

      this.finalConfig = {
        ...this.config,
        storeUrl: this.scriptConfig.storeUrl,
      };

      this._createButton();
      this._createIframe();
    }

    _handleMessage(event) {
      if (!event.data) return;
      if (event.data.type === "TOGGLE_EXPAND") {
        this.isExpanded = !!event.data.expanded;
        this._applyStyles();
      }
    }

    _applyStyles() {
      if (!this.iframe) return;

      const isLeft = this.appearanceSettings?.button_position === "left";

      const base = `
        border: none;
        z-index: 2147483647;
        display: ${this.isOpen ? "block" : "none"};
        background: transparent;
      `;

      if (this.isExpanded) {
        this.iframe.style.cssText = `
          ${base}
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100%; height: 100%;
          border-radius: 0;
        `;
        if (this.button) this.button.style.display = "none";
      } else {
        this.iframe.style.cssText = `
          ${base}
          position: fixed;
          bottom: 90px;
          ${isLeft ? "left: 20px" : "right: 20px"};
          width: 400px;
          height: 650px;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        if (this.button) this.button.style.display = "flex";
      }
    }

    _createButton() {
      const a = this.appearanceSettings || {};
      const bg =
        a.button_bg_color || a.primary_color || this.finalConfig.primaryColor;
      const text = a.button_text_color || "#ffffff";
      const isSquare = a.button_shape === "square";
      const isLeft = a.button_position === "left";

      const btn = document.createElement("button");
      btn.id = "quell-ai-toggle";
      btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        ${isLeft ? "left: 20px" : "right: 20px"};
        width: 60px;
        height: 60px;
        border-radius: ${isSquare ? "16px" : "50%"};
        background: ${bg};
        color: ${text};
        border: none;
        cursor: pointer;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      btn.innerHTML = `
        <svg width="28" height="28" fill="${text}" viewBox="0 0 24 24">
          <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      `;

      btn.onclick = () => this.toggle();
      document.body.appendChild(btn);
      this.button = btn;
    }

    _createIframe() {
      const iframe = document.createElement("iframe");
      iframe.id = "quell-ai-widget";

      const params = new URLSearchParams({
        webhookUrl: this.finalConfig.webhookUrl,
        customerCheckWebhook: this.finalConfig.customerCheckWebhook,
        storeUrl: this.finalConfig.storeUrl,
        apiBaseUrl: this.finalConfig.apiBaseUrl,
        widgetToken: this.widgetToken, // always required
      });

      // 🔥 Auto-login support from Shopify theme
      const customerData = window.QuellCustomer || null;
      if (customerData) {
        if (customerData.id) params.append("shopifyCustomerId", customerData.id);
        if (customerData.email)
          params.append("shopifyCustomerEmail", customerData.email);
        if (customerData.name)
          params.append("shopifyCustomerName", customerData.name);
      }

      iframe.src = `${this.finalConfig.widgetBaseUrl}/?${params.toString()}`;
      this.iframe = iframe;
      this._applyStyles();
      document.body.appendChild(iframe);
    }

    open() {
      this.isOpen = true;
      this._applyStyles();
    }
    close() {
      this.isOpen = false;
      this.isExpanded = false;
      this._applyStyles();
    }
    toggle() {
      this.isOpen ? this.close() : this.open();
    }
  }

  window.QuellAI = new QuellAI();
  window.QuellAI.init();
})();

import React, { useState, useEffect, useRef } from "react";
import ProductCarousel from "./ProductCarousel";
import "./ChatWidget.css";

/* =========================
   Helper chat blocks
   ========================= */

function ProductDetailsChatBlock({ product, storeUrl, primaryColor }) {
  if (!product) return null;

  const productLink =
    product.productUrl ||
    product.url ||
    (product.handle
      ? storeUrl
        ? `${storeUrl.replace(/\/$/, "")}/products/${product.handle}`
        : `/products/${product.handle}`
      : null);

  return (
    <div
      className="chat-details-block"
      role="group"
      aria-label={`Details for ${product.title}`}
    >
      <div className="details-title">{product.title}</div>
      <div className="chat-details-desc" style={{ marginTop: 6 }}>
        {product.description}
      </div>
      <div className="chat-details-price" style={{ marginTop: 8 }}>
        {product.price}
      </div>
      <div style={{ marginTop: 8 }}>
        <strong>Sizes:</strong>{" "}
        {Array.isArray(product["Sizes available"])
          ? product["Sizes available"].join(", ")
          : product.sizes
          ? product.sizes.join(", ")
          : "—"}
      </div>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {productLink && (
          <a
            href={productLink}
            target="_blank"
            rel="noopener noreferrer"
            className="modal-btn primary"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              textDecoration: "none",
              background: primaryColor,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            View on store
          </a>
        )}
      </div>
    </div>
  );
}

function AddToCartChatBlock({ product, primaryColor, onAddToCart }) {
  const sizes = product["Sizes available"] || product.sizes || [];
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setSelectedSize("");
    setQuantity(1);
  }, [product]);

  return (
    <div
      className="chat-cart-block"
      role="form"
      aria-label={`Add ${product.title} to cart`}
    >
      <div className="details-title">{product.title}</div>

      <div style={{ marginTop: 8 }}>
        <strong>Choose Size:</strong>
        <div className="size-btn-row">
          {sizes.length === 0 && (
            <div style={{ opacity: 0.6 }}>No sizes</div>
          )}
          {sizes.map((size) => (
            <button
              key={size}
              className={`size-btn ${selectedSize === size ? "selected" : ""}`}
              onClick={() => setSelectedSize(size)}
              style={{
                borderColor: primaryColor,
                color: selectedSize === size ? "#fff" : primaryColor,
                background: selectedSize === size ? primaryColor : "#fff",
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          margin: "12px 0",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <strong>Quantity:</strong>
        <div className="quantity-selector" style={{ maxWidth: 140 }}>
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
          <span style={{ minWidth: 28, textAlign: "center" }}>{quantity}</span>
          <button onClick={() => setQuantity((q) => q + 1)}>+</button>
        </div>
      </div>

      <button
        className="cart-confirm-btn"
        style={{
          background: primaryColor,
          color: "#fff",
          marginTop: 10,
        }}
        disabled={sizes.length > 0 && !selectedSize}
        onClick={() =>
          onAddToCart({
            title: product.title,
            selectedSize,
            quantity,
            handle: product.handle,
            productId: product.productId || product.id,
          })
        }
      >
        Add to Cart
      </button>
    </div>
  );
}

/* =========================
   Main ChatWidget component
   ========================= */

export default function ChatWidget() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [sessionId, setSessionId] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const [appearanceSettings, setAppearanceSettings] = useState({
    primary_color: "#1d306d",
    header_title: "Quell AI",
    welcome_message:
      "Hi! 👋 I am Quell, your personal shopping assistant. What are you looking for today?",
    conversation_starters: [
      "Browse Products",
      "Track My Order",
      "Customer Support",
    ],
    // NEW
    logo_url: "",
    show_logo: false,
  });

  const [loadingSettings, setLoadingSettings] = useState(true);

  const [detailStates, setDetailStates] = useState({});
  const [cartStates, setCartStates] = useState({});

  const lastOpenedDetailRef = useRef({ msgIdx: null, productIdx: null });
  const lastOpenedCartRef = useRef({ msgIdx: null, productIdx: null });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const storeUrlForAppearance = import.meta.env.VITE_SHOPIFY_STORE_URL;

  const urlParams = new URLSearchParams(window.location.search);
  const config = {
    webhookUrl: urlParams.get("webhookUrl") || import.meta.env.VITE_WEBHOOK_URL,
    customerCheckWebhook:
      urlParams.get("customerCheckWebhook") || import.meta.env.VITE_CUSTOMER_CHECK_WEBHOOK,
    storeUrl: urlParams.get("storeUrl") || "",
    apiBaseUrl: urlParams.get("apiBaseUrl") || import.meta.env.VITE_API_BASE_URL,
  };

  /* ========= Effects ========= */

  useEffect(() => {
    if (appearanceSettings && appearanceSettings.primary_color) {
      document.documentElement.style.setProperty(
        "--primary",
        appearanceSettings.primary_color
      );
    }
  }, [appearanceSettings.primary_color]);

  useEffect(() => {
    fetchAppearanceSettings();
    initializeSession();
    loadStoredData();
  }, []);

  const fetchAppearanceSettings = async () => {
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/appearance/${encodeURIComponent(
          storeUrlForAppearance
        )}`
      );

      if (response.ok) {
        const data = await response.json();

        let starters = ["Browse Products", "Track My Order", "Customer Support"];
        if (
          Array.isArray(data.conversation_starters) &&
          data.conversation_starters.length
        ) {
          starters = data.conversation_starters;
        }

        setAppearanceSettings((prev) => ({
          ...prev,
          primary_color: data.primary_color || prev.primary_color,
          header_title: data.header_title || prev.header_title,
          welcome_message: data.welcome_message || prev.welcome_message,
          conversation_starters: starters,
          logo_url: data.logo_url || prev.logo_url,
          show_logo:
            typeof data.show_logo === "boolean"
              ? data.show_logo
              : prev.show_logo,
        }));
      }
    } catch (e) {
      console.error("Failed to fetch appearance settings", e);
    } finally {
      setLoadingSettings(false);
    }
  };


  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const { msgIdx, productIdx } = lastOpenedDetailRef.current;
    if (msgIdx !== null && productIdx !== null) {
      setTimeout(() => {
        const el = document.getElementById(`details-${msgIdx}-${productIdx}`);
        if (el)
          el.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        lastOpenedDetailRef.current = {
          msgIdx: null,
          productIdx: null,
        };
      }, 140);
    }
  }, [detailStates]);

  useEffect(() => {
    const { msgIdx, productIdx } = lastOpenedCartRef.current;
    if (msgIdx !== null && productIdx !== null) {
      setTimeout(() => {
        const el = document.getElementById(`cart-${msgIdx}-${productIdx}`);
        if (el)
          el.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        lastOpenedCartRef.current = {
          msgIdx: null,
          productIdx: null,
        };
      }, 140);
    }
  }, [cartStates]);

  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem("chatbot-messages-history", JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === "SEND_MESSAGE") {
        setInput(event.data.message);
        setTimeout(() => sendMessage(event.data.message), 100);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  /* ========= Session & storage ========= */

  const initializeSession = () => {
    let currentSessionId = sessionStorage.getItem("chatbot-session-id");
    if (!currentSessionId) {
      currentSessionId =
        "session-" +
        Date.now() +
        "-" +
        Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem("chatbot-session-id", currentSessionId);
    }
    setSessionId(currentSessionId);
  };

  const loadStoredData = () => {
    const storedUserInfo = sessionStorage.getItem("chatbot-user-info");
    if (storedUserInfo) {
      try {
        const parsed = JSON.parse(storedUserInfo);
        setUserInfo(parsed);
        setChatStarted(true);
      } catch {}
    }

    const storedCustomerId = sessionStorage.getItem("shopify-customer-id");
    if (storedCustomerId) setCustomerId(storedCustomerId);

    const storedMessages = sessionStorage.getItem("chatbot-messages-history");
    if (storedMessages) {
      try {
        setMessages(JSON.parse(storedMessages));
      } catch {}
    }
  };

  /* ========= Handlers ========= */

  const handleStartChat = (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const email = e.target.email.value.trim();
    if (!name || !email) return;

    const info = { name, email };
    setUserInfo(info);
    sessionStorage.setItem("chatbot-user-info", JSON.stringify(info));
    setChatStarted(true);

    // store exactly one welcome message in messages[0]
    setMessages([
      {
        text: appearanceSettings.welcome_message,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  };

  const sendMessage = async (messageText = null) => {
    const textToSend = messageText || input.trim();
    if (!textToSend) return;

    setMessages((prev) => [
      ...prev,
      {
        text: textToSend,
        isUser: true,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    setIsTyping(true);

    try {
      const controller = new AbortController();
      const timeoutMs = 60000; // 60 seconds – increase this as you like

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat_message",
          store: config.storeUrl,
          customerId: customerId || "guest",
          message: textToSend,
          name: userInfo.name,
          email: userInfo.email,
          sessionId,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setIsTyping(false);

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await response.text();
          if (text) {
            try {
              const data = JSON.parse(text);

              if (data.reply) {
                setMessages((prev) => [
                  ...prev,
                  {
                    text: data.reply,
                    isUser: false,
                    timestamp: new Date(),
                  },
                ]);
              }

              if (data.checkoutUrl) {
                setMessages((prev) => [
                  ...prev,
                  {
                    text: data.checkoutUrl,
                    isUser: false,
                    isCheckout: true,
                    timestamp: new Date(),
                  },
                ]);
              }

              let products = data.products;
              if (products && !Array.isArray(products)) {
                products = Object.values(products);
              }

              if (products && products.length > 0) {
                setMessages((prev) => [
                  ...prev,
                  {
                    products,
                    isProducts: true,
                    timestamp: new Date(),
                  },
                ]);
              }
            } catch {
              setMessages((prev) => [
                ...prev,
                {
                  text: "Message received!",
                  isUser: false,
                  timestamp: new Date(),
                },
              ]);
            }
          }
        }
      }
    } catch (error) {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          text: "Sorry, could not connect. Please try again.",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleQuickAction = (starter) => {
    sendMessage(starter);
  };

  const handleClear = () => {
    setMessages([]);
    sessionStorage.removeItem("chatbot-messages-history");
    const newSessionId =
      "session-" +
      Date.now() +
      "-" +
      Math.random().toString(36).substr(2, 9);
    setSessionId(newSessionId);
    sessionStorage.setItem("chatbot-session-id", newSessionId);
    setMessages([
      {
        text: appearanceSettings.welcome_message,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  };

  const handleExpand = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    if (window.parent) {
      window.parent.postMessage(
        { type: "TOGGLE_EXPAND", expanded: newExpandedState },
        "*"
      );
    }
  };

  const handleAddToCart = async (productData, msgIdx = null, productIdx = null) => {
    const { title, selectedSize, quantity } = productData;

    // Build the text message in the format: ADD QUANTITY SIZE OF PRODUCT_NAME
    let message = `ADD ${quantity}`;
    if (selectedSize) {
      message += ` ${selectedSize}`;
    }
    message += ` OF ${title}`;

    // Show the message in the UI as a user message
    setMessages((prev) => [
      ...prev,
      {
        text: message,
        isUser: true,
        timestamp: new Date(),
      },
    ]);
    setIsTyping(true);

    try {
      const controller = new AbortController();
      const timeoutMs = 60000;

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      // Send as a regular chat_message, not add_to_cart
      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat_message",
          store: config.storeUrl,
          customerId: customerId || "guest",
          message,
          name: userInfo.name,
          email: userInfo.email,
          sessionId,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setIsTyping(false);

      if (response.ok) {
        const text = await response.text();
        if (text) {
          try {
            const data = JSON.parse(text);

            if (data.reply) {
              setMessages((prev) => [
                ...prev,
                {
                  text: data.reply,
                  isUser: false,
                  timestamp: new Date(),
                },
              ]);
            }

            if (data.checkoutUrl) {
              setMessages((prev) => [
                ...prev,
                {
                  text: data.checkoutUrl,
                  isUser: false,
                  isCheckout: true,
                  timestamp: new Date(),
                },
              ]);
            }

            let products = data.products;
            if (products && !Array.isArray(products)) {
              products = Object.values(products);
            }

            if (products && products.length > 0) {
              setMessages((prev) => [
                ...prev,
                {
                  products,
                  isProducts: true,
                  timestamp: new Date(),
                },
              ]);
            }
          } catch {
            setMessages((prev) => [
              ...prev,
              {
                text: "Message received!",
                isUser: false,
                timestamp: new Date(),
              },
            ]);
          }
        }
      }
    } catch (error) {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          text: "Could not add to cart. Please try again.",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      if (msgIdx !== null && productIdx !== null) {
        setCartStates((prev) => ({ ...prev, [msgIdx]: null }));
      }
    }
  };


  const toggleDetailBlock = (msgIdx, productIdx) => {
    setDetailStates((prev) => {
      const currently = prev[msgIdx];
      const next = currently === productIdx ? null : productIdx;
      return { ...prev, [msgIdx]: next };
    });
    setCartStates((prev) => ({ ...prev, [msgIdx]: null }));
    lastOpenedDetailRef.current = { msgIdx, productIdx };
  };

  const toggleCartBlock = (msgIdx, productIdx) => {
    setCartStates((prev) => {
      const currently = prev[msgIdx];
      const next = currently === productIdx ? null : productIdx;
      return { ...prev, [msgIdx]: next };
    });
    setDetailStates((prev) => ({ ...prev, [msgIdx]: null }));
    lastOpenedCartRef.current = { msgIdx, productIdx };
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ========= Render ========= */

  if (loadingSettings) {
    return (
      <div className="chat-widget">
        <div
          className="chat-header"
          style={{ background: appearanceSettings.primary_color }}
        >
          <div className="header-left">
            {appearanceSettings.show_logo && appearanceSettings.logo_url && (
              <img
                src={appearanceSettings.logo_url}
                alt={appearanceSettings.header_title}
                className="header-logo"
              />
            )}
            <span>{appearanceSettings.header_title}</span>
          </div>
        </div>

        <div
          className="chat-messages"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p style={{ marginTop: 12, color: "#666" }}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!chatStarted) {
    return (
      <div className="chat-widget">
        <div
          className="chat-header"
          style={{ background: appearanceSettings.primary_color }}
        >
          <div className="header-left">
            {appearanceSettings.show_logo && appearanceSettings.logo_url && (
              <img
                src={appearanceSettings.logo_url}
                alt={appearanceSettings.header_title}
                className="header-logo"
              />
            )}
            <span>{appearanceSettings.header_title}</span>
          </div>
        </div>

        <div className="chat-form-screen">
          <div className="form-container">
            <h3>Start Shopping</h3>
            <p>Tell us who you are so we can help better</p>
            <form onSubmit={handleStartChat} className="chat-form">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <button
                type="submit"
                className="form-submit"
                style={{
                  background: appearanceSettings.primary_color,
                }}
              >
                Start Chat
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-widget ${isExpanded ? "expanded" : ""}`}>
      <div
        className="chat-header"
        style={{ background: appearanceSettings.primary_color }}
      >
        <div className="header-left">
          {appearanceSettings.show_logo && appearanceSettings.logo_url && (
            <img
              src={appearanceSettings.logo_url}
              alt={appearanceSettings.header_title}
              className="header-logo"
            />
          )}
          <span>{appearanceSettings.header_title}</span>
        </div>
        <div className="header-actions">
          <button
            onClick={handleExpand}
            className="header-btn"
            aria-label="Expand"
          >
            ⤢
          </button>
          <button
            onClick={handleClear}
            className="header-btn"
            aria-label="Clear chat"
          >
            🗑
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {/* Render ALL messages (welcome comes from messages[0]) */}
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx}>
            {msg.isProducts ? (
              <>
                <ProductCarousel
                  products={msg.products}
                  primaryColor={appearanceSettings.primary_color}
                  onShowDetails={(productIdx) =>
                    toggleDetailBlock(msgIdx, productIdx)
                  }
                  detailsOpen={(() => {
                    const d = {};
                    if (detailStates[msgIdx] != null) {
                      d[detailStates[msgIdx]] = true;
                    }
                    return d;
                  })()}
                  onStartAddToCart={(productIdx) =>
                    toggleCartBlock(msgIdx, productIdx)
                  }
                  cartOpen={(() => {
                    const c = {};
                    if (cartStates[msgIdx] != null) {
                      c[cartStates[msgIdx]] = true;
                    }
                    return c;
                  })()}
                  storeUrl={config.storeUrl}
                />

                {detailStates[msgIdx] != null && (
                  <div
                    className="message bot"
                    key={`details-${msgIdx}-${detailStates[msgIdx]}`}
                    id={`details-${msgIdx}-${detailStates[msgIdx]}`}
                  >
                    <ProductDetailsChatBlock
                      product={msg.products[detailStates[msgIdx]]}
                      storeUrl={config.storeUrl}
                      primaryColor={appearanceSettings.primary_color}
                    />
                  </div>
                )}

                {cartStates[msgIdx] != null && (
                  <div
                    className="message bot"
                    key={`cart-${msgIdx}-${cartStates[msgIdx]}`}
                    id={`cart-${msgIdx}-${cartStates[msgIdx]}`}
                  >
                    <AddToCartChatBlock
                      product={msg.products[cartStates[msgIdx]]}
                      primaryColor={appearanceSettings.primary_color}
                      onAddToCart={(cartInfo) =>
                        handleAddToCart(
                          { ...msg.products[cartStates[msgIdx]], ...cartInfo },
                          msgIdx,
                          cartStates[msgIdx]
                        )
                      }
                    />
                  </div>
                )}
              </>
            ) : (
              <div
                className={`message ${msg.isUser ? "user" : "bot"} ${
                  msg.isCheckout ? "checkout" : ""
                }`}
                style={
                  msg.isUser
                    ? {
                        background: appearanceSettings.primary_color,
                      }
                    : {}
                }
              >
                {msg.isCheckout ? (
                  <a href={msg.text} target="_blank" rel="noopener noreferrer">
                    {msg.text}
                  </a>
                ) : (
                  msg.text
                )}
              </div>
            )}
          </div>
        ))}

        {/* QUICK ACTION BUTTONS – separate row, not inside a bubble.
           Show only right after the initial welcome (no user messages yet). */}
        {messages.length === 1 &&
          messages[0] &&
          !messages[0].isUser &&
          !messages[0].isProducts && (
            <div className="conversation-starters" style={{ marginTop: 12 }}>
              {appearanceSettings.conversation_starters.map((starter, idx) => (
                <button
                  key={idx}
                  className="starter-button"
                  onClick={() => handleQuickAction(starter)}
                  style={{
                    borderColor: appearanceSettings.primary_color,
                    color: appearanceSettings.primary_color,
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          )}

        {isTyping && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          rows={1}
        />
        <button
          onClick={() => sendMessage()}
          className="send-btn"
          style={{
            background: appearanceSettings.primary_color,
          }}
          disabled={!input.trim()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            width="20"
            height="20"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ChatWidget.jsx
import React, { useState, useEffect, useRef } from "react";
import ProductCarousel from "./ProductCarousel";
import "./ChatWidget.css";

// Markdown rendering imports
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw"; // optional: allows sanitized HTML inside markdown

const TICKET_REASONS = {
  "Order Issues": [
    "Where is my order?",
    "Order marked delivered but not received",
    "Missing items in package",
    "Received wrong item",
  ],
  "Returns & Refunds": [
    "I want to return an item",
    "Exchange for different size",
    "Refund status update",
    "Damaged or defective product",
  ],
  "Payment & Billing": [
    "Payment failed but money deducted",
    "Coupon code not working",
    "Request Invoice/Bill",
  ],
  "Account & Other": ["Login issues", "Update profile details", "Other inquiry"],
};

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
          {sizes.length === 0 && <div style={{ opacity: 0.6 }}>No sizes</div>}
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
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
            −
          </button>
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
            productUrl: product.productUrl || product.url || null,
          })
        }
      >
        Add to Cart
      </button>
    </div>
  );
}

export default function ChatWidget() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [sessionId, setSessionId] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cartID, setcartID] = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [cartQuantity, setCartQuantity] = useState(0);

  const [appearanceSettings, setAppearanceSettings] = useState({
    primary_color: "#1d306d",
    header_title: "Quell AI",
    welcome_message:
      "Hi! 👋 I am Quell, your personal shopping assistant. What are you looking for today?",
    conversation_starters: ["Browse Products", "Track My Order", "Customer Support"],
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

  const [isTicketFormOpen, setIsTicketFormOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketOrderId, setTicketOrderId] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const config = {
    webhookUrl: urlParams.get("webhookUrl") || import.meta.env.VITE_WEBHOOK_URL,
    customerCheckWebhook:
      urlParams.get("customerCheckWebhook") ||
      import.meta.env.VITE_CUSTOMER_CHECK_WEBHOOK,
    storeUrl: urlParams.get("storeUrl") || "",
    apiBaseUrl: urlParams.get("apiBaseUrl") || import.meta.env.VITE_API_BASE_URL,
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loadingSettings) return;
    if (messages && messages.length > 0) return;
    setMessages([
      {
        text: appearanceSettings.welcome_message || "Hi! How can I help?",
        isUser: false,
        timestamp: new Date(),
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingSettings, appearanceSettings, messages]);

  const fetchAppearanceSettings = async () => {
    if (!config.storeUrl) {
      setLoadingSettings(false);
      return;
    }

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/appearance/${encodeURIComponent(config.storeUrl)}`,
        {
          headers: {
            "ngrok-skip-browser-warning": "1",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        let starters = ["Browse Products", "Track My Order", "Customer Support"];
        if (Array.isArray(data.conversation_starters) && data.conversation_starters.length) {
          starters = data.conversation_starters;
        }

        setAppearanceSettings((prev) => ({
          ...prev,
          primary_color: data.primary_color || prev.primary_color,
          header_title: data.header_title || prev.header_title,
          welcome_message: data.welcome_message || prev.welcome_message,
          conversation_starters: starters,
          logo_url: data.logo_url || prev.logo_url,
          show_logo: typeof data.show_logo === "boolean" ? data.show_logo : prev.show_logo,
        }));
      }
    } catch (e) {
      setLoadingSettings(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeSession = () => {
    let currentSessionId = sessionStorage.getItem("chatbot-session-id");
    if (!currentSessionId) {
      currentSessionId =
        "session-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem("chatbot-session-id", currentSessionId);
    }
    setSessionId(currentSessionId);
  };

  const loadStoredData = () => {
    const passedShopifyId = urlParams.get("shopifyCustomerId");
    const passedShopifyEmail = urlParams.get("shopifyCustomerEmail");
    const passedShopifyName = urlParams.get("shopifyCustomerName");

    if (passedShopifyId) {
      setCustomerId(passedShopifyId);
      setUserInfo({
        name: passedShopifyName || "",
        email: passedShopifyEmail || "",
      });
      setIsLoggedIn(true);
      sessionStorage.setItem("shopify-customer-id", passedShopifyId);
      sessionStorage.setItem(
        "chatbot-user-info",
        JSON.stringify({
          name: passedShopifyName,
          email: passedShopifyEmail,
        })
      );
    } else {
      const storedUserInfo = sessionStorage.getItem("chatbot-user-info");
      const storedCustomerId = sessionStorage.getItem("shopify-customer-id");

      if (storedUserInfo && storedCustomerId) {
        try {
          const parsed = JSON.parse(storedUserInfo);
          setUserInfo(parsed);
          setCustomerId(storedCustomerId);
          setIsLoggedIn(true);
        } catch {}
      } else {
        setIsLoggedIn(false);
      }
    }

    const storedcartID = sessionStorage.getItem("shopify-cart-id");
    if (storedcartID) setcartID(storedcartID);

    const storedMessages = sessionStorage.getItem("chatbot-messages-history");
    if (storedMessages) {
      try {
        setMessages(JSON.parse(storedMessages));
      } catch {}
    }
  };

  const handleStartChat = (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const email = e.target.email.value.trim();
    if (!name || !email) return;

    const info = { name, email };
    setUserInfo(info);
    setIsLoggedIn(true);
    setCustomerId(email);

    sessionStorage.setItem("chatbot-user-info", JSON.stringify(info));
    sessionStorage.setItem("shopify-customer-id", email);

    setMessages([
      {
        text: appearanceSettings.welcome_message,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  };

  const openTicketForm = () => {
    if (!isLoggedIn) {
      const baseStore =
        config.storeUrl && config.storeUrl.startsWith("http")
          ? config.storeUrl
          : config.storeUrl
          ? `https://${config.storeUrl}`
          : "";
      const loginUrl = baseStore ? `${baseStore.replace(/\/$/, "")}/account/login` : "/account/login";

      setMessages((prev) => [
        ...prev,
        {
          text: "🔒 Please log in to your account to raise a support ticket.",
          isUser: false,
          timestamp: new Date(),
        },
      ]);

      if (loginUrl) {
        window.open(loginUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }
    setIsTicketFormOpen(true);
  };

  const closeTicketForm = () => {
    setIsTicketFormOpen(false);
  };

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!ticketSubject || !ticketDescription.trim()) return;

    if (!isLoggedIn || !customerId) {
      setMessages((prev) => [
        ...prev,
        {
          text: "You need to be logged in to raise a ticket.",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setIsSubmittingTicket(true);

    try {
      const ticketEndpoint = `${config.apiBaseUrl}/api/customer-tickets`;

      const response = await fetch(ticketEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "1",
        },
        body: JSON.stringify({
          store: config.storeUrl,
          customerId: customerId,
          name: userInfo.name || "Customer",
          email: userInfo.email || "",
          subject: ticketSubject,
          description: ticketDescription.trim(),
          orderId: ticketOrderId.trim() || null,
          sessionId,
          cartID,
          channel: "chatbot_widget",
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            text: `✅ Ticket Created: "${ticketSubject}". Our team will contact you at ${userInfo.email}.`,
            isUser: false,
            timestamp: new Date(),
          },
        ]);
        setTicketSubject("");
        setTicketDescription("");
        setTicketOrderId("");
        closeTicketForm();
      } else {
        throw new Error("Failed");
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          text: "⚠️ Sorry, we couldn't create the ticket right now. Please try again later.",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSubmittingTicket(false);
    }
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
      const timeoutMs = 60000;

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      const finalCustomerId = isLoggedIn && customerId ? customerId : `guest-${sessionId}`;

      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat_message",
          store: config.storeUrl,
          customerId: finalCustomerId,
          message: textToSend,
          name: userInfo.name || "Guest",
          email: userInfo.email || "",
          sessionId,
          cartID,
          timestamp: new Date().toISOString(),
          isGuest: !isLoggedIn,
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

            if (data.cartID) {
              setcartID(data.cartID);
              sessionStorage.setItem("shopify-cart-id", data.cartID);
            }

            if (data.checkoutUrl) {
              setCheckoutUrl(data.checkoutUrl);
            }
            if (typeof data.cartQuantity === "number") {
              setCartQuantity(data.cartQuantity);
            } else {
              setCartQuantity((prev) => prev + 0);
            }

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

            let products = data.products;
            if (products && !Array.isArray(products)) {
              products = Object.values(products);
            }

            if (products && products.length > 0) {
              const rawMap = sessionStorage.getItem("variant-map");
              const variantMap = rawMap ? JSON.parse(rawMap) : {};

              const enhancedProducts = products.map((p) => {
                const key =
                  p.productUrl || p.url || p.handle || p.productId || p.id || p.title;

                if (Array.isArray(p.Variants)) {
                  const sizeMap = {};
                  p.Variants.forEach((v) => {
                    if (v.Size && v.VariantID) {
                      sizeMap[v.Size] = v.VariantID;
                    }
                  });

                  if (Object.keys(sizeMap).length > 0 && key) {
                    variantMap[key] = sizeMap;
                  }

                  return {
                    ...p,
                    sizes: Object.keys(sizeMap),
                    "Sizes available": Object.keys(sizeMap),
                  };
                }
                return p;
              });

              sessionStorage.setItem("variant-map", JSON.stringify(variantMap));

              setMessages((prev) => [
                ...prev,
                {
                  products: enhancedProducts,
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
    sessionStorage.removeItem("shopify-cart-id");

    const passedShopifyId = urlParams.get("shopifyCustomerId");
    if (!passedShopifyId) {
      sessionStorage.removeItem("chatbot-user-info");
      sessionStorage.removeItem("shopify-customer-id");
      setIsLoggedIn(false);
      setUserInfo({ name: "", email: "" });
      setCustomerId(null);
    }

    setcartID(null);
    setCheckoutUrl(null);
    setCartQuantity(0);
    const newSessionId = "session-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
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
      window.parent.postMessage({ type: "TOGGLE_EXPAND", expanded: newExpandedState }, "*");
    }
  };

  const handleAddToCart = async (productData, msgIdx = null, productIdx = null) => {
    const { title, selectedSize, quantity } = productData;

    const rawMap = sessionStorage.getItem("variant-map");
    const variantMap = rawMap ? JSON.parse(rawMap) : {};

    const productKey =
      productData.productUrl ||
      productData.url ||
      productData.handle ||
      productData.productId ||
      productData.id ||
      title;

    const sizeMap = variantMap[productKey] || {};
    const productVariantId = selectedSize ? sizeMap[selectedSize] : null;

    let message = `ADD ${quantity}`;
    if (selectedSize) {
      message += ` ${selectedSize}`;
    }
    message += ` OF ${title}`;

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

      const finalCustomerId = isLoggedIn && customerId ? customerId : `guest-${sessionId}`;

      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat_message",
          store: config.storeUrl,
          customerId: finalCustomerId,
          message,
          name: userInfo.name || "Guest",
          email: userInfo.email || "",
          sessionId,
          cartID,
          productVariantId,
          quantity,
          size: selectedSize,
          timestamp: new Date().toISOString(),
          isGuest: !isLoggedIn,
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

            if (data.cartID) {
              setcartID(data.cartID);
              sessionStorage.setItem("shopify-cart-id", data.cartID);
            }

            if (data.checkoutUrl) {
              setCheckoutUrl(data.checkoutUrl);
            }
            if (typeof data.cartQuantity === "number") {
              setCartQuantity(data.cartQuantity);
            } else {
              setCartQuantity((prev) => prev + (quantity || 0));
            }

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

            let products = data.products;
            if (products && !Array.isArray(products)) {
              products = Object.values(products);
            }

            if (products && products.length > 0) {
              const rawMap2 = sessionStorage.getItem("variant-map");
              const variantMap2 = rawMap2 ? JSON.parse(rawMap2) : {};

              const enhancedProducts = products.map((p) => {
                const key =
                  p.productUrl || p.url || p.handle || p.productId || p.id || p.title;

                if (Array.isArray(p.Variants)) {
                  const sizeMap2 = {};
                  p.Variants.forEach((v) => {
                    if (v.Size && v.VariantID) {
                      sizeMap2[v.Size] = v.VariantID;
                    }
                  });

                  if (Object.keys(sizeMap2).length > 0 && key) {
                    variantMap2[key] = sizeMap2;
                  }

                  return {
                    ...p,
                    sizes: Object.keys(sizeMap2),
                    "Sizes available": Object.keys(sizeMap2),
                  };
                }
                return p;
              });

              sessionStorage.setItem("variant-map", JSON.stringify(variantMap2));

              setMessages((prev) => [
                ...prev,
                {
                  products: enhancedProducts,
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
    if (e.key === "Enter" && !e.shiftKey && !isTicketFormOpen) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loadingSettings) {
    return (
      <div className="chat-widget">
        <div className="chat-header" style={{ background: appearanceSettings.primary_color }}>
          <div className="header-left">
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-widget ${isExpanded ? "expanded" : ""}`}>
      <div className="chat-header" style={{ background: appearanceSettings.primary_color }}>
        <div className="header-left">
          {appearanceSettings.show_logo && appearanceSettings.logo_url && (
            <img
              src={appearanceSettings.logo_url}
              alt={appearanceSettings.header_title}
              className="header-logo"
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span>{appearanceSettings.header_title}</span>
            <span style={{ fontSize: "0.75rem", opacity: 0.85, fontWeight: 400 }}>
              {isLoggedIn ? (userInfo.name ? `Hi, ${userInfo.name}` : "Logged in") : "Guest"}
            </span>
          </div>
        </div>

        <div className="header-actions">
          {checkoutUrl && (
            <button
              type="button"
              onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}
              style={{
                background: "rgba(15, 23, 42, 0.2)",
                color: "#ffffff",
                borderRadius: 999,
                padding: "4px 10px",
                marginRight: 8,
                border: `1px solid ${appearanceSettings.primary_color}`,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cart{cartQuantity > 0 ? ` (${cartQuantity})` : ""}
            </button>
          )}

          <button
            type="button"
            onClick={openTicketForm}
            className="header-btn"
            aria-label="Raise a support ticket"
            title={isLoggedIn ? "Raise a support ticket" : "Log in to raise a ticket"}
          >
            Ticket
          </button>

          <button onClick={handleExpand} className="header-btn" aria-label="Expand">
            ⛶
          </button>

          <button onClick={handleClear} className="header-btn" aria-label="Clear chat">
            🗑
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx}>
            {msg.isProducts ? (
              <>
                <ProductCarousel
                  products={msg.products}
                  primaryColor={appearanceSettings.primary_color}
                  onShowDetails={(productIdx) => toggleDetailBlock(msgIdx, productIdx)}
                  detailsOpen={() => {
                    const d = {};
                    if (detailStates[msgIdx] != null) {
                      d[detailStates[msgIdx]] = true;
                    }
                    return d;
                  }}
                  onStartAddToCart={(productIdx) => toggleCartBlock(msgIdx, productIdx)}
                  cartOpen={() => {
                    const c = {};
                    if (cartStates[msgIdx] != null) {
                      c[cartStates[msgIdx]] = true;
                    }
                    return c;
                  }}
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
                          {
                            ...msg.products[cartStates[msgIdx]],
                            ...cartInfo,
                          },
                          msgIdx,
                          cartStates[msgIdx]
                        )
                      }
                    />
                  </div>
                )}
              </>
            ) : (
              // RENDER: user messages as plain text, bot messages as sanitized Markdown
              msg.isUser ? (
                <div
                  className={`message user`}
                  style={{ background: appearanceSettings.primary_color }}
                >
                  {msg.text}
                </div>
              ) : (
                <div className={`message bot`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize, rehypeRaw]}
                    components={{
                      a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer">
                          {props.children}
                        </a>
                      ),
                      code({ node, inline, className, children, ...props }) {
                        if (inline) {
                          return (
                            <code className="inline-code" {...props}>
                              {children}
                            </code>
                          );
                        }
                        return (
                          <pre className="code-block" {...props}>
                            <code>{String(children).replace(/\n$/, "")}</code>
                          </pre>
                        );
                      },
                    }}
                  >
                    {msg.text || ""}
                  </ReactMarkdown>
                </div>
              )
            )}
          </div>
        ))}

        {messages.length === 1 && messages[0] && !messages[0].isUser && !messages[0].isProducts && (
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

      <div className={`ticket-panel ${isTicketFormOpen ? "open" : ""}`}>
        <div className="ticket-panel-header">
          <h3>Raise a Support Ticket</h3>
          <button type="button" className="close-panel-btn" onClick={closeTicketForm}>
            ×
          </button>
        </div>

        <form className="ticket-form-content" onSubmit={handleSubmitTicket}>
          <div className="form-group">
            <label>I need help with...</label>
            <div className="select-wrapper">
              <select value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} required>
                <option value="">Select a topic</option>
                {Object.entries(TICKET_REASONS).map(([category, options]) => (
                  <optgroup label={category} key={category}>
                    {options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              Order ID <span className="optional">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="#1001"
              value={ticketOrderId}
              onChange={(e) => setTicketOrderId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              rows={3}
              placeholder="Please describe your issue in detail..."
              value={ticketDescription}
              onChange={(e) => setTicketDescription(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="ticket-submit-btn-large"
            style={{ background: appearanceSettings.primary_color }}
            disabled={isSubmittingTicket}
          >
            {isSubmittingTicket ? "Submitting..." : "Submit Ticket"}
          </button>
        </form>
      </div>

      {!isTicketFormOpen && (
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="20" height="20">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

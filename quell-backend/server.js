const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const shopifyRoutes = require('./routes/shopify');
const storesRoutes = require('./routes/stores');
const appearanceRoutes = require('./routes/appearance');
const chatRoutes = require("./routes/chat");
const inboxRoutes = require("./routes/inbox");
const analyticsRoutes = require("./routes/analytics");
const ticketRoutes = require('./routes/ticketRoutes');
const adminAnalyticsRoutes = require('./routes/adminAnalytics');
const customerTicketRoutes = require('./routes/customerTicketRoutes');
const widgetBootstrapRoutes = require('./routes/widgetBootstrap');

const db = require('./db');

const app = express();

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];

// dynamic cors db check
app.use(cors({
  origin: async function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

    try {
      let domainToCheck = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const [rows] = await db.execute(
        'SELECT id FROM stores WHERE shop_domain = ? LIMIT 1',
        [domainToCheck]
      );

      if (rows.length > 0) return callback(null, true);

      console.warn(`Blocked CORS request from: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    } catch (error) {
      console.error('CORS DB Error:', error);
      return callback(new Error('Internal Server Error during CORS check'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------
// Serve Swagger docs BEFORE domain lock / route-protection
// so docs and raw spec are publicly accessible for developers.
// docs.js should mount swagger at router root (see earlier snippet).
// ------------------------------------------------------------
app.use('/docs', require('./docs'));
console.log(`Docs mounted at /docs - open http://localhost:${process.env.PORT || 3000}/docs`);

// Optional: if you want request validation against openapi.yaml, enable this here
// const setupOpenApi = require('./validator-setup');
// setupOpenApi(app);

// basic request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// domain lock
app.use(async (req, res, next) => {
  try {
    // allow the widget bootstrap and docs/health to bypass domain lock
    if (req.path.startsWith('/api/widget-bootstrap') || req.path.startsWith('/docs') || req.path === '/openapi.json' || req.path === '/openapi.yaml' || req.path === '/' || req.path === '/health') {
      return next();
    }

    const origin = req.headers.origin;
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return next();
    }

    const originHost = new URL(origin).hostname.replace(/^www\./, "");

    const storeUrl =
      req.body?.store ||
      req.body?.storeUrl ||
      req.query?.storeUrl ||
      req.query?.shopUrl ||
      "";

    if (!storeUrl) {
      return res.status(403).json({ error: "storeUrl required" });
    }

    const cleanStore = storeUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');

    const [rows] = await db.execute(
      "SELECT shop_domain, widget_token FROM stores WHERE shop_domain = ? LIMIT 1",
      [cleanStore]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: "Store not registered" });
    }

    const store = rows[0];

    if (originHost !== cleanStore) {
      return res.status(403).json({ error: "Origin mismatch" });
    }

    const token =
      req.body?.widgetToken ||
      req.query?.widgetToken ||
      req.headers['x-widget-token'] ||
      "";

    if (!token || token !== store.widget_token) {
      return res.status(403).json({ error: "Invalid widget token" });
    }

    req.store = store;
    next();

  } catch (err) {
    console.error("Domain Lock Error:", err);
    res.status(403).json({ error: "Domain verification failed" });
  }
});

// routes
app.use('/api/auth', authRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/appearance', appearanceRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/inbox", inboxRoutes);
app.use("/analytics", analyticsRoutes);
app.use('/support', ticketRoutes);
app.use('/admin', adminAnalyticsRoutes);
app.use('/api', customerTicketRoutes);
app.use('/api/widget-bootstrap', widgetBootstrapRoutes);

// root and health
app.get('/', (req, res) => {
  res.json({
    name: 'Quell AI Backend',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Quell AI Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) =>
  res.status(404).json({ error: 'Endpoint not found', path: req.path })
);

// error handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// socket.io server
const http = require("http");
const { Server } = require("socket.io");
const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: async function (origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

      try {
        let domainToCheck = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const [rows] = await db.execute(
          'SELECT id FROM stores WHERE shop_domain = ? LIMIT 1',
          [domainToCheck]
        );

        if (rows.length > 0) return callback(null, true);

        return callback(new Error('Not allowed by Socket.IO CORS'));
      } catch (e) {
        console.error("Socket CORS DB Error:", e);
        return callback(new Error('Internal Server Error'));
      }
    }
  }
});

app.set("io", io);

// socket events
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_store", (payload) => {
    const storeUrl = payload?.storeUrl;
    if (storeUrl) socket.join(`store_${storeUrl}`);
  });

  socket.on("leave_store", (payload) => {
    const storeUrl = payload?.storeUrl;
    if (storeUrl) socket.leave(`store_${storeUrl}`);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});
httpServer.listen(PORT, () => {
  console.log('Quell AI Backend Started');
});

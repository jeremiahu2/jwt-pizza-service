const express = require('express');
const cors = require('cors');
const { authRouter, setAuthUser } = require('./routes/authRouter');
const franchiseRouter = require('./routes/franchiseRouter');
const orderRouter = require('./routes/orderRouter');
const userRouter = require('./routes/userRouter');
const version = require('./version.json');
const metrics = require('./metrics');
const config = require('./config');
const logger = require('./logger');
const app = express();

app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(setAuthUser);
app.use((req, res, next) => {
  logger.log("info", "HTTP request", {
    method: req.method,
    path: req.path,
    auth: !!req.headers.authorization,
  });
  res.on("finish", () => {
    logger.log("info", "HTTP response", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
    });
  });
  next();
});
app.use(metrics.requestTracker);
metrics.start();
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path} auth=${!!req.headers.authorization}`);
  res.on("finish", () => {
    console.log(`[RESPONSE] ${req.method} ${req.path} ${res.statusCode}`);
  });
  next();
});
app.use('/api/auth', authRouter);
app.use('/api/franchise', franchiseRouter);
app.use('/api/order', orderRouter);
app.use('/api/user', userRouter);

app.get('/', (req, res) => {
  console.log('[HTTP] GET /');
  res.json({ message: 'welcome to JWT Pizza', version: version.version });
});

app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ message: 'unknown endpoint' });
});

app.use((err, req, res, next) => {
  console.error("[ERROR]", {
    message: err.message,
    path: req.path,
    method: req.method,
  });
  res.status(err.statusCode ?? 500).json({
    message: err.message,
    stack: err.stack,
  });
});

module.exports = app;
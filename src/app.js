const express = require('express');
const cors = require('cors');
const { authRouter, setAuthUser } = require('./routes/authRouter');
const franchiseRouter = require('./routes/franchiseRouter');
const orderRouter = require('./routes/orderRouter');
const userRouter = require('./routes/userRouter');
const version = require('./version.json');
const metrics = require('./metrics');
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
  logger.log("http", "request", {
    method: req.method,
    path: req.path,
    auth: !!req.headers.authorization,
    body: req.method !== "GET" ? req.body : undefined,
  });
  const originalSend = res.send;
  res.send = function (data) {
    logger.log("http", "response", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      body: data,
    });
    return originalSend.call(this, data);
  };
  next();
});
app.use(metrics.requestTracker);
metrics.start();
app.use('/api/auth', authRouter);
app.use('/api/franchise', franchiseRouter);
app.use('/api/order', orderRouter);
app.use('/api/user', userRouter);

app.get('/', (req, res) => {
  res.json({ message: 'welcome to JWT Pizza', version: version.version });
});

app.use((req, res) => {
  logger.log("http", "404", { method: req.method, path: req.path });
  res.status(404).json({ message: 'unknown endpoint' });
});

app.use((err, req, res, next) => {
  logger.log("error", "unhandled_exception", {
    message: err.message,
    path: req.path,
    method: req.method,
  });
  console.error("[ERROR]", err);
  res.status(err.statusCode ?? 500).json({
    message: err.message,
    stack: err.stack,
  });
});

module.exports = app;
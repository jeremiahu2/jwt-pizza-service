const express = require('express');
const cors = require('cors');
const { authRouter, setAuthUser } = require('./routes/authRouter');
const franchiseRouter = require('./routes/franchiseRouter');
const orderRouter = require('./routes/orderRouter');
const userRouter = require('./routes/userRouter');
const version = require('./version.json');
const Metrics = require('./metrics');
const config = require('./config');
const app = express();
const metrics = new Metrics(config.metrics);

app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(setAuthUser);
app.use(metrics.requestTracker);
metrics.startPeriodicReporting(60000);
app.use('/api/auth', authRouter);
app.use('/api/franchise', franchiseRouter);
app.use('/api/order', orderRouter);
app.use('/api/user', userRouter);

app.get('/', (req, res) => {
  res.json({ message: 'welcome to JWT Pizza', version: version.version });
});

app.use((req, res) => {
  res.status(404).json({ message: 'unknown endpoint' });
});

app.use((err, req, res, next) => {
  res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
});

module.exports = app;
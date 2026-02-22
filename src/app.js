const express = require('express');
const cors = require('cors');
const { authRouter, setAuthUser } = require('./routes/authRouter');
const franchiseRouter = require('./routes/franchiseRouter');
const orderRouter = require('./routes/orderRouter');
const userRouter = require('./routes/userRouter');
const version = require('./version.json');
const app = express();

app.use(express.json());
app.post('/debug/seed-admin', async (req, res, next) => {
  try {
    const db = require('./database/database.js').DB;
    const bcrypt = require('bcrypt');
    const email = 'testAdmin@jwt.com';
    const password = 'admin';
    const hashedPassword = await bcrypt.hash(password, 10);
    const connection = await db.getConnection();
    const [users] = await connection.execute(
      'SELECT id FROM user WHERE email=?',
      [email]
    );
    let userId;
    if (users.length === 0) {
      const result = await connection.execute(
        'INSERT INTO user (name, email, password) VALUES (?, ?, ?)',
        ['Admin', email, hashedPassword]
      );
      userId = result[0].insertId;
    } else {
      userId = users[0].id;
    }
    await connection.execute(
      "INSERT INTO userRole (userId, role, objectId) VALUES (?, 'admin', 0) ON DUPLICATE KEY UPDATE role='admin'",
      [userId]
    );
    connection.end();
    res.json({ message: 'admin seeded' });
  } catch (err) {
    next(err);
  }
});
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT',  'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(setAuthUser);
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
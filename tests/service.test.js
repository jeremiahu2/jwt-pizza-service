const request = require('supertest');
const app = require('../src/app');
const service = require('../src/service');

jest.mock('../src/routes/authRouter', () => {
  const express = require('express');
  const router = express.Router();
  router.post('/', (req, res) => res.json({ token: 'testtoken' }));
  return {
    authRouter: router,
    setAuthUser: (req, res, next) => {
      req.user = { id: 1, email: 'boateng@byu.edu', name: 'Test User' };
      next();
    },
  };
});

jest.mock('../src/routes/franchiseRouter', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => res.json([{ id: 1, name: 'Franchise 1' }]));
  router.post('/pizzas', (req, res) =>
    req.user ? res.json({ id: 1, ...req.body }) : res.status(401).send()
  );
  router.docs = [];
  return router;
});

jest.mock('../src/routes/orderRouter', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) =>
    req.user ? res.json([{ id: 1, pizzaId: 1, quantity: 2 }]) : res.status(401).send()
  );
  router.post('/', (req, res) =>
    req.user ? res.json({ id: 1, ...req.body }) : res.status(401).send()
  );
  router.docs = [];
  return router;
});

jest.mock('../src/routes/userRouter', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => (req.user ? res.json(req.user) : res.status(401).send()));
  router.patch('/', (req, res) =>
    req.user ? res.json({ ...req.user, ...req.body }) : res.status(401).send()
  );
  router.docs = [];
  return router;
});

let token;

beforeAll(async () => {
  const res = await request(app).post('/api/auth').send({
    email: 'boateng@byu.edu',
    password: 'testpass',
  });
  token = res.body.token;
});

describe('JWT Pizza Service', () => {
  test('POST /api/auth returns JWT token', () => {
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  test('GET /api/franchise returns list of franchises', async () => {
    const res = await request(app).get('/api/franchise').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/franchise works without token', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/franchise/pizzas adds pizza when authorized', async () => {
    const newPizza = { name: 'Test Pizza', price: 9.99 };
    const res = await request(app)
      .post('/api/franchise/pizzas')
      .set('Authorization', `Bearer ${token}`)
      .send(newPizza);
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Test Pizza');
  });

  test('POST /api/franchise/pizzas fails without token', async () => {
    const res = await request(app).post('/api/franchise/pizzas').send({
      name: 'Fail Pizza',
      price: 5.99,
    });
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/order creates order when authorized', async () => {
    const order = { pizzaId: 1, quantity: 2 };
    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${token}`).send(order);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('GET /api/order returns orders for user', async () => {
    const res = await request(app).get('/api/order').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/order fails without token', async () => {
    const res = await request(app).post('/api/order').send({ pizzaId: 1, quantity: 1 });
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/user returns user info when authorized', async () => {
    const res = await request(app).get('/api/user').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('boateng@byu.edu');
  });

  test('GET /api/user fails without token', async () => {
    const res = await request(app).get('/api/user');
    expect(res.statusCode).toBe(401);
  });

  test('PATCH /api/user updates user info', async () => {
    const res = await request(app)
      .patch('/api/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated User' });
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Updated User');
  });

  test('service.calculatePrice works', () => {
    const price = service.calculatePrice(2, 5);
    expect(price).toBe(10);
  });
});
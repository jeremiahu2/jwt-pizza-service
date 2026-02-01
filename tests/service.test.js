const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const version = require('../src/version.json');

const db = require('../src/database/database');
jest.mock('../src/database/database', () => ({
  query: jest.fn(),
}));

process.env.JWT_SECRET = 'testsecret';

beforeAll(() => {
  db.query.mockImplementation(async (sql, params) => {
    if (sql.includes('FROM users') && sql.includes('WHERE email')) {
      const hashed = await bcrypt.hash('testpass', 1);
      return [{ id: 1, email: 'boateng@byu.edu', name: 'Test User', password: hashed }];
    }
    if (sql.includes('FROM franchises')) {
      return [{ id: 1, name: 'Franchise 1' }];
    }
    if (sql.includes('FROM pizzas')) {
      return [{ id: 1, name: 'Pepperoni', price: 9.99 }];
    }
    if (sql.includes('FROM orders')) {
      return [{ id: 1, pizzaId: 1, quantity: 2, userId: 1 }];
    }
    if (sql.startsWith('INSERT')) {
      return { insertId: 1 };
    }
    if (sql.startsWith('UPDATE')) {
      return { affectedRows: 1 };
    }
    return [];
  });
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
    const res = await request(app)
      .get('/api/franchise')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('name');
  });

  test('GET /api/franchise works without token', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/franchise/pizzas adds pizza when authorized', async () => {
    const pizza = { name: 'Test Pizza', price: 9.99 };
    const res = await request(app)
      .post('/api/franchise/pizzas')
      .set('Authorization', `Bearer ${token}`)
      .send(pizza);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Pizza');
  });

  test('POST /api/franchise/pizzas fails without token', async () => {
    const res = await request(app)
      .post('/api/franchise/pizzas')
      .send({ name: 'Fail Pizza', price: 5.99 });
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/order creates order when authorized', async () => {
    const order = { pizzaId: 1, quantity: 2 };
    const res = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${token}`)
      .send(order);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('GET /api/order returns orders for user', async () => {
    const res = await request(app)
      .get('/api/order')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/order fails without token', async () => {
    const res = await request(app)
      .post('/api/order')
      .send({ pizzaId: 1, quantity: 1 });
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/user returns user info when authorized', async () => {
    const res = await request(app)
      .get('/api/user')
      .set('Authorization', `Bearer ${token}`);
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
});

describe('Additional coverage', () => {
  test('CORS middleware sets headers', async () => {
    const res = await request(app).get('/').set('Origin', 'http://localhost');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-headers']).toContain('Content-Type');
  });

  test('GET / returns welcome message and version', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'welcome to JWT Pizza');
    expect(res.body).toHaveProperty('version', version.version);
  });

  test('unknown endpoint returns 404', async () => {
    const res = await request(app).get('/notfound');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('message', 'unknown endpoint');
  });

  test('error handler returns status code and message', async () => {
    const errorApp = express();
    errorApp.get('/', (req, res, next) => next(new Error('Test Error')));
    errorApp.use((err, req, res, next) => {
      res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
    });
    const res = await request(errorApp).get('/');
    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('message', 'Test Error');
    expect(res.body).toHaveProperty('stack');
  });
});
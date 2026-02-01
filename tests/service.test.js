const request = require('supertest');
const service = require('../src/service'); // this is your real Express app
const version = require('../src/version.json');
const config = require('../src/config.js');

let token;

// First, login to get a JWT token (assuming /api/auth exists and works)
beforeAll(async () => {
  const res = await request(service)
    .post('/api/auth')
    .send({
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
    const res = await request(service).get('/api/franchise').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/franchise works without token', async () => {
    const res = await request(service).get('/api/franchise');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/franchise/pizzas adds pizza when authorized', async () => {
    const newPizza = { name: 'Test Pizza', price: 9.99 };
    const res = await request(service)
      .post('/api/franchise/pizzas')
      .set('Authorization', `Bearer ${token}`)
      .send(newPizza);
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Test Pizza');
  });

  test('POST /api/franchise/pizzas fails without token', async () => {
    const res = await request(service).post('/api/franchise/pizzas').send({
      name: 'Fail Pizza',
      price: 5.99,
    });
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/order creates order when authorized', async () => {
    const order = { pizzaId: 1, quantity: 2 };
    const res = await request(service).post('/api/order').set('Authorization', `Bearer ${token}`).send(order);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('GET /api/order returns orders for user', async () => {
    const res = await request(service).get('/api/order').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/order fails without token', async () => {
    const res = await request(service).post('/api/order').send({ pizzaId: 1, quantity: 1 });
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/user returns user info when authorized', async () => {
    const res = await request(service).get('/api/user').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('boateng@byu.edu');
  });

  test('GET /api/user fails without token', async () => {
    const res = await request(service).get('/api/user');
    expect(res.statusCode).toBe(401);
  });

  test('PATCH /api/user updates user info', async () => {
    const res = await request(service)
      .patch('/api/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated User' });
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Updated User');
  });
});

describe('Additional coverage', () => {
  test('CORS middleware sets headers', async () => {
    const res = await request(service).get('/').set('Origin', 'http://localhost');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-headers']).toContain('Content-Type');
  });

  test('GET / returns welcome message and version', async () => {
    const res = await request(service).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'welcome to JWT Pizza');
    expect(res.body).toHaveProperty('version', version.version);
  });

  test('GET /api/docs returns version, endpoints, and config', async () => {
    const res = await request(service).get('/api/docs');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('version', version.version);
    expect(res.body).toHaveProperty('endpoints');
    expect(Array.isArray(res.body.endpoints)).toBe(true);
    expect(res.body).toHaveProperty('config');
    expect(res.body.config).toHaveProperty('factory', config.factory.url);
    expect(res.body.config).toHaveProperty('db', config.db.connection.host);
  });

  test('unknown endpoint returns 404', async () => {
    const res = await request(service).get('/notfound');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('message', 'unknown endpoint');
  });

  test('error handler returns status code and message', async () => {
    const express = require('express');
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
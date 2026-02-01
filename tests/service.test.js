const request = require('supertest');
const app = require('../src/app');
const db = require('../src/database/dbModel');
const service = require('../src/service/service');

let token;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth')
    .send({ email: 'boateng@byu.edu', password: 'testpass' });
  token = res.body.token;
});

describe('JWT Pizza Service', () => {
  test('POST /api/auth returns JWT token', async () => {
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  test('GET /api/franchise returns list of franchises when authorized', async () => {
    const res = await request(app)
      .get('/api/franchise')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/franchise works without token', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.statusCode).toBe(200);
  });

  // ----- Pizza tests -----
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
});

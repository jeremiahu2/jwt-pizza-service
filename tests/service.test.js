const request = require('supertest');
const app = require('../src/service');

describe('JWT Pizza Service', () => {
  let token;
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ netId: process.env.NET_ID });
    token = res.body.authorization;
  });

  test('POST /auth/login should return JWT token', async () => {
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  test('GET /franchise/pizzas should return a list of pizzas', async () => {
    const res = await request(app)
      .get('/api/franchise/pizzas')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /franchise/pizzas should add a pizza when authorized', async () => {
    const newPizza = { name: 'Pepperoni', size: 'Large' };
    const res = await request(app)
      .post('/api/franchise/pizzas')
      .set('Authorization', `Bearer ${token}`)
      .send(newPizza);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Pepperoni' })])
    );
  });

  test('POST /franchise/pizzas should fail without token', async () => {
    const newPizza = { name: 'Margherita', size: 'Medium' };
    const res = await request(app)
      .post('/api/franchise/pizzas')
      .send(newPizza);
    expect(res.statusCode).toBe(401);
  });
});
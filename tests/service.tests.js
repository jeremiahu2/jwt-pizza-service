const request = require('supertest');
const app = require('../src/service');

describe('JWT Pizza Service', () => {
  test('POST /login should return JWT token', async () => {
    const res = await request(app).post('/login');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('authorization');
    expect(typeof res.body.authorization).toBe('string');
  });
});

test('GET /pizzas should return a list of pizzas', async () => {
  const res = await request(app).get('/pizzas');
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});
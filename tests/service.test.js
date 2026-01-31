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

test('POST /pizzas should add a pizza when authorized', async () => {
  const loginRes = await request(app).post('/login');
  const token = loginRes.body.authorization;
  const newPizza = { name: 'Pepperoni', size: 'Large' };
  const res = await request(app)
    .post('/pizzas')
    .set('Authorization', `Bearer ${token}`)
    .send(newPizza);
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'Pepperoni' })])
  );
});

test('POST /pizzas should fail without token', async () => {
  const newPizza = { name: 'Margherita', size: 'Medium' };
  const res = await request(app)
    .post('/pizzas')
    .send(newPizza);
  expect(res.statusCode).toBe(401);
});
console.log('NET_ID:', process.env.NET_ID);
console.log('FACTORY_API_KEY:', process.env.FACTORY_API_KEY);

const request = require('supertest');
const app = require('../src/service');
let token;

describe('JWT Pizza Service', () => {
  beforeAll(async () => {
  const res = await request(app)
    .put('/api/auth')
    .set(
      'Authorization',
      `Bearer ${process.env.NET_ID}:${process.env.FACTORY_API_KEY}`
    );
  console.log('Login response:', res.body);
  token = res.body.authorization;
});

  test('POST /api/auth should return JWT token', () => {
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  test('GET /api/franchise/pizzas should return a list of pizzas', async () => {
    const res = await request(app)
      .get('/api/franchise/pizzas')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/franchise/pizzas should add a pizza when authorized', async () => {
    const newPizza = { name: 'Pepperoni', size: 'Large' };
    const res = await request(app)
      .post('/api/franchise/pizzas')
      .set('Authorization', `Bearer ${token}`)
      .send(newPizza);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Pepperoni' })
      ])
    );
  });

  test('POST /api/franchise/pizzas should fail without token', async () => {
    const newPizza = { name: 'Margherita', size: 'Medium' };
    const res = await request(app)
      .post('/api/franchise/pizzas')
      .send(newPizza);
    expect(res.statusCode).toBe(401);
  });
});
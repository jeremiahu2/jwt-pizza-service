const request = require('supertest');
const app = require('../src/service');
let token;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth')
    .send({
      name: 'Test User',
      email: process.env.NET_ID,
      password: process.env.FACTORY_API_KEY,
    });
  console.log('Login response:', res.body);
  token = res.body.token;
});

describe('JWT Pizza Service', () => {
  test('POST /api/auth returns JWT token', () => {
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  test('GET /api/franchise returns list of franchises when authorized', async () => {
    const res = await request(app)
    .get('/api/franchise')
    .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.franchises).toBeDefined();
    expect(Array.isArray(res.body.franchises)).toBe(true);
  });

  test('GET /api/franchise works without token', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.statusCode).toBe(200);
  });

});
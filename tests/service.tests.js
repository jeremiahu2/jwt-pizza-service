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
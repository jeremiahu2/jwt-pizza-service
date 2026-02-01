const request = require('supertest');
const app = require('../src/app');

let token;
let user;

describe('JWT Pizza Service – Integration Tests', () => {
  const testUser = {
    name: 'Service Tester',
    email: `tester${Date.now()}@jwt.com`,
    password: 'testpassword',
  };

  test('GET / returns welcome message and version', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('welcome to JWT Pizza');
    expect(res.body.version).toBeDefined();
  });

  test('Unknown endpoint returns 404', async () => {
    const res = await request(app).get('/not-a-real-route');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('unknown endpoint');
  });

  test('Register a new user', async () => {
    const res = await request(app)
      .post('/api/auth')
      .send(testUser);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
    user = res.body.user;
  });

  test('Login an existing user', async () => {
    const res = await request(app)
      .put('/api/auth')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('Reject logout without authentication', async () => {
    const res = await request(app).delete('/api/auth');
    expect(res.status).toBe(401);
  });

  test('Logout authenticated user', async () => {
    const res = await request(app)
      .delete('/api/auth')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('logout successful');
  });

  test('Menu is publicly accessible', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Orders require authentication', async () => {
    const res = await request(app).get('/api/order');
    expect(res.status).toBe(401);
  });

  test('Authenticated user can get orders', async () => {
    const res = await request(app)
      .get('/api/order')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toBeDefined();
  });

  test('Authenticated user can create an order', async () => {
    const menuRes = await request(app).get('/api/order/menu');
    expect(menuRes.body.length).toBeGreaterThan(0);
    const item = menuRes.body[0];
    const res = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${token}`)
      .send({
        franchiseId: 1,
        storeId: 1,
        items: [
          {
            menuId: item.id,
            description: item.title,
            price: item.price,
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.order).toBeDefined();
    expect(res.body.jwt).toBeDefined();
  });
});
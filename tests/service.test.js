const request = require('supertest');
const app = require('../src/app');

let token;
let user;
let adminToken;
let adminUser;

describe('JWT Pizza Service – Integration Tests', () => {
  const testUser = {
    name: 'Service Tester',
    email: `tester${Date.now()}@jwt.com`,
    password: 'testpassword',
  };

  const adminTestUser = {
    name: 'Admin Tester',
    email: `admin${Date.now()}@jwt.com`,
    password: 'adminpassword',
    roles: ['admin'],
  };

  test('Register normal user', async () => {
    const res = await request(app).post('/api/auth').send(testUser);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    token = res.body.token;
    user = res.body.user;
  });

  test('Register admin user', async () => {
    const res = await request(app).post('/api/auth').send(adminTestUser);
    expect(res.status).toBe(200);
    adminToken = res.body.token;
    adminUser = res.body.user;
  });

  test('Fetch user profile', async () => {
    const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  test('Fetch profile without auth fails', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  test('Update user self', async () => {
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated Name');
  });

  test('Update another user fails without admin', async () => {
    const res = await request(app)
      .put(`/api/user/${adminUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hack Attempt' });
    expect(res.status).toBe(403);
  });

  test('Update another user succeeds with admin', async () => {
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin Update' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Admin Update');
  });

  test('List users returns array for admin', async () => {
    const res = await request(app).get('/api/user/').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  test('List users fails for normal user', async () => {
    const res = await request(app).get('/api/user/').set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });

  test('Delete user fails for normal user', async () => {
    const res = await request(app).delete(`/api/user/${user.id}`).set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });

  test('Delete user succeeds for admin', async () => {
    const res = await request(app).delete(`/api/user/${user.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('Franchise CRUD coverage', async () => {
    const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminToken}`).send({ name: 'New Franchise', admins: [adminUser.id] });
    expect(res.status).toBe(200);
    const resGet = await request(app).get('/api/franchise').set('Authorization', `Bearer ${adminToken}`);
    expect(resGet.status).toBe(200);
    expect(Array.isArray(resGet.body.franchises)).toBe(true);
    const resFail = await request(app).post('/api/franchise').set('Authorization', `Bearer ${token}`).send({ name: 'Fail Franchise', admins: [user.id] });
    expect([401, 403]).toContain(resFail.status);
  });
});
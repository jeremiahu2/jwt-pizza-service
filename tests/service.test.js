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
    token = res.body.token;
    user = res.body.user;
  });

  test('Register admin user', async () => {
    const res = await request(app).post('/api/auth').send(adminTestUser);
    expect(res.status).toBe(200);
    adminToken = res.body.token;
    adminUser = res.body.user;

    if (!adminUser.roles.includes('admin')) {
      await request(app)
        .put(`/api/user/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roles: ['admin'] });
      adminUser.roles = ['admin'];
    }
  });

  test('Update own user succeeds', async () => {
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated User' });

    console.log('Update own user response:', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated User');
  });

  test('Update another user fails without admin', async () => {
    const res = await request(app)
      .put(`/api/user/${adminUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hack Attempt' });

    console.log('Update another user without admin response:', res.status, res.body);
    expect(res.status).toBe(403);
  });

  test('Update another user succeeds with admin', async () => {
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin Updated' });

    console.log('Update another user with admin response:', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Admin Updated');
  });

  test('List users fails for normal user', async () => {
    const res = await request(app).get('/api/user/').set('Authorization', `Bearer ${token}`);
    console.log('List users for normal user response:', res.status, res.body);
    expect([401, 403]).toContain(res.status);
  });

  test('List users succeeds for admin', async () => {
    const res = await request(app).get('/api/user/').set('Authorization', `Bearer ${adminToken}`);
    console.log('List users for admin response:', res.status, res.body);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  test('Delete user fails for normal user', async () => {
    const res = await request(app).delete(`/api/user/${user.id}`).set('Authorization', `Bearer ${token}`);
    console.log('Delete user for normal user response:', res.status, res.body);
    expect([401, 403]).toContain(res.status);
  });

  test('Delete user succeeds for admin', async () => {
    const res = await request(app).delete(`/api/user/${user.id}`).set('Authorization', `Bearer ${adminToken}`);
    console.log('Delete user for admin response:', res.status, res.body);
    expect(res.status).toBe(200);
  });

  test('Non-admin cannot create a franchise', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unauthorized Pizza', admins: [{ id: user.id }] });
    console.log('Non-admin create franchise response:', res.status, res.body);
    expect([401, 403]).toContain(res.status);
  });

  test('Admin can create a franchise', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Authorized Pizza', admins: [{ id: adminUser.id }] });
    console.log('Admin create franchise response:', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.franchise).toBeDefined();
  });
});
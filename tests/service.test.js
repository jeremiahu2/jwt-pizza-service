const request = require('supertest');
const { DB: dbInstance } = require('../src/database/database');
const app = require('../src/app');
const { setAuth } = require('../src/routes/authRouter.js');

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

  test('Login existing user', async () => {
    const res = await request(app).put('/api/auth').send({
      email: testUser.email,
      password: testUser.password,
    });
    expect(res.status).toBe(200);
    token = res.body.token;
  });

  test('Logout without auth fails', async () => {
    const res = await request(app).delete('/api/auth');
    expect(res.status).toBe(401);
  });

  test('Logout authenticated user succeeds', async () => {
    const res = await request(app).delete('/api/auth').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('Login again after logout', async () => {
    const res = await request(app).put('/api/auth').send({
      email: testUser.email,
      password: testUser.password,
    });
    expect(res.status).toBe(200);
    token = res.body.token;
  });

  test('Menu is publicly accessible', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Orders require auth', async () => {
    const res = await request(app).get('/api/order');
    expect(res.status).toBe(401);
  });

  test('Authenticated user can get orders', async () => {
    const res = await request(app).get('/api/order').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toBeDefined();
  });

  test('Authenticated user can fetch their profile', async () => {
    const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  test('User profile requires authentication', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  test('Update another user fails without admin', async () => {
    const res = await request(app)
      .put(`/api/user/${adminUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hack Attempt' });
    expect(res.status).toBe(403);
  });

  test('List users fails for normal user', async () => {
    const res = await request(app).get('/api/user/').set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });

  test('Delete user fails for normal user', async () => {
    const res = await request(app).delete(`/api/user/${user.id}`).set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });

  test('Authenticated user can view franchises', async () => {
    const res = await request(app).get('/api/franchise').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.franchises)).toBe(true);
  });

  test('Non-admin cannot create a franchise', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unauthorized Pizza', admins: [{ id: user.id }] });
    expect([401, 403]).toContain(res.status);
  });

  test('franchise POST missing name field triggers 400/403 branch', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ admins: [{ id: adminUser.id }] });
    expect([400, 403]).toContain(res.status);
  });

  test('franchise POST invalid admin IDs triggers 400/403 branch', async () => {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Pizza', admins: [{ id: 999999 }] });
    expect([400, 403]).toContain(res.status);
  });

  test('franchise DELETE non-existent franchise triggers 403/404 branch', async () => {
    const res = await request(app)
      .delete('/api/franchise/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([403, 404]).toContain(res.status);
  });

  test('franchise DELETE store non-existent triggers 403/404 branch', async () => {
    const res = await request(app)
      .delete('/api/franchise/1/store/9999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([403, 404]).toContain(res.status);
  });

  test('franchise POST /store missing name triggers 400/403 branch', async () => {
    const res = await request(app)
      .post('/api/franchise/1/store')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect([400, 403]).toContain(res.status);
  });

  test('franchise POST store fails for non-admin', async () => {
    const res = await request(app)
      .post('/api/franchise/1/store')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unauthorized Store' });
    expect([401, 403]).toContain(res.status);
  });

  test('franchise DELETE franchise fails for non-admin', async () => {
    const res = await request(app)
      .delete('/api/franchise/1')
      .set('Authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });
});

describe('Database full line coverage', () => {
  test('getTokenSignature edge cases', () => {
    expect(dbInstance.getTokenSignature('a.b.c')).toBe('c');
    expect(dbInstance.getTokenSignature('a.b')).toBe('');
    expect(dbInstance.getTokenSignature('')).toBe('');
  });

  test('getID throws error when no record found', async () => {
    const connection = await dbInstance._getConnection();
    await expect(dbInstance.getID(connection, 'id', 999999999, 'user')).rejects.toThrow('No ID found');
    await connection.end();
  });

  test('getConnection returns a connection', async () => {
    const connection = await dbInstance.getConnection();
    expect(connection).toBeDefined();
    await connection.end();
  });

  test('query executes a SQL statement', async () => {
    const connection = await dbInstance._getConnection();
    const rows = await dbInstance.query(connection, 'SELECT 1 AS test');
    expect(rows[0].test).toBe(1);
    await connection.end();
  });

  test('createFranchise throws for unknown admin', async () => {
    await expect(
      dbInstance.createFranchise({ name: 'Fail Pizza', admins: [{ email: 'nonexistent@jwt.com' }] })
    ).rejects.toThrow('unknown user for franchise admin nonexistent@jwt.com provided');
  });

  test('deleteFranchise rollback path', async () => {
    const spy = jest.spyOn(dbInstance, 'query').mockImplementation(() => { throw new Error('force error'); });
    await expect(dbInstance.deleteFranchise(999999)).rejects.toThrow();
    spy.mockRestore();
  });

  test('getFranchises with authUser null path', async () => {
    const [franchises] = await dbInstance.getFranchises(null, 0, 1, '*');
    expect(Array.isArray(franchises)).toBe(true);
  });

  test('getUserFranchises returns empty when none', async () => {
    const result = await dbInstance.getUserFranchises(999999);
    expect(result).toEqual([]);
  });

  test('franchise route with malformed roles hits isAdmin guard', async () => {
  const res = await request(app)
    .get('/api/franchise')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Test-User-Roles', 'null');
    expect(res.status).toBe(403);
  });
});

describe('User Functionality', () => {
  test('list users unauthorized', async () => {
    const listUsersRes = await request(app).get('/api/user');
    expect(listUsersRes.status).toBe(401);
  });

test('list users non-admin', async () => {
  const [user, token] = await registerUser(request(app));
  const res = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + token);
  expect(res.status).toBe(403);
});

test('list users as admin', async () => {
  const admin = await dbInstance.addUser({
    name: 'admin',
    email: 'admin@test.com',
    password: 'a',
    roles: [{ role: 'admin' }],
  });
  const token = await setAuth(admin);
  const res = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + token);
  console.log(res.body);
  expect(res.status).toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;
  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}
});
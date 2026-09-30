'use strict';

/**
 * Route-level tests.
 *
 * The database is mocked so these run anywhere, including CI, without a live
 * PostgreSQL instance. Week 5 adds integration tests against a real test
 * database.
 */

jest.mock('../src/db/pool', () => ({
  pool: { end: jest.fn() },
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/db/pool');
const { hashPassword } = require('../src/utils/password');
const { signToken } = require('../src/utils/token');
const { ROLES } = require('../src/middleware/auth');

const adminRow = {
  id: 1,
  full_name: 'System Administrator',
  email: 'admin@tihama.test',
  role: ROLES.ADMIN,
  phone: null,
  is_active: true,
};

const supervisorRow = { ...adminRow, id: 2, role: ROLES.SUPERVISOR, email: 'sup@tihama.test' };

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/health', () => {
  test('reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/auth/login', () => {
  test('valid credentials return a token and a user without the hash', async () => {
    const password_hash = await hashPassword('ChangeMe123!');
    query.mockResolvedValueOnce({ rows: [{ ...adminRow, password_hash }] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tihama.test', password: 'ChangeMe123!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.role).toBe(ROLES.ADMIN);
    expect(res.body.user.password_hash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
  });

  test('a wrong password is rejected', async () => {
    const password_hash = await hashPassword('ChangeMe123!');
    query.mockResolvedValueOnce({ rows: [{ ...adminRow, password_hash }] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tihama.test', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  test('an unknown email gives the same message as a wrong password', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@tihama.test', password: 'whatever123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Incorrect email or password.');
  });

  test('a deactivated account cannot log in', async () => {
    const password_hash = await hashPassword('ChangeMe123!');
    query.mockResolvedValueOnce({ rows: [{ ...adminRow, is_active: false, password_hash }] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tihama.test', password: 'ChangeMe123!' });

    expect(res.status).toBe(401);
  });

  test('a malformed email is rejected before hitting the database', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'whatever123' });

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/me', () => {
  test('requires a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns the current user for a valid token', async () => {
    query.mockResolvedValueOnce({ rows: [adminRow] });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${signToken(adminRow)}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@tihama.test');
  });

  test('a token for a deactivated user is refused', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...adminRow, is_active: false }] });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${signToken(adminRow)}`);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/users', () => {
  test('an administrator can create a user', async () => {
    query
      .mockResolvedValueOnce({ rows: [adminRow] }) // requireAuth lookup
      .mockResolvedValueOnce({ rows: [{ ...supervisorRow, full_name: 'New Supervisor' }] });

    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${signToken(adminRow)}`)
      .send({
        fullName: 'New Supervisor',
        email: 'new@tihama.test',
        password: 'ChangeMe123!',
        role: ROLES.SUPERVISOR,
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe(ROLES.SUPERVISOR);
  });

  test('a site supervisor cannot create users', async () => {
    query.mockResolvedValueOnce({ rows: [supervisorRow] });

    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${signToken(supervisorRow)}`)
      .send({
        fullName: 'Sneaky Admin',
        email: 'sneaky@tihama.test',
        password: 'ChangeMe123!',
        role: ROLES.ADMIN,
      });

    expect(res.status).toBe(403);
  });

  test('a duplicate email returns 409', async () => {
    const duplicate = Object.assign(new Error('duplicate key'), { code: '23505' });
    query.mockResolvedValueOnce({ rows: [adminRow] }).mockRejectedValueOnce(duplicate);

    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${signToken(adminRow)}`)
      .send({
        fullName: 'Existing User',
        email: 'admin@tihama.test',
        password: 'ChangeMe123!',
        role: ROLES.SUPERVISOR,
      });

    expect(res.status).toBe(409);
  });

  test('an invalid role is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [adminRow] });

    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${signToken(adminRow)}`)
      .send({
        fullName: 'Bad Role',
        email: 'bad@tihama.test',
        password: 'ChangeMe123!',
        role: 'superuser',
      });

    expect(res.status).toBe(400);
  });

  test('a short password is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [adminRow] });

    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${signToken(adminRow)}`)
      .send({
        fullName: 'Weak Password',
        email: 'weak@tihama.test',
        password: 'short',
        role: ROLES.SUPERVISOR,
      });

    expect(res.status).toBe(400);
  });
});

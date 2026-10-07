'use strict';

jest.mock('../src/db/pool', () => {
  const query = jest.fn();
  return {
    pool: { end: jest.fn() },
    query,
    withTransaction: jest.fn(async (cb) => cb({ query })),
  };
});

const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/db/pool');
const { hashPassword } = require('../src/utils/password');
const { signToken } = require('../src/utils/token');
const { ROLES } = require('../src/constants/roles');

const CURRENT = 'OldPassword1!';
const NEXT = 'BrandNewPassword2!';

const base = {
  id: 1,
  full_name: 'Hassanat Bello',
  email: 'h@t.test',
  role: ROLES.ADMIN,
  phone: null,
  is_active: true,
  must_change_password: false,
  password_changed_at: new Date(Date.now() - 86400000),
};

const auth = (u) => `Bearer ${signToken(u)}`;

let hash;
beforeAll(async () => {
  hash = await hashPassword(CURRENT);
});

beforeEach(() => query.mockReset());

describe('POST /api/auth/password', () => {
  test('changes the password and returns a fresh token', async () => {
    query
      .mockResolvedValueOnce({ rows: [base] })                       // requireAuth
      .mockResolvedValueOnce({ rows: [{ ...base, password_hash: hash }] }) // load for check
      .mockResolvedValueOnce({ rows: [{ ...base, must_change_password: false }] }); // update

    const res = await request(app)
      .post('/api/auth/password')
      .set('Authorization', auth(base))
      .send({ currentPassword: CURRENT, newPassword: NEXT });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.mustChangePassword).toBe(false);
    // The new hash must never travel back to the client.
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
  });

  test('the wrong current password is refused', async () => {
    query
      .mockResolvedValueOnce({ rows: [base] })
      .mockResolvedValueOnce({ rows: [{ ...base, password_hash: hash }] });

    const res = await request(app)
      .post('/api/auth/password')
      .set('Authorization', auth(base))
      .send({ currentPassword: 'not-the-password', newPassword: NEXT });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/not correct/i);
  });

  test('reusing the same password is refused', async () => {
    query
      .mockResolvedValueOnce({ rows: [base] })
      .mockResolvedValueOnce({ rows: [{ ...base, password_hash: hash }] });

    const res = await request(app)
      .post('/api/auth/password')
      .set('Authorization', auth(base))
      .send({ currentPassword: CURRENT, newPassword: CURRENT });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be different/i);
  });

  test('a short new password is refused before touching the database', async () => {
    query.mockResolvedValueOnce({ rows: [base] });

    const res = await request(app)
      .post('/api/auth/password')
      .set('Authorization', auth(base))
      .send({ currentPassword: CURRENT, newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1); // auth lookup only
  });

  test('changing a password requires being signed in', async () => {
    const res = await request(app)
      .post('/api/auth/password')
      .send({ currentPassword: CURRENT, newPassword: NEXT });

    expect(res.status).toBe(401);
  });
});

describe('sessions opened with the old password', () => {
  test('a token issued before the change is refused', async () => {
    // Token issued an hour ago; the password changed a minute ago.
    const oldToken = signToken(base);

    query.mockResolvedValueOnce({
      rows: [{ ...base, password_changed_at: new Date(Date.now() + 60000) }],
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/password was changed/i);
  });

  test('a token issued after the change still works', async () => {
    query.mockResolvedValueOnce({
      rows: [{ ...base, password_changed_at: new Date(Date.now() - 60000) }],
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', auth(base));

    expect(res.status).toBe(200);
  });

  test('a token signed in the same second as the change is not rejected', async () => {
    // The grace window exists for exactly this: NOW() has sub-second
    // precision, a token's iat does not.
    query.mockResolvedValueOnce({
      rows: [{ ...base, password_changed_at: new Date(Date.now() + 900) }],
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', auth(base));

    expect(res.status).toBe(200);
  });
});

describe('accounts created by an administrator', () => {
  const pending = { ...base, must_change_password: true };

  test('cannot use the rest of the application', async () => {
    query.mockResolvedValue({ rows: [pending] });

    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', auth(pending));

    expect(res.status).toBe(403);
    expect(res.body.mustChangePassword).toBe(true);
  });

  test('cannot reach the dashboard either', async () => {
    query.mockResolvedValue({ rows: [pending] });

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', auth(pending));

    expect(res.status).toBe(403);
  });

  test('can still read their own account, or there would be no way forward', async () => {
    query.mockResolvedValueOnce({ rows: [pending] });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', auth(pending));

    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  test('can change their password', async () => {
    query
      .mockResolvedValueOnce({ rows: [pending] })
      .mockResolvedValueOnce({ rows: [{ ...pending, password_hash: hash }] })
      .mockResolvedValueOnce({ rows: [{ ...pending, must_change_password: false }] });

    const res = await request(app)
      .post('/api/auth/password')
      .set('Authorization', auth(pending))
      .send({ currentPassword: CURRENT, newPassword: NEXT });

    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(false);
  });

  test('login reports the flag so the app can redirect', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...pending, password_hash: hash }] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'h@t.test', password: CURRENT });

    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });
});

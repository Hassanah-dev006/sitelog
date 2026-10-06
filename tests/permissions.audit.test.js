'use strict';

/**
 * Permission audit.
 *
 * Week 9's security review, written as a test rather than a document. Every
 * route is exercised with every role, and the expected outcome is declared
 * in one table below.
 *
 * A document goes stale the day after it is written. This fails the build
 * the moment a route's permissions drift, which is the point: the matrix
 * below is the specification, and the suite enforces it.
 */

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
const { signToken } = require('../src/utils/token');
const { ROLES } = require('../src/constants/roles');

const USERS = {
  [ROLES.SUPERVISOR]: {
    id: 3, full_name: 'Supervisor', email: 'sup@t.test',
    role: ROLES.SUPERVISOR, is_active: true,
  },
  [ROLES.MANAGER]: {
    id: 2, full_name: 'Manager', email: 'mgr@t.test',
    role: ROLES.MANAGER, is_active: true,
  },
  [ROLES.ADMIN]: {
    id: 1, full_name: 'Admin', email: 'admin@t.test',
    role: ROLES.ADMIN, is_active: true,
  },
};

const S = ROLES.SUPERVISOR;
const M = ROLES.MANAGER;
const A = ROLES.ADMIN;

/**
 * allowed — roles that must NOT receive 401 or 403.
 * Anonymous access must always be refused unless listed in PUBLIC.
 */
const MATRIX = [
  // Projects and sites
  { method: 'get',    path: '/api/projects',                      allowed: [M, A] },
  { method: 'post',   path: '/api/projects',                      allowed: [A] },
  { method: 'get',    path: '/api/projects/10',                   allowed: [M, A] },
  { method: 'patch',  path: '/api/projects/10',                   allowed: [A] },
  { method: 'get',    path: '/api/projects/10/sites',             allowed: [M, A] },
  { method: 'post',   path: '/api/projects/10/sites',             allowed: [A] },
  { method: 'get',    path: '/api/sites/100/supervisors',         allowed: [M, A] },
  { method: 'post',   path: '/api/sites/100/supervisors',         allowed: [A] },
  { method: 'delete', path: '/api/sites/100/supervisors/3',       allowed: [A] },

  // Reports — every signed-in role may reach these; what they see is
  // narrowed per site inside the handler and the SQL.
  { method: 'get',    path: '/api/reports',                       allowed: [S, M, A] },
  { method: 'get',    path: '/api/reports/500',                   allowed: [S, M, A] },
  { method: 'post',   path: '/api/reports',                       allowed: [S, M, A] },
  { method: 'post',   path: '/api/reports/500/photos',            allowed: [S, M, A] },

  // Dashboard and exports span every site.
  { method: 'get',    path: '/api/dashboard',                     allowed: [M, A] },
  { method: 'get',    path: '/api/dashboard/outstanding',         allowed: [M, A] },
  { method: 'get',    path: '/api/export/pdf?from=2026-10-01&to=2026-10-07',  allowed: [M, A] },
  { method: 'get',    path: '/api/export/xlsx?from=2026-10-01&to=2026-10-07', allowed: [M, A] },

  // Accounts
  { method: 'get',    path: '/api/auth/me',                       allowed: [S, M, A] },
  { method: 'post',   path: '/api/auth/users',                    allowed: [A] },
];

const PUBLIC = [
  { method: 'get',  path: '/api/health' },
  { method: 'post', path: '/api/auth/login' },
];

/**
 * The route is reached, so the handler runs against a mocked database. We
 * only assert on the permission outcome, never on the body — any status that
 * is not 401 or 403 means the guard let the request through.
 */
function mockAnyUser(user) {
  query.mockReset();
  query.mockImplementation(() => Promise.resolve({ rows: [user] }));
}

describe('permission audit', () => {
  describe.each(MATRIX)('$method $path', ({ method, path, allowed }) => {
    test('is refused without a token', async () => {
      query.mockReset();
      query.mockImplementation(() => Promise.resolve({ rows: [] }));

      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    });

    test.each(Object.keys(USERS))('%s', async (role) => {
      const user = USERS[role];
      mockAnyUser(user);

      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${signToken(user)}`)
        .send({});

      if (allowed.includes(role)) {
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(401);
      } else {
        expect(res.status).toBe(403);
      }
    });
  });

  describe.each(PUBLIC)('$method $path', ({ method, path }) => {
    test('is reachable without a token', async () => {
      query.mockReset();
      query.mockImplementation(() => Promise.resolve({ rows: [] }));

      const res = await request(app)[method](path).send({});
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});

describe('deactivated accounts', () => {
  test('lose access immediately, not at token expiry', async () => {
    const user = USERS[ROLES.ADMIN];
    query.mockReset();
    query.mockImplementation(() =>
      Promise.resolve({ rows: [{ ...user, is_active: false }] })
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(res.status).toBe(401);
  });
});

describe('token forgery', () => {
  test('a token signed with another secret is refused', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ sub: '1', role: ROLES.ADMIN }, 'wrong-secret');

    query.mockReset();
    query.mockImplementation(() => Promise.resolve({ rows: [USERS[ROLES.ADMIN]] }));

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  test('a role claim in the token cannot grant access the account lacks', async () => {
    const jwt = require('jsonwebtoken');
    const env = require('../src/config/env');

    // Correctly signed, but claims administrator for a supervisor account.
    const token = jwt.sign({ sub: '3', role: ROLES.ADMIN }, env.jwtSecret);

    query.mockReset();
    query.mockImplementation(() =>
      Promise.resolve({ rows: [USERS[ROLES.SUPERVISOR]] })
    );

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);

    // The role is read from the database, not from the token.
    expect(res.status).toBe(403);
  });
});

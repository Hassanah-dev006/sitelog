'use strict';

const { requireRole, ROLES } = require('../src/middleware/auth');

/** Minimal fake response that records what the middleware did. */
function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('role-based access control', () => {
  test('a permitted role passes through', () => {
    const req = { user: { role: ROLES.ADMIN } };
    const res = mockRes();
    const next = jest.fn();

    requireRole(ROLES.ADMIN)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  test('a forbidden role gets 403, not 401', () => {
    const req = { user: { role: ROLES.SUPERVISOR } };
    const res = mockRes();
    const next = jest.fn();

    requireRole(ROLES.ADMIN)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('an unauthenticated request gets 401', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    requireRole(ROLES.ADMIN)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('several roles can be allowed on one route', () => {
    const req = { user: { role: ROLES.MANAGER } };
    const res = mockRes();
    const next = jest.fn();

    requireRole(ROLES.ADMIN, ROLES.MANAGER)(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('a supervisor cannot reach a manager-or-admin route', () => {
    const req = { user: { role: ROLES.SUPERVISOR } };
    const res = mockRes();
    const next = jest.fn();

    requireRole(ROLES.ADMIN, ROLES.MANAGER)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('an unknown role is refused', () => {
    const req = { user: { role: 'superuser' } };
    const res = mockRes();
    const next = jest.fn();

    requireRole(ROLES.ADMIN)(req, res, next);

    expect(res.statusCode).toBe(403);
  });
});

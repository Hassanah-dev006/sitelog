'use strict';

const jwt = require('jsonwebtoken');
const { signToken, verifyToken, extractBearer } = require('../src/utils/token');
const env = require('../src/config/env');

const user = { id: 7, role: 'project_manager' };

describe('session tokens', () => {
  test('a signed token verifies and carries id and role', () => {
    const payload = verifyToken(signToken(user));
    expect(payload.sub).toBe('7');
    expect(payload.role).toBe('project_manager');
  });

  test('the token does not carry the password hash or email', () => {
    const payload = verifyToken(signToken({ ...user, password_hash: 'secret', email: 'a@b.c' }));
    expect(payload.password_hash).toBeUndefined();
    expect(payload.email).toBeUndefined();
  });

  test('a token signed with a different secret is rejected', () => {
    const forged = jwt.sign({ sub: '1', role: 'administrator' }, 'not-the-real-secret');
    expect(verifyToken(forged)).toBeNull();
  });

  test('an expired token is rejected', () => {
    const expired = jwt.sign({ sub: '1', role: 'administrator' }, env.jwtSecret, {
      expiresIn: '-1s',
    });
    expect(verifyToken(expired)).toBeNull();
  });

  test('malformed and missing tokens are rejected', () => {
    expect(verifyToken('not.a.token')).toBeNull();
    expect(verifyToken('')).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
  });

  test('bearer extraction handles present, absent and malformed headers', () => {
    expect(extractBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearer('bearer abc')).toBe('abc');
    expect(extractBearer('Basic abc')).toBeNull();
    expect(extractBearer(undefined)).toBeNull();
  });
});

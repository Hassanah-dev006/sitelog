'use strict';

const { hashPassword, verifyPassword } = require('../src/utils/password');

describe('password hashing', () => {
  test('a hash never contains the plain password', async () => {
    const hash = await hashPassword('CorrectHorse1!');
    expect(hash).not.toContain('CorrectHorse1!');
    expect(hash.length).toBeGreaterThan(30);
  });

  test('the same password hashes differently each time (salting)', async () => {
    const a = await hashPassword('CorrectHorse1!');
    const b = await hashPassword('CorrectHorse1!');
    expect(a).not.toEqual(b);
  });

  test('the correct password verifies', async () => {
    const hash = await hashPassword('CorrectHorse1!');
    await expect(verifyPassword('CorrectHorse1!', hash)).resolves.toBe(true);
  });

  test('a wrong password does not verify', async () => {
    const hash = await hashPassword('CorrectHorse1!');
    await expect(verifyPassword('wrongpassword', hash)).resolves.toBe(false);
  });

  test('verification returns false rather than throwing on junk input', async () => {
    await expect(verifyPassword(null, 'x')).resolves.toBe(false);
    await expect(verifyPassword('x', '')).resolves.toBe(false);
    await expect(verifyPassword('x', undefined)).resolves.toBe(false);
  });

  test('short passwords are rejected', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least 8/);
  });
});

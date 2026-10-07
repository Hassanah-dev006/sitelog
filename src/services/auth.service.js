'use strict';

const { query } = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/token');

/**
 * Authentication logic, kept separate from the HTTP layer so it can be
 * tested and reused without going through Express.
 */

/** Shape sent to the client. Never includes password_hash. */
function toPublicUser(row) {
  return {
    id: Number(row.id),
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone || null,
    isActive: row.is_active,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

/**
 * An administrator creating an account knows its password, so the account
 * is flagged until the owner replaces it with one only they know.
 */
async function createUser({ fullName, email, password, role, phone = null }) {
  const passwordHash = await hashPassword(password);

  const { rows } = await query(
    `INSERT INTO users (full_name, email, password_hash, role, phone, must_change_password)
     VALUES ($1, LOWER($2), $3, $4, $5, TRUE)
     RETURNING id, full_name, email, role, phone, is_active, must_change_password`,
    [fullName, email, passwordHash, role, phone]
  );

  return toPublicUser(rows[0]);
}

/**
 * Replaces a password, having checked the current one.
 *
 * `password_changed_at` moves to now, which invalidates every token issued
 * before this moment — including any session opened with the old password on
 * someone else's device. A fresh token is returned so the person changing it
 * stays signed in.
 */
async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await query(
    `SELECT id, full_name, email, password_hash, role, phone, is_active
     FROM users WHERE id = $1`,
    [userId]
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: 'not_found' };

  const correct = await verifyPassword(currentPassword, row.password_hash);
  if (!correct) return { ok: false, reason: 'wrong_password' };

  const sameAgain = await verifyPassword(newPassword, row.password_hash);
  if (sameAgain) return { ok: false, reason: 'unchanged' };

  const passwordHash = await hashPassword(newPassword);

  const updated = await query(
    `UPDATE users
     SET password_hash = $2,
         password_changed_at = NOW(),
         must_change_password = FALSE,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, full_name, email, role, phone, is_active, must_change_password`,
    [userId, passwordHash]
  );

  const user = updated.rows[0];
  return { ok: true, user: toPublicUser(user), token: signToken(user) };
}

/**
 * Returns { token, user } on success, or null on any failure.
 *
 * The caller must give the same message for "no such email" and "wrong
 * password". Telling them apart lets an attacker discover which accounts
 * exist.
 */
async function login({ email, password }) {
  const { rows } = await query(
    `SELECT id, full_name, email, password_hash, role, phone, is_active,
            must_change_password
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );

  const row = rows[0];
  if (!row) {
    // Still hash something so a missing account does not answer noticeably
    // faster than a wrong password (a timing side channel).
    await verifyPassword(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    return null;
  }

  if (!row.is_active) return null;

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;

  return { token: signToken(row), user: toPublicUser(row) };
}

async function findById(id) {
  const { rows } = await query(
    `SELECT id, full_name, email, role, phone, is_active, must_change_password
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ? toPublicUser(rows[0]) : null;
}

module.exports = { createUser, login, changePassword, findById, toPublicUser };

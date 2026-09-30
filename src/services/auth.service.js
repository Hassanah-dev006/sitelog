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
  };
}

async function createUser({ fullName, email, password, role, phone = null }) {
  const passwordHash = await hashPassword(password);

  const { rows } = await query(
    `INSERT INTO users (full_name, email, password_hash, role, phone)
     VALUES ($1, LOWER($2), $3, $4, $5)
     RETURNING id, full_name, email, role, phone, is_active`,
    [fullName, email, passwordHash, role, phone]
  );

  return toPublicUser(rows[0]);
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
    `SELECT id, full_name, email, password_hash, role, phone, is_active
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
    `SELECT id, full_name, email, role, phone, is_active FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ? toPublicUser(rows[0]) : null;
}

module.exports = { createUser, login, findById, toPublicUser };

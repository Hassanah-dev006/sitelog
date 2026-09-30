'use strict';

const bcrypt = require('bcryptjs');
const env = require('../config/env');

/**
 * Password hashing.
 *
 * Plain passwords are never stored and never logged. bcrypt salts each hash
 * automatically, so two users with the same password get different hashes.
 */

const MIN_LENGTH = 8;

function validateStrength(plain) {
  if (typeof plain !== 'string' || plain.length < MIN_LENGTH) {
    throw new Error(`Password must be at least ${MIN_LENGTH} characters.`);
  }
}

async function hashPassword(plain) {
  validateStrength(plain);
  return bcrypt.hash(plain, env.bcryptRounds);
}

/**
 * Returns true only if the password matches. Never throws on a wrong
 * password — a failed comparison is an expected outcome, not an error.
 */
async function verifyPassword(plain, hash) {
  if (typeof plain !== 'string' || typeof hash !== 'string' || hash === '') {
    return false;
  }
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, verifyPassword, MIN_LENGTH };

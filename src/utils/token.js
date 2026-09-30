'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Session tokens.
 *
 * The token carries only the user id and role. Anything else (name, email)
 * is looked up from the database, so a token cannot go stale and misreport
 * who someone is.
 */

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

/**
 * Returns the decoded payload, or null if the token is missing, malformed,
 * expired or signed with the wrong secret.
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}

/** Pull the token out of an `Authorization: Bearer <token>` header. */
function extractBearer(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

module.exports = { signToken, verifyToken, extractBearer };

'use strict';

const { verifyToken, extractBearer } = require('../utils/token');
const { query } = require('../db/pool');
const { ROLES } = require('../constants/roles');

/** Tolerance for clock rounding between NOW() and a token's whole-second iat. */
const GRACE_MS = 2000;

/**
 * Rejects the request unless it carries a valid token for an active user.
 * On success, attaches `req.user`.
 */
async function requireAuth(req, res, next) {
  const token = extractBearer(req.headers.authorization);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    // Look the user up every request: a deactivated account must lose access
    // immediately, not whenever their token happens to expire.
    const { rows } = await query(
      `SELECT id, full_name, email, role, is_active, must_change_password,
              password_changed_at
       FROM users WHERE id = $1`,
      [payload.sub]
    );
    const user = rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account is inactive or no longer exists.' });
    }

    // A token issued before the password changed belongs to a session opened
    // with the old password. Changing a password has to end those sessions,
    // or sharing a temporary password would grant access indefinitely.
    //
    // The grace window covers the sub-second gap between writing NOW() and
    // signing the replacement token, whose `iat` is whole seconds.
    if (user.password_changed_at && payload.iat) {
      const changedAt = new Date(user.password_changed_at).getTime();
      const issuedAt = payload.iat * 1000;

      if (issuedAt < changedAt - GRACE_MS) {
        return res.status(401).json({
          error: 'Your password was changed. Please sign in again.',
        });
      }
    }

    req.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      mustChangePassword: Boolean(user.must_change_password),
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Blocks everything except changing the password, for an account whose
 * password was set by someone else.
 */
function blockUntilPasswordChanged(req, res, next) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      error: 'Set your own password before using the application.',
      mustChangePassword: true,
    });
  }
  return next();
}

/**
 * Restricts a route to the given roles. Use after requireAuth.
 *
 *   router.post('/projects', requireAuth, requireRole(ROLES.ADMIN), handler)
 */
function requireRole(...allowed) {
  const permitted = allowed.flat();

  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!permitted.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, blockUntilPasswordChanged, ROLES };

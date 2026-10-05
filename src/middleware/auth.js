'use strict';

const { verifyToken, extractBearer } = require('../utils/token');
const { query } = require('../db/pool');
const { ROLES } = require('../constants/roles');

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
      'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account is inactive or no longer exists.' });
    }

    req.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    };
    return next();
  } catch (err) {
    return next(err);
  }
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

module.exports = { requireAuth, requireRole, ROLES };

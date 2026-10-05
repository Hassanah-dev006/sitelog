'use strict';

const { query } = require('../db/pool');
const { ROLES } = require('../constants/roles');

/**
 * Site-level access rules.
 *
 * Managers and administrators see every site. A site supervisor sees only the
 * sites they are assigned to, so these checks run on every report read and
 * write rather than being assumed from the role alone.
 */

function seesAllSites(user) {
  return user.role === ROLES.MANAGER || user.role === ROLES.ADMIN;
}

/** Site ids a supervisor is assigned to. */
async function assignedSiteIds(userId) {
  const { rows } = await query('SELECT site_id FROM site_assignments WHERE user_id = $1', [userId]);
  return rows.map((r) => Number(r.site_id));
}

async function canAccessSite(user, siteId) {
  if (seesAllSites(user)) return true;

  const { rows } = await query(
    'SELECT 1 FROM site_assignments WHERE user_id = $1 AND site_id = $2',
    [user.id, siteId]
  );
  return rows.length > 0;
}

module.exports = { seesAllSites, assignedSiteIds, canAccessSite };

'use strict';

const { pool, query, describeTarget } = require('../src/db/pool');
const { parseArgs } = require('./lib/prompt');

/**
 * Assigns or removes a site supervisor on an existing account.
 *
 * create-user can assign sites when it makes an account, but people move
 * between sites long after they are created, and a supervisor assigned to
 * nothing cannot file a report at all.
 *
 *   npm run assign-site -- --email them@example.com --site 1 --site 2
 *   npm run assign-site -- --email them@example.com --site 1 --remove
 *   npm run assign-site -- --email them@example.com          (just list)
 */
async function main() {
  console.log(`\nDatabase: ${describeTarget()}`);

  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    console.error('Missing required option: --email\n');
    console.error('Example:');
    console.error('  npm run assign-site -- --email them@example.com --site 1');
    process.exitCode = 1;
    return;
  }

  const found = await query(
    'SELECT id, full_name, email, role FROM users WHERE LOWER(email) = LOWER($1)',
    [args.email]
  );

  const user = found.rows[0];
  if (!user) {
    console.error(`No account found for ${args.email}.`);
    process.exitCode = 1;
    return;
  }

  if (user.role !== 'site_supervisor') {
    console.log(`\n${user.full_name} is a ${user.role}, who already sees every site.`);
    console.log('Site assignments only affect site supervisors.');
    return;
  }

  const siteIds = args.site.map(Number);
  const bad = args.site.find((_, i) => !Number.isInteger(siteIds[i]) || siteIds[i] < 1);

  if (bad !== undefined) {
    console.error(`--site expects a site id, not "${bad}".`);
    console.error('Run `npm run list-sites` to see the ids.');
    process.exitCode = 1;
    return;
  }

  for (const siteId of siteIds) {
    if (args.remove !== undefined) {
      const { rowCount } = await query(
        'DELETE FROM site_assignments WHERE user_id = $1 AND site_id = $2',
        [user.id, siteId]
      );
      console.log(rowCount ? `  removed from site ${siteId}` : `  was not on site ${siteId}`);
      continue;
    }

    const added = await query(
      `INSERT INTO site_assignments (user_id, site_id)
       SELECT $1, id FROM sites WHERE id = $2
       ON CONFLICT DO NOTHING
       RETURNING site_id`,
      [user.id, siteId]
    );

    if (added.rowCount === 0) {
      // Either the site does not exist, or they were already on it.
      const exists = await query('SELECT 1 FROM sites WHERE id = $1', [siteId]);
      console.log(exists.rowCount
        ? `  already on site ${siteId}`
        : `  site ${siteId} does not exist`);
    } else {
      console.log(`  assigned to site ${siteId}`);
    }
  }

  const current = await query(
    `SELECT s.id, s.name, p.name AS project_name
     FROM site_assignments a
     JOIN sites s    ON s.id = a.site_id
     JOIN projects p ON p.id = s.project_id
     WHERE a.user_id = $1
     ORDER BY p.name, s.name`,
    [user.id]
  );

  console.log(`\n${user.full_name} now covers:`);
  if (current.rows.length === 0) {
    console.log('  no sites — they cannot file a report until assigned one');
  } else {
    current.rows.forEach((r) => console.log(`  ${r.id}  ${r.name} (${r.project_name})`));
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

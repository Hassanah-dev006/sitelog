'use strict';

const { pool, query, describeTarget } = require('../src/db/pool');
const { hashPassword } = require('../src/utils/password');
const { ROLES, ALL_ROLES } = require('../src/constants/roles');
const { parseArgs, askPasswordTwice, generatePassword } = require('./lib/prompt');

async function main() {
  console.log(`\nDatabase: ${describeTarget()}`);
  const args = parseArgs(process.argv.slice(2));
  const missing = ['name', 'email', 'role'].filter((k) => !args[k]);

  if (missing.length) {
    console.error(`Missing required option(s): ${missing.map((m) => `--${m}`).join(', ')}\n`);
    console.error('Example:');
    console.error('  npm run create-user -- --name "Hassanat Bello" \\');
    console.error('    --email you@example.com --role administrator\n');
    console.error(`Roles: ${ALL_ROLES.join(' | ')}`);
    process.exitCode = 1;
    return;
  }

  if (!ALL_ROLES.includes(args.role)) {
    console.error(`Unknown role "${args.role}".`);
    console.error(`Roles: ${ALL_ROLES.join(' | ')}`);
    process.exitCode = 1;
    return;
  }

  if (args.site.length && args.role !== ROLES.SUPERVISOR) {
    console.error('Only a site_supervisor needs site assignments.');
    console.error('Managers and administrators already see every site.');
    process.exitCode = 1;
    return;
  }

  // --site is an id here. Reject anything that is not one rather than
  // letting it reach the database as NaN.
  const siteIds = args.site.map(Number);
  const badSite = args.site.find((_, i) => !Number.isInteger(siteIds[i]) || siteIds[i] < 1);

  if (badSite !== undefined) {
    console.error(`--site expects a site id, not "${badSite}".`);
    console.error('Run `npm run list-sites` to see the ids.');
    process.exitCode = 1;
    return;
  }

  let password;
  let generated = true;

  if (args.ask) {
    password = await askPasswordTwice();
    if (!password) return;
    generated = false;
  } else {
    password = generatePassword();
  }

  try {
    const passwordHash = await hashPassword(password);

    // Flagged, because you know this password. They must replace it with one
    // only they know before the account can be used for anything else.
    const { rows } = await query(
      `INSERT INTO users (full_name, email, password_hash, role, must_change_password)
       VALUES ($1, LOWER($2), $3, $4, TRUE)
       RETURNING id, full_name, email, role`,
      [args.name, args.email, passwordHash, args.role]
    );

    const user = rows[0];

    for (const siteId of siteIds) {
      const assigned = await query(
        `INSERT INTO site_assignments (user_id, site_id)
         SELECT $1, id FROM sites WHERE id = $2
         ON CONFLICT DO NOTHING
         RETURNING site_id`,
        [user.id, siteId]
      );

      if (assigned.rowCount === 0) {
        console.warn(`  warning: site ${siteId} not found, assignment skipped`);
      }
    }

    console.log(`\nCreated ${user.full_name} <${user.email}> as ${user.role}.`);

    if (siteIds.length) {
      console.log(`Assigned to site(s): ${siteIds.join(', ')}`);
    }

    if (generated) {
      console.log('\n  Temporary password: ' + password);
      console.log('\nShown once. Send it privately — not in the same message as the link.');
    } else {
      console.log('\nPassword set. It was never displayed or written to your shell history.');
    }

    console.log('They will be asked to choose their own password at first sign-in.');
  } catch (err) {
    if (err.code === '23505') {
      console.error(`An account already exists for ${args.email}.`);
      console.error('\nTo give it a new password instead:');
      console.error(`  npm run reset-password -- --email ${args.email} --ask`);
    } else {
      console.error(err.message);
    }
    process.exitCode = 1;
  }
}

main().finally(() => pool.end());

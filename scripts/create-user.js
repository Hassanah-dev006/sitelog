'use strict';

const crypto = require('crypto');
const { pool, query } = require('../src/db/pool');
const { hashPassword } = require('../src/utils/password');
const { ROLES, ALL_ROLES } = require('../src/constants/roles');

/**
 * Creates a real account from the command line.
 *
 * Every system needs a way to make the first administrator before anyone can
 * sign in to make one, and a way to add people during deployment. This is it.
 *
 *   npm run create-user -- --name "Full Name" --email a@b.com --role administrator
 *
 * Options:
 *   --name      required
 *   --email     required
 *   --role      site_supervisor | project_manager | administrator
 *   --password  optional; one is generated and printed if omitted
 *   --site      site id to assign (repeatable, site supervisors only)
 *
 * The password is printed once, here, on your own machine. It is never
 * emailed and never stored anywhere but as a hash. Send it to the person
 * through something private and have them change it.
 */

function parseArgs(argv) {
  const args = { site: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;

    const name = key.slice(2);
    const value = argv[i + 1];

    if (value === undefined || value.startsWith('--')) {
      console.error(`Missing value for --${name}`);
      process.exit(1);
    }

    if (name === 'site') args.site.push(Number(value));
    else args[name] = value;

    i += 1;
  }

  return args;
}

/** Readable but strong: no ambiguous characters to misread over the phone. */
function generatePassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 16)}`;
}

async function main() {
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

  const password = args.password || generatePassword();
  const generated = !args.password;

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

    for (const siteId of args.site) {
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

    if (args.site.length) {
      console.log(`Assigned to site(s): ${args.site.join(', ')}`);
    }

    console.log('\n  Temporary password: ' + password);
    console.log('\nShown once. Send it privately — not in the same message as the link.');
    console.log('They will be asked to set their own password at first sign-in.');
  } catch (err) {
    if (err.code === '23505') {
      console.error(`An account already exists for ${args.email}.`);
    } else {
      console.error(err.message);
    }
    process.exitCode = 1;
  }
}

main().finally(() => pool.end());

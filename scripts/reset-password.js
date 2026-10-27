'use strict';

const { pool, query } = require('../src/db/pool');
const { hashPassword } = require('../src/utils/password');
const {
  parseArgs, askPasswordTwice, generatePassword,
} = require('./lib/prompt');

/**
 * Resets the password on an existing account.
 *
 * Every system needs this. People forget passwords, and an administrator
 * locked out of their own deployment has no way back in otherwise.
 *
 *   npm run reset-password -- --email someone@example.com
 *   npm run reset-password -- --email someone@example.com --ask
 *
 * The new password is temporary either way: the account is flagged so the
 * owner must choose their own at next sign-in, and every existing session is
 * ended immediately.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    console.error('Missing required option: --email\n');
    console.error('Example:');
    console.error('  npm run reset-password -- --email someone@example.com --ask');
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
    console.error('\nAccounts that do exist:');
    const all = await query('SELECT email, role FROM users ORDER BY email');
    all.rows.forEach((r) => console.error(`  ${r.email}  (${r.role})`));
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

  const passwordHash = await hashPassword(password);

  // password_changed_at moving to now invalidates every token issued before
  // this moment, so any session opened with the old password ends here.
  await query(
    `UPDATE users
     SET password_hash = $2,
         password_changed_at = NOW(),
         must_change_password = TRUE,
         updated_at = NOW()
     WHERE id = $1`,
    [user.id, passwordHash]
  );

  console.log(`\nReset the password for ${user.full_name} <${user.email}> (${user.role}).`);
  console.log('Any device signed in with the old password has been signed out.');

  if (generated) {
    console.log(`\n  Temporary password: ${password}`);
    console.log('\nShown once. Send it privately — not in the same message as the link.');
  } else {
    console.log('\nPassword set. It was never displayed or written to your shell history.');
  }

  console.log('They will be asked to choose their own password at next sign-in.');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

'use strict';

const { pool, query } = require('./pool');
const { hashPassword } = require('../utils/password');

/**
 * Development seed data.
 *
 * Passwords here are development-only placeholders and are safe to keep in
 * the repository because this script refuses to run against production.
 * Real accounts are created by an administrator through POST /api/auth/users.
 */

const DEV_PASSWORD = 'ChangeMe123!';

const USERS = [
  { fullName: 'System Administrator', email: 'admin@tihama.test', role: 'administrator' },
  { fullName: 'Safiyyah Umar', email: 'manager@tihama.test', role: 'project_manager' },
  { fullName: 'Muhammad Abdullahi', email: 'supervisor@tihama.test', role: 'site_supervisor' },
];

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database.');
  }

  const passwordHash = await hashPassword(DEV_PASSWORD);

  for (const u of USERS) {
    await query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, LOWER($2), $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.fullName, u.email, passwordHash, u.role]
    );
  }

  const project = await query(
    `INSERT INTO projects (code, name, client, start_date, status)
     VALUES ('TIH-001', 'Bompai Road Facility Upgrade', 'Internal', '2026-09-01', 'active')
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  const projectId = project.rows[0].id;

  for (const name of ['Main Site', 'Workshop Yard']) {
    await query(
      `INSERT INTO sites (project_id, name, location)
       VALUES ($1, $2, 'Kano, Kano State')
       ON CONFLICT (project_id, name) DO NOTHING`,
      [projectId, name]
    );
  }

  // Assign the sample supervisor to those sites. Without this they can sign
  // in but every submission is refused, because a supervisor may only report
  // on a site they are assigned to.
  await query(
    `INSERT INTO site_assignments (user_id, site_id)
     SELECT u.id, s.id
     FROM users u
     CROSS JOIN sites s
     WHERE u.email = 'supervisor@tihama.test'
       AND s.project_id = $1
     ON CONFLICT DO NOTHING`,
    [projectId]
  );

  console.log('Seed complete.');
  console.log(`Sample accounts use the password: ${DEV_PASSWORD}`);
  console.log('Change these before any shared deployment.');
}

seed()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

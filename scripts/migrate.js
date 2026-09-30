'use strict';

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');

/**
 * Applies any migration in src/db/migrations that has not run yet, in
 * filename order, and records it. Running this twice is safe.
 */

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations() {
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  await ensureMigrationsTable();
  const done = await appliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let applied = 0;

  for (const file of files) {
    if (done.has(file)) {
      console.log(`  skip  ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`  apply ${file}`);

    const client = await pool.connect();
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      applied += 1;
    } catch (err) {
      console.error(`\nMigration failed: ${file}\n${err.message}`);
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }
  }

  console.log(`\nDone. ${applied} migration(s) applied.`);
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

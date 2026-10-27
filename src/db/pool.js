'use strict';

const { Pool } = require('pg');
const env = require('../config/env');

/**
 * A single shared connection pool for the whole application.
 *
 * Creating a pool per request exhausts PostgreSQL's connection limit very
 * quickly, which is a common and hard-to-diagnose production failure.
 */
/**
 * Whether to use TLS, decided by the connection string rather than by
 * NODE_ENV.
 *
 * A hosted database needs TLS wherever the client happens to be running —
 * including an admin script run from a laptop against production. Keying
 * this off NODE_ENV meant those scripts failed with a confusing handshake
 * error unless you also pretended to be a production server.
 *
 * rejectUnauthorized is false because managed providers present a
 * certificate signed by their own authority, not one in Node's trust store.
 */
function needsTls(url) {
  if (/sslmode=(require|verify-ca|verify-full)/.test(url)) return true;
  // Anything that is not a local database is remote, so assume TLS.
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: needsTls(env.databaseUrl) ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // An idle client failing should not take the process down silently.
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Run a parameterised query.
 * Always pass values as `params` — never build SQL by string concatenation,
 * which is how SQL injection happens.
 */
async function query(text, params) {
  return pool.query(text, params);
}

/** Run several statements inside one transaction. */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };

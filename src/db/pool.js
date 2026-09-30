'use strict';

const { Pool } = require('pg');
const env = require('../config/env');

/**
 * A single shared connection pool for the whole application.
 *
 * Creating a pool per request exhausts PostgreSQL's connection limit very
 * quickly, which is a common and hard-to-diagnose production failure.
 */
const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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

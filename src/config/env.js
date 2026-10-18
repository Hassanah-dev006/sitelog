'use strict';

require('dotenv').config();

/**
 * Central place for configuration.
 *
 * Nothing in the codebase should read process.env directly — importing this
 * module means a missing variable fails loudly at start-up instead of
 * surfacing as a confusing error halfway through a request.
 */

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Copy .env.example to .env and fill it in.'
    );
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),

  databaseUrl: required('DATABASE_URL', 'postgresql://sitelog:sitelog@localhost:5432/sitelog'),

  jwtSecret: required('JWT_SECRET', process.env.NODE_ENV === 'test' ? 'test-secret' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  // Cost factor for bcrypt. Lowered in tests so the suite stays fast.
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || (process.env.NODE_ENV === 'test' ? 4 : 12)),

  // Site photos. The phone compresses before uploading, so this ceiling is
  // generous — it exists to stop an un-compressed original being sent.
  uploadDir: process.env.UPLOAD_DIR || require('path').join(__dirname, '..', '..', 'uploads'),
  maxPhotoBytes: Number(process.env.MAX_PHOTO_BYTES || 3 * 1024 * 1024),

  // The public address once deployed, e.g. https://sitelog.onrender.com
  publicUrl: process.env.PUBLIC_URL || null,
};

env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

/**
 * Refuse to start a production server with configuration that is fine on a
 * laptop and dangerous in public.
 *
 * A deployment that quietly runs with the example secret is worse than one
 * that will not start, because nobody finds out until it matters.
 */
if (env.isProduction) {
  const problems = [];

  if (env.jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production.');
  }
  if (/replace_me|test-secret|changeme/i.test(env.jwtSecret)) {
    problems.push('JWT_SECRET is still an example value.');
  }
  if (env.bcryptRounds < 10) {
    problems.push('BCRYPT_ROUNDS must be at least 10 in production.');
  }
  if (/localhost|127\.0\.0\.1/.test(env.databaseUrl)) {
    problems.push('DATABASE_URL points at localhost, which is not reachable from a host.');
  }

  if (problems.length) {
    console.error('\nRefusing to start in production:\n');
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error('');
    process.exit(1);
  }
}

module.exports = env;

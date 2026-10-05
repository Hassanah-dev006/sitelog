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
};

env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

module.exports = env;

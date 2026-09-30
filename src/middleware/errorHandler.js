'use strict';

const env = require('../config/env');

/** 404 for anything that matched no route. */
function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

/**
 * Single place where errors become responses.
 *
 * Internal details are logged for us but never returned to the client, since
 * stack traces and database messages leak information about the system.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on our side.' : err.message,
    ...(env.isProduction ? {} : { detail: err.message }),
  });
}

module.exports = { notFound, errorHandler };

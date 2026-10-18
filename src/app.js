'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

/**
 * The Express application, exported without starting a server so that tests
 * can drive it directly with supertest.
 */
const app = express();

// Behind Render's load balancer, so the client IP and protocol come from
// forwarded headers rather than the socket.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Vite emits a small inline style block for the initial paint.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // The frontend is served from this same origin, so nothing needs to be
    // loaded cross-origin.
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
);

/**
 * In production the frontend is served by this same process, so there is no
 * cross-origin request to allow. In development Vite runs on another port
 * and proxies, so an open policy is harmless and saves configuration.
 */
app.use(
  cors(
    env.isProduction
      ? { origin: env.publicUrl || false, credentials: true }
      : {}
  )
);

// Reports are small JSON documents; photos upload separately as multipart.
app.use(express.json({ limit: '1mb' }));

app.use('/api', routes);

// ------------------------------------------------------------- frontend ----

const WEB_DIST = path.join(__dirname, '..', 'web', 'dist');

if (fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
  // Hashed asset filenames, so they can be cached hard. index.html must not
  // be, or a deploy would not reach anyone still holding the old one.
  app.use(
    express.static(WEB_DIST, {
      index: false,
      maxAge: env.isProduction ? '1y' : 0,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );

  // Client-side routing: anything that is not an API call or a real file is
  // the single page application, which reads the path itself.
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    return res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;

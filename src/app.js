'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

/**
 * The Express application, exported without starting a server so that tests
 * can drive it directly with supertest.
 */
const app = express();

app.use(helmet());
app.use(cors());

// Reports are small JSON documents; photos upload separately in week 7.
app.use(express.json({ limit: '1mb' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

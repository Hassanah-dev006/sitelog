'use strict';

const express = require('express');
const authRoutes = require('./auth.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sitelog-api' });
});

router.use('/auth', authRoutes);

// Week 5 adds: /projects, /sites, /reports
module.exports = router;

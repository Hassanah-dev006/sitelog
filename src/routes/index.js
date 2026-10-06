'use strict';

const express = require('express');
const authRoutes = require('./auth.routes');
const projectRoutes = require('./project.routes');
const siteRoutes = require('./site.routes');
const reportRoutes = require('./report.routes');
const dashboardRoutes = require('./dashboard.routes');
const exportRoutes = require('./export.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sitelog-api' });
});

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/sites', siteRoutes);
router.use('/reports', reportRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/export', exportRoutes);

module.exports = router;

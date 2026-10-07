'use strict';

const express = require('express');
const controller = require('../controllers/export.controller');
const { requireAuth, requireRole, blockUntilPasswordChanged } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Exports span every site, so they follow the same rule as the dashboard.
router.use(requireAuth, blockUntilPasswordChanged, requireRole(ROLES.MANAGER, ROLES.ADMIN));

router.get('/pdf', controller.weeklyPdf);
router.get('/xlsx', controller.weeklyXlsx);

module.exports = router;

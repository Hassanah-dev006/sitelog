'use strict';

const express = require('express');
const controller = require('../controllers/dashboard.controller');
const { requireAuth, requireRole, blockUntilPasswordChanged } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// The dashboard aggregates across every site, so it is for the people whose
// job spans sites. A supervisor sees their own reports, not the whole company.
router.use(requireAuth, blockUntilPasswordChanged, requireRole(ROLES.MANAGER, ROLES.ADMIN));

router.get('/', controller.overview);
router.get('/outstanding', controller.outstanding);

module.exports = router;

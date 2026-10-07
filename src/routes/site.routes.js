'use strict';

const express = require('express');
const controller = require('../controllers/project.controller');
const { requireAuth, requireRole, blockUntilPasswordChanged } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(requireAuth, blockUntilPasswordChanged);

// Which supervisors cover a site.
router.get('/:siteId/supervisors', requireRole(ROLES.MANAGER, ROLES.ADMIN), controller.listSupervisors);
router.post('/:siteId/supervisors', requireRole(ROLES.ADMIN), controller.assign);
router.delete('/:siteId/supervisors/:userId', requireRole(ROLES.ADMIN), controller.unassign);

module.exports = router;

'use strict';

const express = require('express');
const controller = require('../controllers/project.controller');
const { requireAuth, requireRole, blockUntilPasswordChanged } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

const canRead = requireRole(ROLES.MANAGER, ROLES.ADMIN);
const adminOnly = requireRole(ROLES.ADMIN);

router.use(requireAuth, blockUntilPasswordChanged);

// Projects
router.get('/', canRead, controller.list);
router.post('/', adminOnly, controller.create);
router.get('/:id', canRead, controller.getOne);
router.patch('/:id', adminOnly, controller.update);

// Sites belonging to a project
router.get('/:id/sites', canRead, controller.listSites);
router.post('/:id/sites', adminOnly, controller.createSite);

module.exports = router;

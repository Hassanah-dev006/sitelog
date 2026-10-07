'use strict';

const express = require('express');
const controller = require('../controllers/auth.controller');
const { requireAuth, requireRole, blockUntilPasswordChanged, ROLES } = require('../middleware/auth');

const router = express.Router();

// Public
router.post('/login', controller.login);

// Authenticated. Both of these stay reachable for an account that still has
// to set its own password — otherwise there would be no way out of that state.
router.get('/me', requireAuth, controller.me);
router.post('/password', requireAuth, controller.changePassword);

// Administrators only — there is no public sign-up in this system.
router.post(
  '/users',
  requireAuth,
  blockUntilPasswordChanged,
  requireRole(ROLES.ADMIN),
  controller.createUser
);

module.exports = router;

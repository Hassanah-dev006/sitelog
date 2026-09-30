'use strict';

const express = require('express');
const controller = require('../controllers/auth.controller');
const { requireAuth, requireRole, ROLES } = require('../middleware/auth');

const router = express.Router();

// Public
router.post('/login', controller.login);

// Authenticated
router.get('/me', requireAuth, controller.me);

// Administrators only — there is no public sign-up in this system.
router.post('/users', requireAuth, requireRole(ROLES.ADMIN), controller.createUser);

module.exports = router;

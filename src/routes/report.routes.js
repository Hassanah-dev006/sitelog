'use strict';

const express = require('express');
const controller = require('../controllers/report.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Every role may read; what they can see is narrowed per site inside the
// controller and the query, not by the role alone.
router.get('/', controller.list);
router.get('/:id', controller.getOne);

// Supervisors submit for their own sites. Managers and administrators may
// also submit, which covers standing in for an absent supervisor.
router.post('/', controller.create);

module.exports = router;

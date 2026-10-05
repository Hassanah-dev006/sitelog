'use strict';

const express = require('express');
const controller = require('../controllers/report.controller');
const photoController = require('../controllers/photo.controller');
const { requireAuth } = require('../middleware/auth');
const { uploadPhotos, handleUploadErrors } = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

// Every role may read; what they can see is narrowed per site inside the
// controller and the query, not by the role alone.
router.get('/', controller.list);
router.get('/:id', controller.getOne);

// Supervisors submit for their own sites. Managers and administrators may
// also submit, which covers standing in for an absent supervisor.
router.post('/', controller.create);

// Photos arrive after the report, so a weak connection cannot stop the text
// of the report from being delivered.
router.post('/:id/photos', uploadPhotos, handleUploadErrors, photoController.upload);

module.exports = router;

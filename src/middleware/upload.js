'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');

/**
 * Photo upload handling.
 *
 * Files are written to disk with generated names. A filename supplied by a
 * client is never trusted: it can contain path separators, and reusing it
 * would let one upload overwrite another.
 */

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadDir),
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype]
      || '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxPhotoBytes,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(Object.assign(new Error('Only JPEG, PNG and WebP images are accepted.'), {
        status: 400,
      }));
    }
    return cb(null, true);
  },
});

/** Turns multer's own errors into the same JSON shape as everything else. */
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = (env.maxPhotoBytes / (1024 * 1024)).toFixed(1);
      return res.status(413).json({ error: `Each photo must be under ${mb} MB.` });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({ error: 'At most 5 photos per upload.' });
    }
    return res.status(400).json({ error: err.message });
  }
  return next(err);
}

module.exports = {
  uploadPhotos: upload.array('photos', 5),
  handleUploadErrors,
  ALLOWED_TYPES: ALLOWED,
  photoPath: (filename) => path.join(env.uploadDir, filename),
};

'use strict';

const reportService = require('../services/report.service');
const { canAccessSite } = require('../services/access.service');

/**
 * Attaching site photographs to a report.
 *
 * Photos are uploaded separately from the report itself. On a weak
 * connection the text of a report is small and should not be held hostage to
 * a few megabytes of images, so the report lands first and photos follow.
 */
async function upload(req, res, next) {
  const reportId = Number(req.params.id);
  if (!Number.isInteger(reportId) || reportId < 1) {
    return res.status(400).json({ error: 'Invalid report id.' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No photos were attached.' });
  }

  try {
    const siteId = await reportService.getReportSiteId(reportId);
    if (!siteId) return res.status(404).json({ error: 'Report not found.' });

    const allowed = await canAccessSite(req.user, siteId);
    if (!allowed) return res.status(404).json({ error: 'Report not found.' });

    const photos = await reportService.addPhotos(reportId, req.user.id, req.files);
    return res.status(201).json({ photos, count: photos.length });
  } catch (err) {
    return next(err);
  }
}

module.exports = { upload };

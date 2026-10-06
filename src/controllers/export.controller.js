'use strict';

const { z } = require('zod');
const exportService = require('../services/export.service');
const { buildWeeklyPdf } = require('../services/pdf.service');
const { buildWorkbook } = require('../services/xlsx.service');

const MAX_DAYS = 92;

const rangeSchema = z.object({
  from: z.string().date('from must be YYYY-MM-DD.'),
  to: z.string().date('to must be YYYY-MM-DD.'),
  projectId: z.coerce.number().int().positive().optional(),
});

function firstIssue(result) {
  return result.error.issues[0]?.message || 'Invalid request.';
}

function validateRange(req, res) {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed) });
    return null;
  }

  const { from, to } = parsed.data;
  if (from > to) {
    res.status(400).json({ error: 'The start date must be before the end date.' });
    return null;
  }

  // An unbounded range would pull every report ever filed into one document.
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (days > MAX_DAYS) {
    res.status(400).json({ error: `Export at most ${MAX_DAYS} days at a time.` });
    return null;
  }

  return parsed.data;
}

function filename(prefix, from, to, ext) {
  return `sitelog-${prefix}-${from}-to-${to}.${ext}`;
}

// ------------------------------------------------------------------- pdf ---

async function weeklyPdf(req, res, next) {
  const range = validateRange(req, res);
  if (!range) return undefined;

  const { from, to, projectId } = range;

  try {
    const rows = await exportService.reportRows(from, to, projectId);
    const summary = exportService.summarise(rows);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename('weekly-report', from, to, 'pdf')}"`
    );

    // Streamed, so a long period does not sit in memory before sending.
    buildWeeklyPdf(res, {
      from, to, rows, summary,
      projectName: rows[0]?.project_name && projectId ? rows[0].project_name : null,
    });

    return undefined;
  } catch (err) {
    return next(err);
  }
}

// ------------------------------------------------------------------ xlsx ---

async function weeklyXlsx(req, res, next) {
  const range = validateRange(req, res);
  if (!range) return undefined;

  const { from, to, projectId } = range;

  try {
    const [reports, manpower, equipment, materials, incidents] = await Promise.all([
      exportService.reportRows(from, to, projectId),
      exportService.manpowerRows(from, to, projectId),
      exportService.equipmentRows(from, to, projectId),
      exportService.materialRows(from, to, projectId),
      exportService.incidentRows(from, to, projectId),
    ]);

    const workbook = await buildWorkbook({
      from, to, reports, manpower, equipment, materials, incidents,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename('data', from, to, 'xlsx')}"`
    );

    await workbook.xlsx.write(res);
    res.end();
    return undefined;
  } catch (err) {
    return next(err);
  }
}

module.exports = { weeklyPdf, weeklyXlsx };

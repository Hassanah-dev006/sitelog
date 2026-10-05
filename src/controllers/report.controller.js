'use strict';

const { z } = require('zod');
const reportService = require('../services/report.service');
const { canAccessSite } = require('../services/access.service');

/** Validation for the daily site report. */

const manpowerSchema = z.object({
  trade: z.string().min(1, 'Each manpower entry needs a trade.'),
  headcount: z.coerce.number().int().min(0),
  hoursWorked: z.coerce.number().min(0).max(24).optional(),
});

const equipmentSchema = z.object({
  equipmentName: z.string().min(1, 'Each equipment entry needs a name.'),
  hoursRun: z.coerce.number().min(0).max(24).optional(),
  status: z.enum(['operational', 'idle', 'breakdown']).optional(),
});

const materialSchema = z.object({
  materialName: z.string().min(1, 'Each material entry needs a name.'),
  unit: z.string().optional(),
  quantityReceived: z.coerce.number().min(0).optional(),
  quantityUsed: z.coerce.number().min(0).optional(),
});

const incidentSchema = z.object({
  category: z.enum(['safety', 'equipment', 'delay', 'security', 'other']),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  description: z.string().min(1, 'Each incident needs a description.'),
});

const createReportSchema = z.object({
  siteId: z.coerce.number().int().positive(),
  reportDate: z.string().date('Report date must be in YYYY-MM-DD format.'),
  weather: z.string().optional(),
  progressNotes: z.string().optional(),
  delaysNotes: z.string().optional(),
  manpower: z.array(manpowerSchema).max(50).optional(),
  equipment: z.array(equipmentSchema).max(50).optional(),
  materials: z.array(materialSchema).max(50).optional(),
  incidents: z.array(incidentSchema).max(20).optional(),
});

const listQuerySchema = z.object({
  siteId: z.coerce.number().int().positive().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

function firstIssue(result) {
  return result.error.issues[0]?.message || 'Invalid request.';
}

// --------------------------------------------------------------- create ----

async function create(req, res, next) {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  const data = parsed.data;

  // A report dated in the future is almost always a typo in the date field.
  const today = new Date().toISOString().slice(0, 10);
  if (data.reportDate > today) {
    return res.status(400).json({ error: 'A report cannot be dated in the future.' });
  }

  try {
    // A supervisor may only report on a site they are assigned to.
    const allowed = await canAccessSite(req.user, data.siteId);
    if (!allowed) {
      return res.status(403).json({ error: 'You are not assigned to that site.' });
    }

    const report = await reportService.createReport(req.user, data);
    return res.status(201).json({ report });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    if (err.code === '23503') return res.status(404).json({ error: 'That site does not exist.' });
    return next(err);
  }
}

// ----------------------------------------------------------------- list ----

async function list(req, res, next) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  try {
    const reports = await reportService.listReports(req.user, parsed.data);
    return res.json({ reports, count: reports.length });
  } catch (err) {
    return next(err);
  }
}

// ------------------------------------------------------------------ get ----

async function getOne(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid report id.' });
  }

  try {
    const report = await reportService.getReport(id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    const allowed = await canAccessSite(req.user, report.siteId);
    if (!allowed) {
      // 404 rather than 403: a supervisor should not be able to probe which
      // report ids exist on sites they have nothing to do with.
      return res.status(404).json({ error: 'Report not found.' });
    }

    return res.json({ report });
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, list, getOne };

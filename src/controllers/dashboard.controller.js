'use strict';

const { z } = require('zod');
const service = require('../services/dashboard.service');

const today = () => new Date().toISOString().slice(0, 10);

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const rangeSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  date: z.string().date().optional(),
});

function firstIssue(result) {
  return result.error.issues[0]?.message || 'Invalid request.';
}

/**
 * One request returns the whole dashboard.
 *
 * Five separate calls would mean five round trips on an office connection
 * that is not always fast either, and a page that fills in piece by piece.
 * The queries run in parallel on the server instead.
 */
async function overview(req, res, next) {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  const { projectId } = parsed.data;
  const date = parsed.data.date || today();
  const from = parsed.data.from || daysAgo(13);
  const to = parsed.data.to || date;

  if (from > to) {
    return res.status(400).json({ error: 'The start date must be before the end date.' });
  }

  try {
    const [summary, outstanding, trend, manpower, equipment] = await Promise.all([
      service.summary(date),
      service.outstanding(date),
      service.submissionTrend(from, to),
      service.manpowerByTrade(from, to, projectId),
      service.equipmentUtilisation(from, to),
    ]);

    return res.json({
      range: { from, to, date },
      summary,
      outstanding,
      trend,
      manpower,
      equipment,
    });
  } catch (err) {
    return next(err);
  }
}

/** The outstanding list on its own, for the daily chase-up. */
async function outstanding(req, res, next) {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  try {
    const sites = await service.outstanding(parsed.data.date || today());
    return res.json({ outstanding: sites, count: sites.length });
  } catch (err) {
    return next(err);
  }
}

module.exports = { overview, outstanding };

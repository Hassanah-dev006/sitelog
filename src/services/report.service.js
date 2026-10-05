'use strict';

const { query, withTransaction } = require('../db/pool');
const { seesAllSites } = require('./access.service');

/**
 * Daily site reports.
 *
 * A report and its line items are written in one transaction. A report with
 * half its manpower rows missing would be worse than no report at all, so it
 * is all or nothing.
 */

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}

function toReport(row) {
  return {
    id: Number(row.id),
    siteId: Number(row.site_id),
    siteName: row.site_name,
    projectId: row.project_id ? Number(row.project_id) : undefined,
    projectName: row.project_name,
    reportDate: row.report_date,
    submittedBy: { id: Number(row.submitted_by), fullName: row.submitted_by_name },
    weather: row.weather,
    progressNotes: row.progress_notes,
    delaysNotes: row.delays_notes,
    status: row.status,
    submittedAt: row.submitted_at,
  };
}

// --------------------------------------------------------------- create ----

async function createReport(user, data) {
  return withTransaction(async (client) => {
    let report;

    try {
      const { rows } = await client.query(
        `INSERT INTO daily_reports
           (site_id, report_date, submitted_by, weather, progress_notes, delays_notes,
            status, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'submitted', NOW())
         RETURNING id, site_id, report_date, submitted_by, weather, progress_notes,
                   delays_notes, status, submitted_at`,
        [data.siteId, data.reportDate, user.id, data.weather ?? null,
         data.progressNotes ?? null, data.delaysNotes ?? null]
      );
      report = rows[0];
    } catch (err) {
      // UNIQUE (site_id, report_date) — one report per site per day.
      if (err.code === '23505') {
        throw new ConflictError('A report for this site and date already exists.');
      }
      throw err;
    }

    const reportId = report.id;

    for (const m of data.manpower ?? []) {
      await client.query(
        `INSERT INTO manpower_entries (report_id, trade, headcount, hours_worked)
         VALUES ($1, $2, $3, $4)`,
        [reportId, m.trade, m.headcount, m.hoursWorked ?? null]
      );
    }

    for (const e of data.equipment ?? []) {
      await client.query(
        `INSERT INTO equipment_entries (report_id, equipment_name, hours_run, status)
         VALUES ($1, $2, $3, COALESCE($4, 'operational'))`,
        [reportId, e.equipmentName, e.hoursRun ?? null, e.status ?? null]
      );
    }

    for (const mat of data.materials ?? []) {
      await client.query(
        `INSERT INTO material_entries
           (report_id, material_name, unit, quantity_received, quantity_used)
         VALUES ($1, $2, $3, $4, $5)`,
        [reportId, mat.materialName, mat.unit ?? null,
         mat.quantityReceived ?? null, mat.quantityUsed ?? null]
      );
    }

    for (const i of data.incidents ?? []) {
      await client.query(
        `INSERT INTO incidents (report_id, category, severity, description)
         VALUES ($1, $2, COALESCE($3, 'low'), $4)`,
        [reportId, i.category, i.severity ?? null, i.description]
      );
    }

    return {
      ...toReport({ ...report, submitted_by_name: user.fullName }),
      counts: {
        manpower: (data.manpower ?? []).length,
        equipment: (data.equipment ?? []).length,
        materials: (data.materials ?? []).length,
        incidents: (data.incidents ?? []).length,
      },
    };
  });
}

// ----------------------------------------------------------------- list ----

/**
 * Filters: from, to, siteId, projectId, limit, offset.
 *
 * A supervisor's results are narrowed to their assigned sites in SQL, not in
 * JavaScript afterwards — filtering after the fact is how data leaks.
 */
async function listReports(user, filters = {}) {
  const conditions = [];
  const params = [];

  if (!seesAllSites(user)) {
    params.push(user.id);
    conditions.push(
      `EXISTS (SELECT 1 FROM site_assignments sa
               WHERE sa.site_id = r.site_id AND sa.user_id = $${params.length})`
    );
  }

  if (filters.siteId) {
    params.push(filters.siteId);
    conditions.push(`r.site_id = $${params.length}`);
  }
  if (filters.projectId) {
    params.push(filters.projectId);
    conditions.push(`s.project_id = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`r.report_date >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`r.report_date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const limit = Math.min(Number(filters.limit) || 50, 200);
  const offset = Number(filters.offset) || 0;
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT r.id, r.site_id, r.report_date, r.submitted_by, r.weather,
            r.progress_notes, r.delays_notes, r.status, r.submitted_at,
            s.name AS site_name, s.project_id, p.name AS project_name,
            u.full_name AS submitted_by_name
     FROM daily_reports r
     JOIN sites s    ON s.id = r.site_id
     JOIN projects p ON p.id = s.project_id
     JOIN users u    ON u.id = r.submitted_by
     ${where}
     ORDER BY r.report_date DESC, r.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return rows.map(toReport);
}

// ------------------------------------------------------------------ get ----

/** Full report including every line item. Returns null if not found. */
async function getReport(id) {
  const { rows } = await query(
    `SELECT r.id, r.site_id, r.report_date, r.submitted_by, r.weather,
            r.progress_notes, r.delays_notes, r.status, r.submitted_at,
            s.name AS site_name, s.project_id, p.name AS project_name,
            u.full_name AS submitted_by_name
     FROM daily_reports r
     JOIN sites s    ON s.id = r.site_id
     JOIN projects p ON p.id = s.project_id
     JOIN users u    ON u.id = r.submitted_by
     WHERE r.id = $1`,
    [id]
  );

  if (!rows[0]) return null;
  const report = toReport(rows[0]);

  const [manpower, equipment, materials, incidents] = await Promise.all([
    query('SELECT trade, headcount, hours_worked FROM manpower_entries WHERE report_id = $1', [id]),
    query('SELECT equipment_name, hours_run, status FROM equipment_entries WHERE report_id = $1', [id]),
    query(`SELECT material_name, unit, quantity_received, quantity_used
           FROM material_entries WHERE report_id = $1`, [id]),
    query('SELECT category, severity, description FROM incidents WHERE report_id = $1', [id]),
  ]);

  report.manpower = manpower.rows.map((r) => ({
    trade: r.trade, headcount: r.headcount, hoursWorked: r.hours_worked,
  }));
  report.equipment = equipment.rows.map((r) => ({
    equipmentName: r.equipment_name, hoursRun: r.hours_run, status: r.status,
  }));
  report.materials = materials.rows.map((r) => ({
    materialName: r.material_name, unit: r.unit,
    quantityReceived: r.quantity_received, quantityUsed: r.quantity_used,
  }));
  report.incidents = incidents.rows.map((r) => ({
    category: r.category, severity: r.severity, description: r.description,
  }));

  return report;
}

module.exports = { createReport, listReports, getReport, ConflictError };

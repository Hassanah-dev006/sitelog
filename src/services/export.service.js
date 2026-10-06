'use strict';

const { query } = require('../db/pool');

/**
 * Data gathering for the weekly exports.
 *
 * Both the PDF and the spreadsheet are built from these queries, so the two
 * can never disagree about what happened in a given week.
 */

/** One row per report, with its line items already totalled in SQL. */
async function reportRows(from, to, projectId) {
  const params = [from, to];
  let projectClause = '';

  if (projectId) {
    params.push(projectId);
    projectClause = `AND s.project_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT r.id, r.report_date, r.weather, r.progress_notes, r.delays_notes,
            s.name AS site_name, p.name AS project_name, p.code AS project_code,
            u.full_name AS submitted_by,
            COALESCE(mp.headcount, 0)      AS headcount,
            COALESCE(mp.hours, 0)          AS manpower_hours,
            COALESCE(eq.hours, 0)          AS equipment_hours,
            COALESCE(eq.breakdowns, 0)     AS breakdowns,
            COALESCE(inc.total, 0)         AS incident_count
     FROM daily_reports r
     JOIN sites s    ON s.id = r.site_id
     JOIN projects p ON p.id = s.project_id
     JOIN users u    ON u.id = r.submitted_by
     LEFT JOIN LATERAL (
       SELECT SUM(headcount)::int AS headcount,
              COALESCE(SUM(hours_worked), 0)::float AS hours
       FROM manpower_entries m WHERE m.report_id = r.id
     ) mp ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(hours_run), 0)::float AS hours,
              COUNT(*) FILTER (WHERE status = 'breakdown')::int AS breakdowns
       FROM equipment_entries e WHERE e.report_id = r.id
     ) eq ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS total FROM incidents i WHERE i.report_id = r.id
     ) inc ON TRUE
     WHERE r.report_date BETWEEN $1::date AND $2::date ${projectClause}
     ORDER BY p.name, s.name, r.report_date`,
    params
  );

  return rows;
}

/** Line items, flattened for the spreadsheet's detail sheets. */
async function lineItems(table, columns, from, to, projectId) {
  const params = [from, to];
  let projectClause = '';

  if (projectId) {
    params.push(projectId);
    projectClause = `AND s.project_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT r.report_date, p.name AS project_name, s.name AS site_name, ${columns}
     FROM ${table} x
     JOIN daily_reports r ON r.id = x.report_id
     JOIN sites s         ON s.id = r.site_id
     JOIN projects p      ON p.id = s.project_id
     WHERE r.report_date BETWEEN $1::date AND $2::date ${projectClause}
     ORDER BY r.report_date, p.name, s.name`,
    params
  );

  return rows;
}

const manpowerRows = (f, t, p) =>
  lineItems('manpower_entries', 'x.trade, x.headcount, x.hours_worked', f, t, p);

const equipmentRows = (f, t, p) =>
  lineItems('equipment_entries', 'x.equipment_name, x.hours_run, x.status', f, t, p);

const materialRows = (f, t, p) =>
  lineItems(
    'material_entries',
    'x.material_name, x.unit, x.quantity_received, x.quantity_used',
    f, t, p
  );

const incidentRows = (f, t, p) =>
  lineItems('incidents', 'x.category, x.severity, x.description', f, t, p);

/** Totals for the summary block at the top of the PDF. */
function summarise(rows) {
  return {
    reports: rows.length,
    sites: new Set(rows.map((r) => r.site_name)).size,
    manpowerHours: rows.reduce((n, r) => n + Number(r.manpower_hours || 0), 0),
    equipmentHours: rows.reduce((n, r) => n + Number(r.equipment_hours || 0), 0),
    incidents: rows.reduce((n, r) => n + Number(r.incident_count || 0), 0),
    breakdowns: rows.reduce((n, r) => n + Number(r.breakdowns || 0), 0),
  };
}

module.exports = {
  reportRows,
  manpowerRows,
  equipmentRows,
  materialRows,
  incidentRows,
  summarise,
};

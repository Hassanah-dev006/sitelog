'use strict';

const { query } = require('../db/pool');

/**
 * Dashboard aggregations.
 *
 * Every figure here answers a question a manager actually asked during
 * requirements gathering. Nothing is shown because it was easy to compute.
 */

/** Head-line counts for the top of the dashboard. */
async function summary(onDate) {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM projects WHERE status = 'active')           AS active_projects,
       (SELECT COUNT(*) FROM sites s
          JOIN projects p ON p.id = s.project_id
         WHERE s.is_active AND p.status = 'active')                      AS active_sites,
       (SELECT COUNT(*) FROM daily_reports WHERE report_date = $1::date) AS reports_today,
       (SELECT COUNT(*) FROM incidents i
          JOIN daily_reports r ON r.id = i.report_id
         WHERE r.report_date > $1::date - 7)                             AS incidents_week,
       (SELECT COUNT(*) FROM incidents i
          JOIN daily_reports r ON r.id = i.report_id
         WHERE r.report_date > $1::date - 7 AND i.severity = 'high')     AS high_incidents_week`,
    [onDate]
  );

  const r = rows[0];
  return {
    activeProjects: Number(r.active_projects),
    activeSites: Number(r.active_sites),
    reportsToday: Number(r.reports_today),
    incidentsThisWeek: Number(r.incidents_week),
    highIncidentsThisWeek: Number(r.high_incidents_week),
  };
}

/**
 * Active sites with no report for the given date.
 *
 * This is the view that turns missing information into an action. Head
 * office can chase the same evening instead of noticing at month end.
 */
async function outstanding(onDate) {
  const { rows } = await query(
    `SELECT s.id, s.name, p.name AS project_name,
            (SELECT MAX(report_date) FROM daily_reports d WHERE d.site_id = s.id)
              AS last_report_date
     FROM sites s
     JOIN projects p ON p.id = s.project_id
     WHERE s.is_active
       AND p.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM daily_reports r
         WHERE r.site_id = s.id AND r.report_date = $1::date
       )
     ORDER BY last_report_date ASC NULLS FIRST, p.name, s.name`,
    [onDate]
  );

  return rows.map((r) => ({
    siteId: Number(r.id),
    siteName: r.name,
    projectName: r.project_name,
    lastReportDate: r.last_report_date,
  }));
}

/** Reports filed per day, for the submission trend. */
async function submissionTrend(from, to) {
  const { rows } = await query(
    `SELECT report_date, COUNT(*)::int AS reports
     FROM daily_reports
     WHERE report_date BETWEEN $1::date AND $2::date
     GROUP BY report_date
     ORDER BY report_date`,
    [from, to]
  );

  return rows.map((r) => ({ date: r.report_date, reports: r.reports }));
}

/** Total headcount and hours by trade over a date range. */
async function manpowerByTrade(from, to, projectId) {
  const params = [from, to];
  let projectClause = '';

  if (projectId) {
    params.push(projectId);
    projectClause = `AND s.project_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT m.trade,
            SUM(m.headcount)::int                      AS headcount,
            COALESCE(SUM(m.hours_worked), 0)::float    AS hours
     FROM manpower_entries m
     JOIN daily_reports r ON r.id = m.report_id
     JOIN sites s         ON s.id = r.site_id
     WHERE r.report_date BETWEEN $1::date AND $2::date ${projectClause}
     GROUP BY m.trade
     ORDER BY headcount DESC
     LIMIT 12`,
    params
  );

  return rows.map((r) => ({ trade: r.trade, headcount: r.headcount, hours: r.hours }));
}

/** Hours run and breakdown count per machine. */
async function equipmentUtilisation(from, to) {
  const { rows } = await query(
    `SELECT e.equipment_name,
            COALESCE(SUM(e.hours_run), 0)::float                   AS hours,
            COUNT(*) FILTER (WHERE e.status = 'breakdown')::int     AS breakdowns
     FROM equipment_entries e
     JOIN daily_reports r ON r.id = e.report_id
     WHERE r.report_date BETWEEN $1::date AND $2::date
     GROUP BY e.equipment_name
     ORDER BY hours DESC
     LIMIT 12`,
    [from, to]
  );

  return rows.map((r) => ({
    equipmentName: r.equipment_name,
    hours: r.hours,
    breakdowns: r.breakdowns,
  }));
}

module.exports = {
  summary,
  outstanding,
  submissionTrend,
  manpowerByTrade,
  equipmentUtilisation,
};

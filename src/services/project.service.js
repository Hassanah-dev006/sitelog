'use strict';

const { query } = require('../db/pool');

/** Projects, sites, and which supervisor covers which site. */

function toProject(row) {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    client: row.client,
    startDate: row.start_date,
    plannedEndDate: row.planned_end_date,
    status: row.status,
  };
}

function toSite(row) {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    name: row.name,
    location: row.location,
    isActive: row.is_active,
  };
}

// ------------------------------------------------------------- projects ----

async function listProjects({ status } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, code, name, client, start_date, planned_end_date, status
     FROM projects ${where}
     ORDER BY created_at DESC`,
    params
  );
  return rows.map(toProject);
}

async function getProject(id) {
  const { rows } = await query(
    `SELECT id, code, name, client, start_date, planned_end_date, status
     FROM projects WHERE id = $1`,
    [id]
  );
  return rows[0] ? toProject(rows[0]) : null;
}

async function createProject(data) {
  const { rows } = await query(
    `INSERT INTO projects (code, name, client, start_date, planned_end_date, status)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'active'))
     RETURNING id, code, name, client, start_date, planned_end_date, status`,
    [data.code, data.name, data.client ?? null, data.startDate ?? null,
     data.plannedEndDate ?? null, data.status ?? null]
  );
  return toProject(rows[0]);
}

/**
 * Partial update. COALESCE keeps any column the caller did not send, so a
 * PATCH with one field does not blank out the rest.
 */
async function updateProject(id, data) {
  const { rows } = await query(
    `UPDATE projects SET
       name             = COALESCE($2, name),
       client           = COALESCE($3, client),
       start_date       = COALESCE($4, start_date),
       planned_end_date = COALESCE($5, planned_end_date),
       status           = COALESCE($6, status)
     WHERE id = $1
     RETURNING id, code, name, client, start_date, planned_end_date, status`,
    [id, data.name ?? null, data.client ?? null, data.startDate ?? null,
     data.plannedEndDate ?? null, data.status ?? null]
  );
  return rows[0] ? toProject(rows[0]) : null;
}

// ---------------------------------------------------------------- sites ----

async function listSites(projectId) {
  const { rows } = await query(
    `SELECT id, project_id, name, location, is_active
     FROM sites WHERE project_id = $1 ORDER BY name`,
    [projectId]
  );
  return rows.map(toSite);
}

async function getSite(id) {
  const { rows } = await query(
    `SELECT id, project_id, name, location, is_active FROM sites WHERE id = $1`,
    [id]
  );
  return rows[0] ? toSite(rows[0]) : null;
}

async function createSite(projectId, data) {
  const { rows } = await query(
    `INSERT INTO sites (project_id, name, location)
     VALUES ($1, $2, $3)
     RETURNING id, project_id, name, location, is_active`,
    [projectId, data.name, data.location ?? null]
  );
  return toSite(rows[0]);
}

// ----------------------------------------------------------- assignments ---

async function assignSupervisor(siteId, userId) {
  await query(
    `INSERT INTO site_assignments (user_id, site_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, siteId]
  );
}

async function unassignSupervisor(siteId, userId) {
  const { rowCount } = await query(
    'DELETE FROM site_assignments WHERE user_id = $1 AND site_id = $2',
    [userId, siteId]
  );
  return rowCount > 0;
}

async function listSiteSupervisors(siteId) {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email
     FROM site_assignments a
     JOIN users u ON u.id = a.user_id
     WHERE a.site_id = $1
     ORDER BY u.full_name`,
    [siteId]
  );
  return rows.map((r) => ({ id: Number(r.id), fullName: r.full_name, email: r.email }));
}

module.exports = {
  listProjects, getProject, createProject, updateProject,
  listSites, getSite, createSite,
  assignSupervisor, unassignSupervisor, listSiteSupervisors,
};

'use strict';

const { z } = require('zod');
const service = require('../services/project.service');

const idParam = z.coerce.number().int().positive();

const createProjectSchema = z.object({
  code: z.string().min(2, 'Project code is required.'),
  name: z.string().min(2, 'Project name is required.'),
  client: z.string().optional(),
  startDate: z.string().date().optional(),
  plannedEndDate: z.string().date().optional(),
  status: z.enum(['planned', 'active', 'on_hold', 'completed']).optional(),
});

const updateProjectSchema = createProjectSchema.partial().omit({ code: true });

const createSiteSchema = z.object({
  name: z.string().min(2, 'Site name is required.'),
  location: z.string().optional(),
});

const assignSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

function firstIssue(result) {
  return result.error.issues[0]?.message || 'Invalid request.';
}

function parseId(value) {
  const parsed = idParam.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ------------------------------------------------------------- projects ----

async function list(req, res, next) {
  try {
    res.json({ projects: await service.listProjects({ status: req.query.status }) });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid project id.' });

  try {
    const project = await service.getProject(id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    return res.json({ project });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  try {
    return res.status(201).json({ project: await service.createProject(parsed.data) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A project with that code already exists.' });
    }
    return next(err);
  }
}

async function update(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid project id.' });

  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  try {
    const project = await service.updateProject(id, parsed.data);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    return res.json({ project });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------- sites ----

async function listSites(req, res, next) {
  const projectId = parseId(req.params.id);
  if (!projectId) return res.status(400).json({ error: 'Invalid project id.' });

  try {
    return res.json({ sites: await service.listSites(projectId) });
  } catch (err) {
    return next(err);
  }
}

async function createSite(req, res, next) {
  const projectId = parseId(req.params.id);
  if (!projectId) return res.status(400).json({ error: 'Invalid project id.' });

  const parsed = createSiteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  try {
    const project = await service.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    return res.status(201).json({ site: await service.createSite(projectId, parsed.data) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A site with that name already exists on this project.' });
    }
    return next(err);
  }
}

// ----------------------------------------------------------- assignments ---

async function listSupervisors(req, res, next) {
  const siteId = parseId(req.params.siteId);
  if (!siteId) return res.status(400).json({ error: 'Invalid site id.' });

  try {
    return res.json({ supervisors: await service.listSiteSupervisors(siteId) });
  } catch (err) {
    return next(err);
  }
}

async function assign(req, res, next) {
  const siteId = parseId(req.params.siteId);
  if (!siteId) return res.status(400).json({ error: 'Invalid site id.' });

  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed) });

  try {
    const site = await service.getSite(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found.' });

    await service.assignSupervisor(siteId, parsed.data.userId);
    return res.status(201).json({ assigned: true, siteId, userId: parsed.data.userId });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(404).json({ error: 'That user does not exist.' });
    }
    return next(err);
  }
}

async function unassign(req, res, next) {
  const siteId = parseId(req.params.siteId);
  const userId = parseId(req.params.userId);
  if (!siteId || !userId) return res.status(400).json({ error: 'Invalid id.' });

  try {
    const removed = await service.unassignSupervisor(siteId, userId);
    if (!removed) return res.status(404).json({ error: 'That assignment does not exist.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list, getOne, create, update,
  listSites, createSite,
  listSupervisors, assign, unassign,
};

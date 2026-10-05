'use strict';

jest.mock('../src/db/pool', () => {
  const query = jest.fn();
  return {
    pool: { end: jest.fn() },
    query,
    withTransaction: jest.fn(async (cb) => cb({ query })),
  };
});

const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/db/pool');
const { signToken } = require('../src/utils/token');
const { ROLES } = require('../src/constants/roles');

const admin = { id: 1, full_name: 'Admin', email: 'admin@t.test', role: ROLES.ADMIN, is_active: true };
const manager = { ...admin, id: 2, role: ROLES.MANAGER, email: 'mgr@t.test' };
const supervisor = { ...admin, id: 3, role: ROLES.SUPERVISOR, email: 'sup@t.test' };

const projectRow = {
  id: 10, code: 'TIH-001', name: 'Bompai Road Facility Upgrade', client: 'Internal',
  start_date: '2026-09-01', planned_end_date: null, status: 'active',
};

const siteRow = { id: 100, project_id: 10, name: 'Main Site', location: 'Kano', is_active: true };

function auth(user) {
  return `Bearer ${signToken(user)}`;
}

beforeEach(() => query.mockReset());

describe('GET /api/projects', () => {
  test('a manager can list projects', async () => {
    query
      .mockResolvedValueOnce({ rows: [manager] })
      .mockResolvedValueOnce({ rows: [projectRow] });

    const res = await request(app).get('/api/projects').set('Authorization', auth(manager));

    expect(res.status).toBe(200);
    expect(res.body.projects[0].code).toBe('TIH-001');
  });

  test('a site supervisor cannot list projects', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app).get('/api/projects').set('Authorization', auth(supervisor));

    expect(res.status).toBe(403);
  });

  test('no token is refused', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/projects', () => {
  test('an administrator can create a project', async () => {
    query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [projectRow] });

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', auth(admin))
      .send({ code: 'TIH-001', name: 'Bompai Road Facility Upgrade' });

    expect(res.status).toBe(201);
    expect(res.body.project.id).toBe(10);
  });

  test('a manager cannot create a project', async () => {
    query.mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', auth(manager))
      .send({ code: 'TIH-002', name: 'Another Project' });

    expect(res.status).toBe(403);
  });

  test('a duplicate project code returns 409', async () => {
    const dup = Object.assign(new Error('duplicate'), { code: '23505' });
    query.mockResolvedValueOnce({ rows: [admin] }).mockRejectedValueOnce(dup);

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', auth(admin))
      .send({ code: 'TIH-001', name: 'Duplicate' });

    expect(res.status).toBe(409);
  });

  test('a missing name is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [admin] });

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', auth(admin))
      .send({ code: 'TIH-003' });

    expect(res.status).toBe(400);
  });

  test('a malformed start date is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [admin] });

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', auth(admin))
      .send({ code: 'TIH-004', name: 'Bad Date', startDate: '01/09/2026' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects/:id', () => {
  test('returns 404 for a project that does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [manager] }).mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/projects/999').set('Authorization', auth(manager));

    expect(res.status).toBe(404);
  });

  test('rejects a non-numeric id', async () => {
    query.mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app).get('/api/projects/abc').set('Authorization', auth(manager));

    expect(res.status).toBe(400);
  });
});

describe('sites', () => {
  test('an administrator can add a site to a project', async () => {
    query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [projectRow] })
      .mockResolvedValueOnce({ rows: [siteRow] });

    const res = await request(app)
      .post('/api/projects/10/sites')
      .set('Authorization', auth(admin))
      .send({ name: 'Main Site', location: 'Kano' });

    expect(res.status).toBe(201);
    expect(res.body.site.name).toBe('Main Site');
  });

  test('adding a site to a missing project returns 404', async () => {
    query.mockResolvedValueOnce({ rows: [admin] }).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/projects/999/sites')
      .set('Authorization', auth(admin))
      .send({ name: 'Ghost Site' });

    expect(res.status).toBe(404);
  });

  test('an administrator can assign a supervisor to a site', async () => {
    query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [siteRow] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/sites/100/supervisors')
      .set('Authorization', auth(admin))
      .send({ userId: 3 });

    expect(res.status).toBe(201);
    expect(res.body.assigned).toBe(true);
  });

  test('a supervisor cannot assign themselves to a site', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .post('/api/sites/100/supervisors')
      .set('Authorization', auth(supervisor))
      .send({ userId: 3 });

    expect(res.status).toBe(403);
  });
});

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

const supervisor = {
  id: 3, full_name: 'Khalil Abdullahi', email: 'k@t.test',
  role: ROLES.SUPERVISOR, is_active: true, must_change_password: false,
};
const manager = { ...supervisor, id: 2, role: ROLES.MANAGER, email: 'm@t.test' };

const siteRow = {
  id: 1, project_id: 10, name: 'Main Site', location: 'Kano',
  is_active: true, project_name: 'Bompai Road Facility Upgrade',
};

const auth = (u) => `Bearer ${signToken(u)}`;

beforeEach(() => query.mockReset());

describe('GET /api/sites/mine', () => {
  test('a supervisor gets their assigned sites', async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [siteRow] });

    const res = await request(app).get('/api/sites/mine').set('Authorization', auth(supervisor));

    expect(res.status).toBe(200);
    expect(res.body.sites[0].name).toBe('Main Site');
    expect(res.body.sites[0].projectName).toBe('Bompai Road Facility Upgrade');
  });

  test("a supervisor's query is narrowed by their assignments, in SQL", async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app).get('/api/sites/mine').set('Authorization', auth(supervisor));

    const [sql, params] = query.mock.calls[1];
    expect(sql).toMatch(/site_assignments/);
    expect(params).toEqual([supervisor.id]);
  });

  test('a manager gets every active site, unfiltered', async () => {
    query
      .mockResolvedValueOnce({ rows: [manager] })
      .mockResolvedValueOnce({ rows: [siteRow] });

    const res = await request(app).get('/api/sites/mine').set('Authorization', auth(manager));

    expect(res.status).toBe(200);

    const [sql, params] = query.mock.calls[1];
    expect(sql).not.toMatch(/site_assignments/);
    expect(params).toEqual([]);
  });

  test('an unassigned supervisor gets an empty list, not an error', async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/sites/mine').set('Authorization', auth(supervisor));

    expect(res.status).toBe(200);
    expect(res.body.sites).toEqual([]);
  });

  test('it requires a token', async () => {
    const res = await request(app).get('/api/sites/mine');
    expect(res.status).toBe(401);
  });
});

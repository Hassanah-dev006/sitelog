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

const manager = { id: 2, full_name: 'Manager', email: 'mgr@t.test', role: ROLES.MANAGER, is_active: true };
const admin = { ...manager, id: 1, role: ROLES.ADMIN, email: 'admin@t.test' };
const supervisor = { ...manager, id: 3, role: ROLES.SUPERVISOR, email: 'sup@t.test' };

const auth = (u) => `Bearer ${signToken(u)}`;

const summaryRow = {
  active_projects: 3,
  active_sites: 7,
  reports_today: 5,
  incidents_week: 4,
  high_incidents_week: 1,
};

/** The overview fires five aggregations in parallel after the auth lookup. */
function mockOverview() {
  query
    .mockResolvedValueOnce({ rows: [manager] })
    .mockResolvedValueOnce({ rows: [summaryRow] })
    .mockResolvedValueOnce({
      rows: [{ id: 100, name: 'Main Site', project_name: 'Bompai Road', last_report_date: '2026-10-03' }],
    })
    .mockResolvedValueOnce({ rows: [{ report_date: '2026-10-05', reports: 5 }] })
    .mockResolvedValueOnce({ rows: [{ trade: 'Masons', headcount: 24, hours: 180 }] })
    .mockResolvedValueOnce({ rows: [{ equipment_name: 'Excavator', hours: 42, breakdowns: 1 }] });
}

beforeEach(() => query.mockReset());

describe('GET /api/dashboard', () => {
  test('a manager gets the whole overview in one response', async () => {
    mockOverview();

    const res = await request(app).get('/api/dashboard').set('Authorization', auth(manager));

    expect(res.status).toBe(200);
    expect(res.body.summary.activeSites).toBe(7);
    expect(res.body.outstanding[0].siteName).toBe('Main Site');
    expect(res.body.manpower[0].trade).toBe('Masons');
    expect(res.body.equipment[0].breakdowns).toBe(1);
    expect(res.body.trend).toHaveLength(1);
  });

  test('a site supervisor cannot see the dashboard', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app).get('/api/dashboard').set('Authorization', auth(supervisor));

    expect(res.status).toBe(403);
  });

  test('an administrator can see the dashboard', async () => {
    query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [summaryRow] })
      .mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/dashboard').set('Authorization', auth(admin));

    expect(res.status).toBe(200);
  });

  test('the dashboard requires a token', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  test('a reversed date range is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app)
      .get('/api/dashboard?from=2026-10-20&to=2026-10-01')
      .set('Authorization', auth(manager));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/before the end date/i);
  });

  test('a malformed date is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app)
      .get('/api/dashboard?from=05-10-2026')
      .set('Authorization', auth(manager));

    expect(res.status).toBe(400);
  });

  test('the requested range is echoed back', async () => {
    mockOverview();

    const res = await request(app)
      .get('/api/dashboard?from=2026-09-01&to=2026-09-30')
      .set('Authorization', auth(manager));

    expect(res.body.range.from).toBe('2026-09-01');
    expect(res.body.range.to).toBe('2026-09-30');
  });

  test('a project filter is passed into the manpower query', async () => {
    mockOverview();

    await request(app)
      .get('/api/dashboard?projectId=10')
      .set('Authorization', auth(manager));

    const manpowerCall = query.mock.calls.find((c) => /manpower_entries/.test(c[0]));
    expect(manpowerCall[0]).toMatch(/project_id/);
    expect(manpowerCall[1]).toContain(10);
  });
});

describe('GET /api/dashboard/outstanding', () => {
  test('returns the sites that have not reported, with a count', async () => {
    query
      .mockResolvedValueOnce({ rows: [manager] })
      .mockResolvedValueOnce({
        rows: [
          { id: 100, name: 'Main Site', project_name: 'Bompai Road', last_report_date: '2026-10-03' },
          { id: 101, name: 'Workshop Yard', project_name: 'Bompai Road', last_report_date: null },
        ],
      });

    const res = await request(app)
      .get('/api/dashboard/outstanding')
      .set('Authorization', auth(manager));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.outstanding[1].lastReportDate).toBeNull();
  });

  test('a supervisor cannot see it', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .get('/api/dashboard/outstanding')
      .set('Authorization', auth(supervisor));

    expect(res.status).toBe(403);
  });
});

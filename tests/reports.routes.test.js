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
const supervisor = { id: 3, full_name: 'Supervisor', email: 'sup@t.test', role: ROLES.SUPERVISOR, is_active: true };

const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const reportRow = {
  id: 500,
  site_id: 100,
  report_date: YESTERDAY,
  submitted_by: 3,
  submitted_by_name: 'Supervisor',
  weather: 'Clear',
  progress_notes: 'Foundation work continued on block B.',
  delays_notes: null,
  status: 'submitted',
  submitted_at: new Date().toISOString(),
  site_name: 'Main Site',
  project_id: 10,
  project_name: 'Bompai Road Facility Upgrade',
};

const auth = (u) => `Bearer ${signToken(u)}`;

const validBody = {
  siteId: 100,
  reportDate: YESTERDAY,
  weather: 'Clear',
  progressNotes: 'Foundation work continued on block B.',
  manpower: [{ trade: 'Masons', headcount: 6, hoursWorked: 8 }],
  equipment: [{ equipmentName: 'Excavator', hoursRun: 5, status: 'operational' }],
  materials: [{ materialName: 'Cement', unit: 'bags', quantityReceived: 100, quantityUsed: 60 }],
  incidents: [{ category: 'safety', severity: 'low', description: 'Minor hand injury, first aid given.' }],
};

beforeEach(() => query.mockReset());

describe('POST /api/reports', () => {
  test('an assigned supervisor can submit a full report', async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })  // requireAuth
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // site assignment check
      .mockResolvedValueOnce({ rows: [reportRow] })   // insert report
      .mockResolvedValue({ rows: [] });               // line item inserts

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.report.id).toBe(500);
    expect(res.body.report.counts).toEqual({
      manpower: 1, equipment: 1, materials: 1, incidents: 1,
    });
  });

  test('a supervisor not assigned to the site is refused', async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [] }); // no assignment

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not assigned/i);
  });

  test('a second report for the same site and date returns 409', async () => {
    const dup = Object.assign(new Error('duplicate'), { code: '23505' });
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockRejectedValueOnce(dup);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test('a report dated in the future is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send({ ...validBody, reportDate: TOMORROW });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/i);
  });

  test('a malformed date is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send({ ...validBody, reportDate: '05-10-2026' });

    expect(res.status).toBe(400);
  });

  test('a negative headcount is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send({ ...validBody, manpower: [{ trade: 'Masons', headcount: -3 }] });

    expect(res.status).toBe(400);
  });

  test('more than 24 equipment hours in a day is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send({ ...validBody, equipment: [{ equipmentName: 'Crane', hoursRun: 30 }] });

    expect(res.status).toBe(400);
  });

  test('an unknown incident category is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send({
        ...validBody,
        incidents: [{ category: 'alien-invasion', description: 'Unexpected.' }],
      });

    expect(res.status).toBe(400);
  });

  test('a report for a site that does not exist returns 404', async () => {
    const fk = Object.assign(new Error('fk violation'), { code: '23503' });
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockRejectedValueOnce(fk);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send(validBody);

    expect(res.status).toBe(404);
  });

  test('a retried submission returns 200 and does not store a duplicate', async () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [] })          // ON CONFLICT DO NOTHING — already stored
      .mockResolvedValueOnce({ rows: [reportRow] }); // fetch the one already there

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send({ ...validBody, clientUuid: uuid });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
    expect(res.body.report.id).toBe(500);
  });

  test('a first submission reports created: true', async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [reportRow] })
      .mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send({ ...validBody, clientUuid: '3f2504e0-4f89-41d3-9a0c-0305e82c3302' });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
  });

  test('a malformed clientUuid is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send({ ...validBody, clientUuid: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  test('a report with no line items is still accepted', async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [reportRow] });

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', auth(supervisor))
      .send({ siteId: 100, reportDate: YESTERDAY, progressNotes: 'Quiet day.' });

    expect(res.status).toBe(201);
    expect(res.body.report.counts.manpower).toBe(0);
  });
});

describe('GET /api/reports', () => {
  test('a manager lists reports without a site restriction', async () => {
    query.mockResolvedValueOnce({ rows: [manager] }).mockResolvedValueOnce({ rows: [reportRow] });

    const res = await request(app).get('/api/reports').set('Authorization', auth(manager));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);

    const sql = query.mock.calls[1][0];
    expect(sql).not.toMatch(/site_assignments/);
  });

  test("a supervisor's listing is restricted in SQL to assigned sites", async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] }).mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/reports').set('Authorization', auth(supervisor));

    expect(res.status).toBe(200);

    const sql = query.mock.calls[1][0];
    expect(sql).toMatch(/site_assignments/);
  });

  test('date filters are passed through as parameters', async () => {
    query.mockResolvedValueOnce({ rows: [manager] }).mockResolvedValueOnce({ rows: [] });

    await request(app)
      .get('/api/reports?from=2026-09-01&to=2026-09-30')
      .set('Authorization', auth(manager));

    const params = query.mock.calls[1][1];
    expect(params).toContain('2026-09-01');
    expect(params).toContain('2026-09-30');
  });

  test('an over-large limit is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app)
      .get('/api/reports?limit=5000')
      .set('Authorization', auth(manager));

    expect(res.status).toBe(400);
  });
});

describe('GET /api/reports/:id', () => {
  test('a manager can read a full report with its line items', async () => {
    query
      .mockResolvedValueOnce({ rows: [manager] })
      .mockResolvedValueOnce({ rows: [reportRow] })
      .mockResolvedValueOnce({ rows: [{ trade: 'Masons', headcount: 6, hours_worked: 8 }] })
      .mockResolvedValueOnce({ rows: [{ equipment_name: 'Excavator', hours_run: 5, status: 'operational' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/reports/500').set('Authorization', auth(manager));

    expect(res.status).toBe(200);
    expect(res.body.report.manpower[0].trade).toBe('Masons');
    expect(res.body.report.equipment[0].equipmentName).toBe('Excavator');
  });

  test('a supervisor reading a report for a site they do not cover gets 404, not 403', async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [reportRow] })
      .mockResolvedValueOnce({ rows: [] })  // manpower
      .mockResolvedValueOnce({ rows: [] })  // equipment
      .mockResolvedValueOnce({ rows: [] })  // materials
      .mockResolvedValueOnce({ rows: [] })  // incidents
      .mockResolvedValueOnce({ rows: [] }); // access check: not assigned

    const res = await request(app).get('/api/reports/500').set('Authorization', auth(supervisor));

    expect(res.status).toBe(404);
  });

  test('a missing report returns 404', async () => {
    query.mockResolvedValueOnce({ rows: [manager] }).mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/reports/9999').set('Authorization', auth(manager));

    expect(res.status).toBe(404);
  });

  test('reports require authentication', async () => {
    const res = await request(app).get('/api/reports/500');
    expect(res.status).toBe(401);
  });
});

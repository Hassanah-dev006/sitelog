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
const { summarise } = require('../src/services/export.service');

const manager = { id: 2, full_name: 'Manager', email: 'mgr@t.test', role: ROLES.MANAGER, is_active: true };
const supervisor = { ...manager, id: 3, role: ROLES.SUPERVISOR, email: 'sup@t.test' };

const auth = (u) => `Bearer ${signToken(u)}`;

const reportRow = {
  id: 1,
  report_date: '2026-10-01',
  weather: 'Clear',
  progress_notes: 'Foundation work continued on block B.',
  delays_notes: null,
  site_name: 'Main Site',
  project_name: 'Bompai Road Facility Upgrade',
  project_code: 'TIH-001',
  submitted_by: 'Musa Ibrahim',
  headcount: 24,
  manpower_hours: 180,
  equipment_hours: 42,
  breakdowns: 0,
  incident_count: 0,
};

const RANGE = 'from=2026-10-01&to=2026-10-07';

beforeEach(() => query.mockReset());

describe('GET /api/export/pdf', () => {
  test('returns a real PDF as an attachment', async () => {
    query
      .mockResolvedValueOnce({ rows: [manager] })
      .mockResolvedValueOnce({ rows: [reportRow] });

    const res = await request(app)
      .get(`/api/export/pdf?${RANGE}`)
      .set('Authorization', auth(manager))
      .buffer()
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=/);
    // A PDF always starts with this signature.
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('a supervisor cannot export', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .get(`/api/export/pdf?${RANGE}`)
      .set('Authorization', auth(supervisor));

    expect(res.status).toBe(403);
  });

  test('a missing date range is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app)
      .get('/api/export/pdf')
      .set('Authorization', auth(manager));

    expect(res.status).toBe(400);
  });

  test('a reversed range is rejected', async () => {
    query.mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app)
      .get('/api/export/pdf?from=2026-10-20&to=2026-10-01')
      .set('Authorization', auth(manager));

    expect(res.status).toBe(400);
  });

  test('an unbounded range is refused rather than pulling every report ever filed', async () => {
    query.mockResolvedValueOnce({ rows: [manager] });

    const res = await request(app)
      .get('/api/export/pdf?from=2020-01-01&to=2026-12-31')
      .set('Authorization', auth(manager));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most/i);
  });
});

describe('GET /api/export/xlsx', () => {
  test('returns a real spreadsheet as an attachment', async () => {
    query
      .mockResolvedValueOnce({ rows: [manager] })
      .mockResolvedValue({ rows: [reportRow] });

    const res = await request(app)
      .get(`/api/export/xlsx?${RANGE}`)
      .set('Authorization', auth(manager))
      .buffer()
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml\.sheet/);
    // An .xlsx is a zip archive, which always starts "PK".
    expect(res.body.subarray(0, 2).toString()).toBe('PK');
  });

  test('a supervisor cannot export', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .get(`/api/export/xlsx?${RANGE}`)
      .set('Authorization', auth(supervisor));

    expect(res.status).toBe(403);
  });
});

describe('summarise', () => {
  test('totals the figures the PDF header reports', () => {
    const rows = [
      { site_name: 'A', manpower_hours: 180, equipment_hours: 42, incident_count: 0, breakdowns: 0 },
      { site_name: 'A', manpower_hours: 96, equipment_hours: 12, incident_count: 1, breakdowns: 1 },
      { site_name: 'B', manpower_hours: 72, equipment_hours: 20, incident_count: 2, breakdowns: 0 },
    ];

    expect(summarise(rows)).toEqual({
      reports: 3,
      sites: 2,
      manpowerHours: 348,
      equipmentHours: 74,
      incidents: 3,
      breakdowns: 1,
    });
  });

  test('an empty week totals to zero rather than NaN', () => {
    expect(summarise([])).toEqual({
      reports: 0, sites: 0, manpowerHours: 0,
      equipmentHours: 0, incidents: 0, breakdowns: 0,
    });
  });
});

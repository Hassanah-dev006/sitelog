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
  id: 3, full_name: 'Supervisor', email: 'sup@t.test',
  role: ROLES.SUPERVISOR, is_active: true,
};

const auth = (u) => `Bearer ${signToken(u)}`;

// A one-pixel PNG is enough to exercise the upload path.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

beforeEach(() => query.mockReset());

describe('POST /api/reports/:id/photos', () => {
  test('an assigned supervisor can attach a photo', async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })          // requireAuth
      .mockResolvedValueOnce({ rows: [{ site_id: 100 }] })    // report lookup
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })   // site assignment
      .mockResolvedValueOnce({
        rows: [{
          id: 9, file_path: 'x.png', byte_size: PNG.length,
          mime_type: 'image/png', uploaded_at: new Date().toISOString(),
        }],
      });

    const res = await request(app)
      .post('/api/reports/500/photos')
      .set('Authorization', auth(supervisor))
      .attach('photos', PNG, 'site.png');

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(1);
  });

  test('a non-image file is refused', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .post('/api/reports/500/photos')
      .set('Authorization', auth(supervisor))
      .attach('photos', Buffer.from('not an image'), 'notes.txt');

    expect(res.status).toBe(400);
  });

  test('a request with no file attached is refused', async () => {
    query.mockResolvedValueOnce({ rows: [supervisor] });

    const res = await request(app)
      .post('/api/reports/500/photos')
      .set('Authorization', auth(supervisor));

    expect(res.status).toBe(400);
  });

  test('a photo for a report on another site returns 404', async () => {
    query
      .mockResolvedValueOnce({ rows: [supervisor] })
      .mockResolvedValueOnce({ rows: [{ site_id: 999 }] })
      .mockResolvedValueOnce({ rows: [] }); // not assigned

    const res = await request(app)
      .post('/api/reports/500/photos')
      .set('Authorization', auth(supervisor))
      .attach('photos', PNG, 'site.png');

    expect(res.status).toBe(404);
  });

  test('uploading requires authentication', async () => {
    const res = await request(app)
      .post('/api/reports/500/photos')
      .attach('photos', PNG, 'site.png');

    expect(res.status).toBe(401);
  });
});

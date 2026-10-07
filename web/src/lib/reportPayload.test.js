import { describe, expect, test } from 'vitest';
import { buildReportPayload, validateReport, EMPTY_FORM } from './reportPayload';

const base = {
  ...EMPTY_FORM,
  siteId: '100',
  reportDate: '2026-10-05',
};

describe('buildReportPayload', () => {
  test('site id becomes a number', () => {
    expect(buildReportPayload(base).siteId).toBe(100);
  });

  test('blank optional text is left out entirely', () => {
    const payload = buildReportPayload({ ...base, weather: '   ', progressNotes: '' });
    expect(payload).not.toHaveProperty('weather');
    expect(payload).not.toHaveProperty('progressNotes');
  });

  test('text is trimmed', () => {
    const payload = buildReportPayload({ ...base, progressNotes: '  Block B poured.  ' });
    expect(payload.progressNotes).toBe('Block B poured.');
  });

  test('a row the user started but left blank is dropped', () => {
    const payload = buildReportPayload({
      ...base,
      manpower: [
        { trade: 'Masons', headcount: '6', hoursWorked: '8' },
        { trade: '', headcount: '', hoursWorked: '' },
      ],
    });
    expect(payload.manpower).toHaveLength(1);
    expect(payload.manpower[0]).toEqual({ trade: 'Masons', headcount: 6, hoursWorked: 8 });
  });

  test('empty arrays are omitted rather than sent as []', () => {
    const payload = buildReportPayload(base);
    expect(payload).not.toHaveProperty('manpower');
    expect(payload).not.toHaveProperty('incidents');
  });

  test('numbers arrive as numbers, not strings', () => {
    const payload = buildReportPayload({
      ...base,
      materials: [
        { materialName: 'Cement', unit: 'bags', quantityReceived: '100', quantityUsed: '60' },
      ],
    });
    expect(payload.materials[0].quantityReceived).toBe(100);
    expect(payload.materials[0].quantityUsed).toBe(60);
  });

  test('an omitted hours field is left out, not sent as zero', () => {
    const payload = buildReportPayload({
      ...base,
      manpower: [{ trade: 'Welders', headcount: '2', hoursWorked: '' }],
    });
    expect(payload.manpower[0]).not.toHaveProperty('hoursWorked');
  });

  test('incidents default to other/low when nothing is chosen', () => {
    const payload = buildReportPayload({
      ...base,
      incidents: [{ category: '', severity: '', description: 'Gate left open.' }],
    });
    expect(payload.incidents[0].category).toBe('other');
    expect(payload.incidents[0].severity).toBe('low');
  });
});

describe('validateReport', () => {
  const today = '2026-10-05';

  test('a complete form passes', () => {
    expect(validateReport(base, today)).toEqual([]);
  });

  test('a missing site is caught', () => {
    expect(validateReport({ ...base, siteId: '' }, today)).toContain('Choose a site.');
  });

  test('a future date is caught on the phone, before sending', () => {
    const errors = validateReport({ ...base, reportDate: '2026-12-25' }, today);
    expect(errors.join(' ')).toMatch(/future/i);
  });

  test("today's date is allowed", () => {
    expect(validateReport({ ...base, reportDate: today }, today)).toEqual([]);
  });

  test('a trade without a headcount is caught', () => {
    const errors = validateReport(
      { ...base, manpower: [{ trade: 'Masons', headcount: '', hoursWorked: '' }] },
      today
    );
    expect(errors.join(' ')).toMatch(/headcount for Masons/i);
  });
});

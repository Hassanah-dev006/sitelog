import { describe, expect, test } from 'vitest';
import { filenameFromDisposition } from './download';

describe('filenameFromDisposition', () => {
  test('reads a quoted filename', () => {
    const header = 'attachment; filename="sitelog-weekly-report-2026-10-10-to-2026-10-23.pdf"';
    expect(filenameFromDisposition(header)).toBe(
      'sitelog-weekly-report-2026-10-10-to-2026-10-23.pdf'
    );
  });

  test('reads an unquoted filename', () => {
    expect(filenameFromDisposition('attachment; filename=data.xlsx')).toBe('data.xlsx');
  });

  test('prefers the encoded form when both are present', () => {
    const header = "attachment; filename=\"plain.pdf\"; filename*=UTF-8''r%C3%A9port.pdf";
    expect(filenameFromDisposition(header)).toBe('réport.pdf');
  });

  test('falls back when the header is missing', () => {
    expect(filenameFromDisposition(null, 'export.pdf')).toBe('export.pdf');
    expect(filenameFromDisposition(undefined, 'export.pdf')).toBe('export.pdf');
  });

  test('falls back when the header has no filename', () => {
    expect(filenameFromDisposition('attachment', 'export.pdf')).toBe('export.pdf');
  });

  test('falls back rather than throwing on a malformed encoding', () => {
    const header = "attachment; filename*=UTF-8''%E0%A4%A";
    expect(filenameFromDisposition(header, 'export.pdf')).toBe('export.pdf');
  });
});

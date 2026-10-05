import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as outbox from './outbox';

/** Minimal localStorage so these run without a browser. */
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  // Node supplies crypto.randomUUID, and globalThis.crypto is read-only.
});

const payload = { siteId: 100, reportDate: '2026-10-05', progressNotes: 'Block B poured.' };

describe('queueing', () => {
  test('a queued report survives and is counted', () => {
    outbox.enqueue(payload);
    expect(outbox.count()).toBe(1);
    expect(outbox.list()[0].payload.progressNotes).toBe('Block B poured.');
  });

  test('every entry gets a clientUuid that is stored in the payload', () => {
    const entry = outbox.enqueue(payload);
    expect(entry.clientUuid).toBeTruthy();
    expect(entry.payload.clientUuid).toBe(entry.clientUuid);
  });

  test('a supplied clientUuid is kept, so a retry reuses the same id', () => {
    const entry = outbox.enqueue({ ...payload, clientUuid: 'fixed-id' });
    expect(entry.clientUuid).toBe('fixed-id');
  });

  test('corrupt storage is treated as an empty queue, not a crash', () => {
    localStorage.setItem('sitelog.outbox', 'not json');
    expect(outbox.list()).toEqual([]);
  });
});

describe('flush', () => {
  test('a successful send clears the entry', async () => {
    outbox.enqueue(payload);
    const send = vi.fn().mockResolvedValue({ report: { id: 1 } });

    const result = await outbox.flush(send);

    expect(result.sent).toBe(1);
    expect(outbox.count()).toBe(0);
  });

  test('a network failure keeps the report queued for later', async () => {
    outbox.enqueue(payload);
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('offline'), { status: 0 }));

    const result = await outbox.flush(send);

    expect(result.failed).toBe(1);
    expect(outbox.count()).toBe(1);
    expect(outbox.list()[0].attempts).toBe(1);
  });

  test('a 500 is treated as temporary and kept', async () => {
    outbox.enqueue(payload);
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('server'), { status: 500 }));

    await outbox.flush(send);

    expect(outbox.count()).toBe(1);
  });

  test('a 400 is permanent: dropped and reported, not retried forever', async () => {
    outbox.enqueue(payload);
    const send = vi.fn().mockRejectedValue(
      Object.assign(new Error('Report cannot be dated in the future.'), { status: 400 })
    );

    const result = await outbox.flush(send);

    expect(outbox.count()).toBe(0);
    expect(result.stuck).toHaveLength(1);
    expect(result.stuck[0].lastError).toMatch(/future/);
  });

  test('a 429 is treated as temporary and kept', async () => {
    outbox.enqueue(payload);
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('slow down'), { status: 429 }));

    await outbox.flush(send);

    expect(outbox.count()).toBe(1);
  });

  test('the same clientUuid is resent on retry, so the server can deduplicate', async () => {
    const entry = outbox.enqueue(payload);
    const send = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { status: 0 }))
      .mockResolvedValueOnce({ report: { id: 1 } });

    await outbox.flush(send);
    await outbox.flush(send);

    expect(send.mock.calls[0][0].clientUuid).toBe(entry.clientUuid);
    expect(send.mock.calls[1][0].clientUuid).toBe(entry.clientUuid);
    expect(outbox.count()).toBe(0);
  });

  test('several queued reports are delivered in one flush', async () => {
    outbox.enqueue(payload);
    outbox.enqueue({ ...payload, reportDate: '2026-10-04' });
    const send = vi.fn().mockResolvedValue({ report: { id: 1 } });

    const result = await outbox.flush(send);

    expect(result.sent).toBe(2);
    expect(outbox.count()).toBe(0);
  });

  test('one failure does not block the others', async () => {
    outbox.enqueue(payload);
    outbox.enqueue({ ...payload, reportDate: '2026-10-04' });
    const send = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { status: 0 }))
      .mockResolvedValueOnce({ report: { id: 2 } });

    const result = await outbox.flush(send);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(outbox.count()).toBe(1);
  });

  test('flushing an empty queue does nothing', async () => {
    const send = vi.fn();
    const result = await outbox.flush(send);

    expect(send).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });
});

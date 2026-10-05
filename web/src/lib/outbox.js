/**
 * The outbox.
 *
 * Tihama's sites regularly have no usable signal. A supervisor who fills in a
 * report and loses it to a failed request will stop using the system within a
 * week, so a report is written to this queue the moment Send is pressed and
 * only removed once the server has confirmed it.
 *
 * Each entry carries a clientUuid generated once and reused on every retry,
 * so a resend after a dropped connection cannot store the report twice — the
 * API answers 200 instead of 201 and the entry is cleared.
 *
 * Storage is localStorage: it survives the browser being closed and the phone
 * being restarted, which sessionStorage does not.
 */

const KEY = 'sitelog.outbox';
const MAX_ATTEMPTS = 20;

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt or unavailable storage must not take the form down.
    return [];
  }
}

function writeRaw(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older mobile browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function list() {
  return readRaw();
}

export function count() {
  return readRaw().length;
}

/** Queues a report and returns the stored entry. */
export function enqueue(payload) {
  const entries = readRaw();
  const entry = {
    clientUuid: payload.clientUuid || newId(),
    payload: { ...payload },
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  entry.payload.clientUuid = entry.clientUuid;

  entries.push(entry);
  writeRaw(entries);
  return entry;
}

export function remove(clientUuid) {
  writeRaw(readRaw().filter((e) => e.clientUuid !== clientUuid));
}

export function recordFailure(clientUuid, message) {
  const entries = readRaw().map((e) =>
    e.clientUuid === clientUuid
      ? { ...e, attempts: e.attempts + 1, lastError: message || null }
      : e
  );
  writeRaw(entries);
}

/** Entries that have failed so often that retrying is pointless. */
export function isStuck(entry) {
  return entry.attempts >= MAX_ATTEMPTS;
}

export function clear() {
  writeRaw([]);
}

/**
 * Attempts to deliver everything queued.
 *
 * `send` is the API call, injected so this can be tested without a network.
 * Returns { sent, failed, stuck }.
 *
 * A 4xx other than 408/429 means the server rejected the report on its
 * merits — retrying would fail forever, so the entry is dropped and surfaced
 * to the user rather than retried silently.
 */
export async function flush(send) {
  const entries = readRaw();
  let sent = 0;
  let failed = 0;
  const stuck = [];

  for (const entry of entries) {
    if (isStuck(entry)) {
      stuck.push(entry);
      continue;
    }

    try {
      await send(entry.payload);
      remove(entry.clientUuid);
      sent += 1;
    } catch (err) {
      const status = err?.status ?? 0;
      const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;

      if (permanent) {
        remove(entry.clientUuid);
        stuck.push({ ...entry, lastError: err.message });
      } else {
        recordFailure(entry.clientUuid, err.message);
        failed += 1;
      }
    }
  }

  return { sent, failed, stuck };
}

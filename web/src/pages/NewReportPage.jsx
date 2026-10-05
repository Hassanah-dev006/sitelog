import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import Section from '../components/Section';
import OutboxBanner from '../components/OutboxBanner';
import PhotoPicker from '../components/PhotoPicker';
import useOnline from '../hooks/useOnline';
import * as outbox from '../lib/outbox';
import { buildReportPayload, validateReport, EMPTY_FORM } from '../lib/reportPayload';

/**
 * The daily site report form.
 *
 * This is the screen a supervisor fills in on a phone at the end of a long
 * day, so it is built to be short: only the site, the date and a progress
 * note are expected. Manpower, equipment, materials and incidents stay
 * collapsed until a row is added.
 *
 * Pressing Send never loses a report. It goes into the outbox first and is
 * delivered when the connection allows, which on Tihama's sites may be hours
 * later or back in town.
 */
export default function NewReportPage() {
  const online = useOnline();

  const [sites, setSites] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingSites, setLoadingSites] = useState(true);
  const [pending, setPending] = useState(() => outbox.count());
  const [sending, setSending] = useState(false);

  /** Try to deliver everything queued. Safe to call at any time. */
  const flushOutbox = useCallback(async () => {
    if (outbox.count() === 0) return;

    setSending(true);
    try {
      const { sent, stuck } = await outbox.flush((payload) => api.createReport(payload));

      if (sent > 0) {
        setSuccess(
          sent === 1 ? 'A saved report has been sent.' : `${sent} saved reports have been sent.`
        );
      }
      if (stuck.length > 0) {
        setSubmitError(
          `${stuck.length} saved report(s) were refused and removed: ${stuck[0].lastError}`
        );
      }
    } finally {
      setPending(outbox.count());
      setSending(false);
    }
  }, []);

  // Deliver anything left over from a previous session, then again whenever
  // the connection comes back.
  useEffect(() => {
    if (online) flushOutbox();
  }, [online, flushOutbox]);

  // Sites come from the projects the signed-in user may see.
  useEffect(() => {
    let cancelled = false;

    async function loadSites() {
      try {
        const { projects } = await api.listProjects();
        const lists = await Promise.all(
          projects.map((p) =>
            api
              .listSites(p.id)
              .then((d) => d.sites.map((s) => ({ ...s, projectName: p.name })))
              .catch(() => [])
          )
        );
        if (!cancelled) setSites(lists.flat());
      } catch {
        // A supervisor cannot list projects. They type the site id instead.
        if (!cancelled) setSites([]);
      } finally {
        if (!cancelled) setLoadingSites(false);
      }
    }

    loadSites();
    return () => {
      cancelled = true;
    };
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addRow(key, blank) {
    setForm((f) => ({ ...f, [key]: [...f[key], blank] }));
  }

  function updateRow(key, index, field, value) {
    setForm((f) => ({
      ...f,
      [key]: f[key].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  }

  function removeRow(key, index) {
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    setSuccess(null);

    const problems = validateReport(form);
    setErrors(problems);
    if (problems.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setBusy(true);

    // Queue first, send second. If the browser is killed between the two,
    // the report is still on the phone and goes out next time.
    const entry = outbox.enqueue(buildReportPayload(form));
    setPending(outbox.count());

    const clearForm = () => {
      setForm({ ...EMPTY_FORM, siteId: form.siteId });
      setPhotos([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    try {
      const { report } = await api.createReport(entry.payload);
      outbox.remove(entry.clientUuid);

      // Photos follow the report, and are allowed to fail on their own. The
      // written report is what matters and it is already safely stored.
      if (photos.length > 0) {
        try {
          await api.uploadPhotos(report.id, photos.map((p) => p.file));
          setSuccess(`Report and ${photos.length} photo(s) sent for ${report.reportDate}.`);
        } catch (photoErr) {
          setSuccess(`Report for ${report.reportDate} was sent. ${photoErr.message}`);
        }
      } else {
        setSuccess(`Report for ${report.siteName || 'the site'} on ${report.reportDate} was sent.`);
      }

      clearForm();
    } catch (err) {
      const status = err?.status ?? 0;
      const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;

      if (permanent) {
        // The server rejected it on its merits. Retrying would fail forever.
        outbox.remove(entry.clientUuid);
        setSubmitError(err.message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Network or server trouble. It stays queued and goes out later.
        outbox.recordFailure(entry.clientUuid, err.message);
        setSuccess('No connection. The report is saved on this phone and will send by itself.');
        clearForm();
      }
    } finally {
      setPending(outbox.count());
      setBusy(false);
    }
  }

  return (
    <form className="report-form" onSubmit={handleSubmit}>
      <h1 className="page-title">Daily site report</h1>

      <OutboxBanner online={online} pending={pending} sending={sending} />

      {success && <p className="alert alert-success" role="status">{success}</p>}
      {submitError && <p className="alert alert-error" role="alert">{submitError}</p>}
      {errors.length > 0 && (
        <ul className="alert alert-error" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {/* ---------------------------------------------------- the basics -- */}
      <div className="card">
        <label htmlFor="site">Site</label>
        {loadingSites ? (
          <p className="muted small">Loading sites…</p>
        ) : sites.length > 0 ? (
          <select id="site" value={form.siteId} onChange={(e) => set('siteId', e.target.value)}>
            <option value="">Choose a site…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.projectName}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="site"
            type="number"
            inputMode="numeric"
            placeholder="Site number"
            value={form.siteId}
            onChange={(e) => set('siteId', e.target.value)}
          />
        )}

        <label htmlFor="date">Date</label>
        <input
          id="date"
          type="date"
          value={form.reportDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => set('reportDate', e.target.value)}
        />

        <label htmlFor="weather">Weather</label>
        <input
          id="weather"
          type="text"
          placeholder="Clear, rain, harmattan…"
          value={form.weather}
          onChange={(e) => set('weather', e.target.value)}
        />

        <label htmlFor="progress">What was done today</label>
        <textarea
          id="progress"
          rows={4}
          placeholder="Foundation work continued on block B."
          value={form.progressNotes}
          onChange={(e) => set('progressNotes', e.target.value)}
        />

        <label htmlFor="delays">Delays or problems</label>
        <textarea
          id="delays"
          rows={2}
          placeholder="Leave blank if there were none."
          value={form.delaysNotes}
          onChange={(e) => set('delaysNotes', e.target.value)}
        />
      </div>

      {/* ------------------------------------------------------ manpower -- */}
      <Section title="Manpower" count={form.manpower.length}>
        {form.manpower.map((row, i) => (
          <div className="row" key={i}>
            <input
              type="text"
              placeholder="Trade (masons, welders…)"
              value={row.trade}
              onChange={(e) => updateRow('manpower', i, 'trade', e.target.value)}
            />
            <div className="row-split">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="How many"
                value={row.headcount}
                onChange={(e) => updateRow('manpower', i, 'headcount', e.target.value)}
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="24"
                placeholder="Hours"
                value={row.hoursWorked}
                onChange={(e) => updateRow('manpower', i, 'hoursWorked', e.target.value)}
              />
            </div>
            <button type="button" className="remove" onClick={() => removeRow('manpower', i)}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() => addRow('manpower', { trade: '', headcount: '', hoursWorked: '' })}
        >
          Add trade
        </button>
      </Section>

      {/* ----------------------------------------------------- equipment -- */}
      <Section title="Equipment" count={form.equipment.length}>
        {form.equipment.map((row, i) => (
          <div className="row" key={i}>
            <input
              type="text"
              placeholder="Equipment name"
              value={row.equipmentName}
              onChange={(e) => updateRow('equipment', i, 'equipmentName', e.target.value)}
            />
            <div className="row-split">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="24"
                placeholder="Hours run"
                value={row.hoursRun}
                onChange={(e) => updateRow('equipment', i, 'hoursRun', e.target.value)}
              />
              <select
                value={row.status}
                onChange={(e) => updateRow('equipment', i, 'status', e.target.value)}
              >
                <option value="operational">Working</option>
                <option value="idle">Idle</option>
                <option value="breakdown">Broken down</option>
              </select>
            </div>
            <button type="button" className="remove" onClick={() => removeRow('equipment', i)}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            addRow('equipment', { equipmentName: '', hoursRun: '', status: 'operational' })
          }
        >
          Add equipment
        </button>
      </Section>

      {/* ----------------------------------------------------- materials -- */}
      <Section title="Materials" count={form.materials.length}>
        {form.materials.map((row, i) => (
          <div className="row" key={i}>
            <input
              type="text"
              placeholder="Material name"
              value={row.materialName}
              onChange={(e) => updateRow('materials', i, 'materialName', e.target.value)}
            />
            <div className="row-split">
              <input
                type="text"
                placeholder="Unit (bags, tonnes)"
                value={row.unit}
                onChange={(e) => updateRow('materials', i, 'unit', e.target.value)}
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="Received"
                value={row.quantityReceived}
                onChange={(e) => updateRow('materials', i, 'quantityReceived', e.target.value)}
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="Used"
                value={row.quantityUsed}
                onChange={(e) => updateRow('materials', i, 'quantityUsed', e.target.value)}
              />
            </div>
            <button type="button" className="remove" onClick={() => removeRow('materials', i)}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            addRow('materials', {
              materialName: '', unit: '', quantityReceived: '', quantityUsed: '',
            })
          }
        >
          Add material
        </button>
      </Section>

      {/* ----------------------------------------------------- incidents -- */}
      <Section title="Incidents" count={form.incidents.length}>
        {form.incidents.map((row, i) => (
          <div className="row" key={i}>
            <div className="row-split">
              <select
                value={row.category}
                onChange={(e) => updateRow('incidents', i, 'category', e.target.value)}
              >
                <option value="safety">Safety</option>
                <option value="equipment">Equipment</option>
                <option value="delay">Delay</option>
                <option value="security">Security</option>
                <option value="other">Other</option>
              </select>
              <select
                value={row.severity}
                onChange={(e) => updateRow('incidents', i, 'severity', e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <textarea
              rows={2}
              placeholder="What happened"
              value={row.description}
              onChange={(e) => updateRow('incidents', i, 'description', e.target.value)}
            />
            <button type="button" className="remove" onClick={() => removeRow('incidents', i)}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            addRow('incidents', { category: 'safety', severity: 'low', description: '' })
          }
        >
          Add incident
        </button>
      </Section>

      {/* ------------------------------------------------------- photos -- */}
      <Section title="Photos" count={photos.length}>
        <PhotoPicker photos={photos} onChange={setPhotos} />
      </Section>

      <div className="submit-bar">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Saving…' : online ? 'Send report' : 'Save report'}
        </button>
        {!online && (
          <p className="muted small center">
            No signal right now. Your report is kept safe and sent automatically.
          </p>
        )}
      </div>
    </form>
  );
}

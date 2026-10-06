import { useEffect, useState } from 'react';
import { api } from '../api/client';
import BarChart, { TrendChart } from '../components/BarChart';

/**
 * The management view.
 *
 * Ordered by what needs attention soonest: today's state at the top, then
 * the sites that have not reported, then the longer trends. A manager who
 * opens this for ten seconds should still leave knowing what to chase.
 */
export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .dashboard()
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="muted center">Loading dashboard…</p>;
  if (error) return <p className="alert alert-error" role="alert">{error}</p>;

  const { summary, outstanding, trend, manpower, equipment, range } = data;

  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="muted small">
        {range.from} to {range.to}
      </p>

      <div className="export-bar">
        <a
          className="secondary export-link"
          href={`/api/export/pdf?from=${range.from}&to=${range.to}`}
        >
          Weekly report (PDF)
        </a>
        <a
          className="secondary export-link"
          href={`/api/export/xlsx?from=${range.from}&to=${range.to}`}
        >
          Data (Excel)
        </a>
      </div>

      {/* ------------------------------------------------- headline stats -- */}
      <div className="stats">
        <Stat label="Active projects" value={summary.activeProjects} />
        <Stat label="Active sites" value={summary.activeSites} />
        <Stat label="Reported today" value={`${summary.reportsToday}/${summary.activeSites}`} />
        <Stat
          label="Incidents, 7 days"
          value={summary.incidentsThisWeek}
          tone={summary.highIncidentsThisWeek > 0 ? 'alert' : undefined}
          note={summary.highIncidentsThisWeek > 0
            ? `${summary.highIncidentsThisWeek} high severity`
            : undefined}
        />
      </div>

      {/* --------------------------------------------- what needs chasing -- */}
      <section className="card">
        <h2 className="card-title">
          Not yet reported today
          {outstanding.length > 0 && <span className="badge badge-warn">{outstanding.length}</span>}
        </h2>

        {outstanding.length === 0 ? (
          <p className="muted small">Every active site has reported. Nothing to chase.</p>
        ) : (
          <ul className="outstanding">
            {outstanding.map((s) => (
              <li key={s.siteId}>
                <div className="outstanding-main">
                  <strong>{s.siteName}</strong>
                  <span className="muted small">{s.projectName}</span>
                </div>
                <span className="muted small">
                  {s.lastReportDate ? `Last: ${s.lastReportDate}` : 'Never reported'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------- trend -- */}
      <section className="card">
        <h2 className="card-title">Reports per day</h2>
        <TrendChart data={trend} />
      </section>

      {/* ------------------------------------------------------- manpower -- */}
      <section className="card">
        <h2 className="card-title">Manpower by trade</h2>
        <BarChart data={manpower} labelKey="trade" valueKey="headcount" />
      </section>

      {/* ------------------------------------------------------ equipment -- */}
      <section className="card">
        <h2 className="card-title">Equipment hours</h2>
        <BarChart data={equipment} labelKey="equipmentName" valueKey="hours" unit="h" />
        {equipment.some((e) => e.breakdowns > 0) && (
          <p className="muted small">
            Breakdowns reported:{' '}
            {equipment
              .filter((e) => e.breakdowns > 0)
              .map((e) => `${e.equipmentName} (${e.breakdowns})`)
              .join(', ')}
          </p>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, note, tone }) {
  return (
    <div className={`stat ${tone === 'alert' ? 'stat-alert' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

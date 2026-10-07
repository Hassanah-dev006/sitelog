import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .listReports({ limit: 50 })
      .then((data) => {
        if (!cancelled) setReports(data.reports);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="muted center">Loading reports…</p>;
  if (error) return <p className="alert alert-error" role="alert">{error}</p>;

  if (reports.length === 0) {
    return (
      <div className="card center">
        <h2>No reports yet</h2>
        <p className="muted">Submitted reports will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">Recent reports</h1>
      <ul className="report-list">
        {reports.map((r) => (
          <li key={r.id} className="report-row">
            <div className="report-row-main">
              <strong>{r.siteName}</strong>
              <span className="muted">{r.projectName}</span>
            </div>
            <div className="report-row-side">
              <span className="date">{r.reportDate}</span>
              <span className="muted small">{r.submittedBy.fullName}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

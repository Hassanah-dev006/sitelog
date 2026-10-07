import { useState } from 'react';

/**
 * A collapsible block of the report form.
 *
 * The form is long. Showing it all at once on a phone is discouraging, so
 * each part opens only when it is needed and shows a count when closed.
 */
export default function Section({ title, count = 0, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="section">
      <button
        type="button"
        className="section-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="section-meta">
          {count > 0 && <span className="badge">{count}</span>}
          <span className="chevron" aria-hidden="true">{open ? '−' : '+'}</span>
        </span>
      </button>

      <div className="section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

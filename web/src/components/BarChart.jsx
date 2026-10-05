/**
 * A horizontal bar chart drawn as plain SVG.
 *
 * A charting library would add roughly 150 KB to a bundle this project has
 * spent weeks keeping small for weak connections. These charts compare a
 * dozen labelled values, which is about forty lines of SVG, so the
 * dependency would not pay for itself.
 */
export default function BarChart({ data, valueKey, labelKey, unit = '', emptyText }) {
  if (!data || data.length === 0) {
    return <p className="muted small">{emptyText || 'No data for this period.'}</p>;
  }

  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="bars">
      {data.map((d) => {
        const value = Number(d[valueKey]) || 0;
        const pct = Math.round((value / max) * 100);

        return (
          <div className="bar-row" key={d[labelKey]}>
            <span className="bar-label" title={d[labelKey]}>{d[labelKey]}</span>
            <span className="bar-track">
              {/* The bar is decorative; the number beside it is the real content. */}
              <span className="bar-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
            </span>
            <span className="bar-value">
              {value}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Submissions per day, as a small column chart. */
export function TrendChart({ data, emptyText }) {
  if (!data || data.length === 0) {
    return <p className="muted small">{emptyText || 'No reports in this period.'}</p>;
  }

  const max = Math.max(...data.map((d) => d.reports), 1);
  const width = Math.max(data.length * 26, 120);
  const height = 90;
  const barWidth = 16;

  return (
    <svg
      className="trend"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label={`Reports submitted per day. Highest day: ${max}.`}
    >
      {data.map((d, i) => {
        const h = Math.max((d.reports / max) * (height - 18), 2);
        return (
          <g key={d.date}>
            <rect
              x={i * 26 + 4}
              y={height - 14 - h}
              width={barWidth}
              height={h}
              rx="2"
              fill="currentColor"
            />
            <text
              x={i * 26 + 4 + barWidth / 2}
              y={height - 3}
              textAnchor="middle"
              fontSize="8"
              fill="currentColor"
              opacity="0.65"
            >
              {String(d.date).slice(8, 10)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

'use strict';

const PDFDocument = require('pdfkit');

/**
 * The weekly site report as a PDF.
 *
 * The layout follows the paper report management already circulates. Matching
 * something people recognise lowers the barrier to the system being adopted
 * far more than a better-looking document would.
 *
 * Streams into the response rather than building the whole file in memory.
 */

const GREEN = '#0f3d2e';
const GREY = '#5c6b65';
const LINE = '#d9e2dd';

const MARGIN = 48;

function buildWeeklyPdf(stream, { from, to, rows, summary, projectName }) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  doc.pipe(stream);

  // ------------------------------------------------------------- header --
  doc.fillColor(GREEN).fontSize(18).font('Helvetica-Bold')
    .text('Weekly Site Report', { continued: false });

  doc.moveDown(0.2);
  doc.fillColor(GREY).fontSize(10).font('Helvetica')
    .text('Tihama Limited (Constructions) — Kano, Nigeria');

  doc.moveDown(0.6);
  doc.fillColor('#15201c').fontSize(11).font('Helvetica-Bold')
    .text(`${from} to ${to}`);

  if (projectName) {
    doc.fontSize(10).font('Helvetica').fillColor(GREY).text(projectName);
  }

  doc.fontSize(8).fillColor(GREY)
    .text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);

  doc.moveDown(0.8);
  rule(doc);
  doc.moveDown(0.8);

  // ------------------------------------------------------------ summary --
  doc.fillColor(GREEN).fontSize(12).font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.4);

  const stats = [
    ['Reports filed', summary.reports],
    ['Sites covered', summary.sites],
    ['Manpower hours', round(summary.manpowerHours)],
    ['Equipment hours', round(summary.equipmentHours)],
    ['Incidents', summary.incidents],
    ['Breakdowns', summary.breakdowns],
  ];

  const colWidth = (doc.page.width - MARGIN * 2) / 3;
  let x = MARGIN;
  let y = doc.y;

  stats.forEach(([label, value], i) => {
    if (i === 3) {
      x = MARGIN;
      y += 38;
    }
    doc.fillColor('#15201c').fontSize(16).font('Helvetica-Bold')
      .text(String(value), x, y, { width: colWidth });
    doc.fillColor(GREY).fontSize(8).font('Helvetica')
      .text(label, x, y + 19, { width: colWidth });
    x += colWidth;
  });

  doc.y = y + 44;
  doc.x = MARGIN;
  rule(doc);
  doc.moveDown(0.8);

  // ------------------------------------------------------------- detail --
  if (rows.length === 0) {
    doc.fillColor(GREY).fontSize(10).font('Helvetica')
      .text('No reports were filed in this period.');
  } else {
    let currentSite = null;

    for (const r of rows) {
      const siteKey = `${r.project_name} — ${r.site_name}`;

      if (siteKey !== currentSite) {
        currentSite = siteKey;
        if (doc.y > doc.page.height - 160) doc.addPage();

        doc.moveDown(0.4);
        doc.fillColor(GREEN).fontSize(11).font('Helvetica-Bold').text(siteKey);
        doc.moveDown(0.2);
      }

      if (doc.y > doc.page.height - 120) doc.addPage();

      doc.fillColor('#15201c').fontSize(9).font('Helvetica-Bold')
        .text(`${formatDate(r.report_date)}`, { continued: true })
        .font('Helvetica').fillColor(GREY)
        .text(`   ${r.submitted_by}${r.weather ? ` · ${r.weather}` : ''}`);

      if (r.progress_notes) {
        doc.fillColor('#15201c').fontSize(9).font('Helvetica')
          .text(r.progress_notes, { width: doc.page.width - MARGIN * 2 });
      }

      if (r.delays_notes) {
        doc.fillColor('#a3241c').fontSize(9).font('Helvetica-Oblique')
          .text(`Delays: ${r.delays_notes}`, { width: doc.page.width - MARGIN * 2 });
      }

      doc.fillColor(GREY).fontSize(8).font('Helvetica')
        .text(
          `Manpower ${r.headcount} (${round(r.manpower_hours)}h) · ` +
          `Equipment ${round(r.equipment_hours)}h · ` +
          `Incidents ${r.incident_count}` +
          (Number(r.breakdowns) > 0 ? ` · Breakdowns ${r.breakdowns}` : '')
        );

      doc.moveDown(0.5);
    }
  }

  // Page numbers, added once the page count is known.
  //
  // The footer sits below the bottom margin. pdfkit treats writing there as
  // an overflow and helpfully starts a new page — which then also needs a
  // footer, and so on. Dropping the bottom margin while the footer is drawn
  // stops that, and the margin is restored immediately afterwards.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);

    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.fillColor(GREY).fontSize(8).font('Helvetica')
      .text(
        `Page ${i + 1} of ${range.count}`,
        MARGIN,
        doc.page.height - 32,
        { width: doc.page.width - MARGIN * 2, align: 'center', lineBreak: false }
      );

    doc.page.margins.bottom = bottom;
  }

  doc.end();
  return doc;
}

function rule(doc) {
  doc.strokeColor(LINE).lineWidth(1)
    .moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).stroke();
}

function round(n) {
  return Math.round(Number(n || 0) * 10) / 10;
}

function formatDate(value) {
  if (!value) return '';
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return s;
}

module.exports = { buildWeeklyPdf };

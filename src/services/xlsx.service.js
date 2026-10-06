'use strict';

const ExcelJS = require('exceljs');

/**
 * The same week's data as a spreadsheet.
 *
 * The PDF answers the questions management already asks. This exists for the
 * ones they have not asked yet — rather than waiting on a new report being
 * built, they can pivot the raw figures themselves.
 */

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D2E' } };

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle' };
  });
  sheet.getRow(1).height = 20;

  rows.forEach((r) => sheet.addRow(r));

  // Freeze the header so it stays visible when scrolling a long week.
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  return sheet;
}

const DATE = { key: 'report_date', header: 'Date', width: 12 };
const PROJECT = { key: 'project_name', header: 'Project', width: 28 };
const SITE = { key: 'site_name', header: 'Site', width: 22 };

async function buildWorkbook({ from, to, reports, manpower, equipment, materials, incidents }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SiteLog';
  workbook.created = new Date();

  addSheet(workbook, 'Reports', [
    DATE, PROJECT, SITE,
    { key: 'submitted_by', header: 'Submitted by', width: 22 },
    { key: 'weather', header: 'Weather', width: 16 },
    { key: 'headcount', header: 'Headcount', width: 12 },
    { key: 'manpower_hours', header: 'Manpower hrs', width: 14 },
    { key: 'equipment_hours', header: 'Equipment hrs', width: 14 },
    { key: 'incident_count', header: 'Incidents', width: 11 },
    { key: 'progress_notes', header: 'Progress', width: 60 },
    { key: 'delays_notes', header: 'Delays', width: 40 },
  ], reports);

  addSheet(workbook, 'Manpower', [
    DATE, PROJECT, SITE,
    { key: 'trade', header: 'Trade', width: 20 },
    { key: 'headcount', header: 'Headcount', width: 12 },
    { key: 'hours_worked', header: 'Hours', width: 10 },
  ], manpower);

  addSheet(workbook, 'Equipment', [
    DATE, PROJECT, SITE,
    { key: 'equipment_name', header: 'Equipment', width: 24 },
    { key: 'hours_run', header: 'Hours run', width: 12 },
    { key: 'status', header: 'Status', width: 14 },
  ], equipment);

  addSheet(workbook, 'Materials', [
    DATE, PROJECT, SITE,
    { key: 'material_name', header: 'Material', width: 24 },
    { key: 'unit', header: 'Unit', width: 10 },
    { key: 'quantity_received', header: 'Received', width: 12 },
    { key: 'quantity_used', header: 'Used', width: 12 },
  ], materials);

  addSheet(workbook, 'Incidents', [
    DATE, PROJECT, SITE,
    { key: 'category', header: 'Category', width: 14 },
    { key: 'severity', header: 'Severity', width: 12 },
    { key: 'description', header: 'Description', width: 70 },
  ], incidents);

  // A cover sheet so a file forwarded by email still says what it covers.
  const about = workbook.addWorksheet('About');
  about.columns = [{ width: 22 }, { width: 46 }];
  about.addRows([
    ['SiteLog export', ''],
    ['Company', 'Tihama Limited (Constructions), Kano'],
    ['Period', `${from} to ${to}`],
    ['Generated', new Date().toISOString().slice(0, 16).replace('T', ' ')],
    ['Reports', reports.length],
  ]);
  about.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F3D2E' } };
  about.getColumn(1).font = { bold: true };

  return workbook;
}

module.exports = { buildWorkbook };

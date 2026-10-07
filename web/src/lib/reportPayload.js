/**
 * Turns the form's state into the body the API expects.
 *
 * Kept as a pure function so it can be tested without rendering anything,
 * and so the form component stays about the interface rather than the data
 * shape.
 */

/** A row the supervisor started but left blank should not be submitted. */
const hasText = (v) => typeof v === 'string' && v.trim() !== '';

const num = (v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function buildReportPayload(form) {
  const payload = {
    siteId: Number(form.siteId),
    reportDate: form.reportDate,
  };

  if (hasText(form.weather)) payload.weather = form.weather.trim();
  if (hasText(form.progressNotes)) payload.progressNotes = form.progressNotes.trim();
  if (hasText(form.delaysNotes)) payload.delaysNotes = form.delaysNotes.trim();

  const manpower = (form.manpower || [])
    .filter((r) => hasText(r.trade))
    .map((r) => ({
      trade: r.trade.trim(),
      headcount: num(r.headcount) ?? 0,
      ...(num(r.hoursWorked) !== undefined ? { hoursWorked: num(r.hoursWorked) } : {}),
    }));

  const equipment = (form.equipment || [])
    .filter((r) => hasText(r.equipmentName))
    .map((r) => ({
      equipmentName: r.equipmentName.trim(),
      ...(num(r.hoursRun) !== undefined ? { hoursRun: num(r.hoursRun) } : {}),
      ...(r.status ? { status: r.status } : {}),
    }));

  const materials = (form.materials || [])
    .filter((r) => hasText(r.materialName))
    .map((r) => ({
      materialName: r.materialName.trim(),
      ...(hasText(r.unit) ? { unit: r.unit.trim() } : {}),
      ...(num(r.quantityReceived) !== undefined
        ? { quantityReceived: num(r.quantityReceived) }
        : {}),
      ...(num(r.quantityUsed) !== undefined ? { quantityUsed: num(r.quantityUsed) } : {}),
    }));

  const incidents = (form.incidents || [])
    .filter((r) => hasText(r.description))
    .map((r) => ({
      category: r.category || 'other',
      severity: r.severity || 'low',
      description: r.description.trim(),
    }));

  if (manpower.length) payload.manpower = manpower;
  if (equipment.length) payload.equipment = equipment;
  if (materials.length) payload.materials = materials;
  if (incidents.length) payload.incidents = incidents;

  return payload;
}

/**
 * Checks the form before it is sent, so an obvious mistake is caught on the
 * phone rather than after a round trip over a weak connection.
 * Returns an array of messages; empty means valid.
 */
export function validateReport(form, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];

  if (!form.siteId) errors.push('Choose a site.');
  if (!form.reportDate) errors.push('Choose the date this report covers.');
  else if (form.reportDate > today) errors.push('A report cannot be dated in the future.');

  for (const r of form.manpower || []) {
    if (hasText(r.trade) && num(r.headcount) === undefined) {
      errors.push(`Enter a headcount for ${r.trade.trim()}.`);
    }
  }

  for (const r of form.incidents || []) {
    if (hasText(r.description) && !r.category) {
      errors.push('Choose a category for each incident.');
    }
  }

  return errors;
}

export const EMPTY_FORM = {
  siteId: '',
  reportDate: new Date().toISOString().slice(0, 10),
  weather: '',
  progressNotes: '',
  delaysNotes: '',
  manpower: [],
  equipment: [],
  materials: [],
  incidents: [],
};

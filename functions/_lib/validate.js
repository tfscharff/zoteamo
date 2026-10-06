// Shared labels, limits and list-settings validation.
export const STYLES = ['apa', 'mla', 'chicago'];
export const STYLE_LABELS = { apa: 'APA (7th edition)', mla: 'MLA (9th edition)', chicago: 'Chicago (notes and bibliography)' };
export const STATUSES = ['suggested', 'up_next', 'discussed'];
export const STATUS_LABELS = { suggested: 'Suggested', up_next: 'Up next', discussed: 'Discussed' };
export const LIMITS = { title: 300, description: 2000, input: 2000, addedBy: 100, note: 1000, field: 1000 };

export function validateListSettings(form) {
  const values = {
    title: form.get('title'),
    description: form.get('description'),
    defaultStyle: form.get('default_style'),
  };
  const errors = [];
  if (!values.title) errors.push({ field: 'title', message: 'Enter a name for the list.' });
  else if (values.title.length > LIMITS.title) {
    errors.push({ field: 'title', message: `Keep the list name to ${LIMITS.title} characters or fewer.` });
  }
  if (values.description.length > LIMITS.description) {
    errors.push({ field: 'description', message: `Keep the description to ${LIMITS.description} characters or fewer.` });
  }
  if (!STYLES.includes(values.defaultStyle)) {
    errors.push({ field: 'default_style', message: 'Choose a default citation style.' });
  }
  return { values, errors };
}

export function validateAddItem(form) {
  const values = { input: form.get('input'), addedBy: form.get('added_by'), note: form.get('note') };
  const errors = [];
  if (values.input.length > LIMITS.input) errors.push({ field: 'input', message: `Keep it to ${LIMITS.input} characters or fewer.` });
  if (values.addedBy.length > LIMITS.addedBy) errors.push({ field: 'added_by', message: `Keep your name to ${LIMITS.addedBy} characters or fewer.` });
  if (values.note.length > LIMITS.note) errors.push({ field: 'note', message: `Keep the note to ${LIMITS.note} characters or fewer.` });
  return { values, errors };
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function validateStatus(form) {
  const values = { status: form.get('status'), meetingDate: form.get('meeting_date'), note: form.get('note') };
  const errors = [];
  if (!STATUSES.includes(values.status)) errors.push({ field: 'status', message: 'Choose a status.' });
  if (values.meetingDate && !isIsoDate(values.meetingDate)) {
    errors.push({ field: 'meeting_date', message: 'Enter a real date for the meeting, for example 2026-10-20.' });
  }
  if (values.note.length > LIMITS.note) errors.push({ field: 'note', message: `Keep the note to ${LIMITS.note} characters or fewer.` });
  return { values, errors };
}

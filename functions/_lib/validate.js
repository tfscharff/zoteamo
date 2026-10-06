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

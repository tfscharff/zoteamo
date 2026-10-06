// The hand-edit form for an item's citation details (spec §4, "Edit citation by hand").
import { ITEM_TYPES, previousRoles, roleLabel, rolesFor, typeOf } from '../fields.js';
import { html } from '../html.js';
import { LIMITS } from '../validate.js';
import { errorFor, errorSummary, selectField, textField } from './forms.js';

const SPARE_ROWS = 3;

function creatorRow(creator, n, errors, allowed) {
  const keys = allowed.includes(creator.creatorType) ? allowed : [...allowed, creator.creatorType];
  const roles = keys.map((key) => [key, roleLabel(key)]);
  return html`<fieldset class="creator">
<legend>Person ${n}</legend>
${textField({ id: `creator-first-${n}`, name: 'creator_first', label: 'First name', optional: true, value: creator.firstName, maxlength: 200, autocomplete: 'off' })}
${textField({ id: `creator-last-${n}`, name: 'creator_last', label: 'Last name or organization', value: creator.lastName, error: errorFor(errors, `creator-last-${n}`), maxlength: 200, autocomplete: 'off' })}
${selectField({ id: `creator-role-${n}`, name: 'creator_role', label: 'Role', options: roles, selected: creator.creatorType })}
</fieldset>`;
}

export function editItemPage({ base, item, values, errors = [], lookupFailed = false, previous = {} }) {
  const allowed = rolesFor(values.itemType, previousRoles(previous));
  const types = Object.entries(ITEM_TYPES).map(([key, type]) => [key, type.label]);
  if (!typeOf(values.itemType)) types.push([values.itemType, `Other (${values.itemType})`]);
  const rows = [...values.creators, ...Array.from({ length: SPARE_ROWS }, () => ({ firstName: '', lastName: '', creatorType: 'author' }))];
  const field = (id, label, extra = {}) =>
    textField({ id, label, value: values[id], error: errorFor(errors, id), optional: id !== 'title', maxlength: LIMITS.field, autocomplete: 'off', ...extra });
  return html`<h1>Edit citation</h1>
<p><a href="${base}#item-${item.id}">Back to the list</a></p>
${lookupFailed && item.citation_error ? html`<div class="notice" role="status"><p>We couldn’t get the details automatically: ${item.citation_error} Fill them in below and save.</p></div>` : ''}
${errorSummary(errors)}
<form method="post" action="${base}/items/${item.id}/edit" class="stack">
${selectField({ id: 'itemType', label: 'Item type', options: types, selected: values.itemType, hint: 'Only the fields that apply to this type are saved.', error: errorFor(errors, 'itemType') })}
${field('title', 'Title', { required: true })}
<fieldset class="field">
<legend>Authors and other contributors</legend>
<p class="hint">Leave a row empty to remove it. For an organization, put its name under “Last name or organization”.</p>
${rows.map((creator, i) => creatorRow(creator, i + 1, errors, allowed))}
</fieldset>
${field('container', 'Published in', { hint: 'The journal, website, newspaper or book this appeared in.' })}
${field('date', 'Date published', { hint: 'For example 2024, 2024-03 or 2024-03-15.' })}
${field('publisher', 'Publisher')}
${field('place', 'Place published')}
${field('volume', 'Volume')}
${field('issue', 'Issue')}
${field('pages', 'Pages', { hint: 'For example 45–67.' })}
${field('url', 'Web address', { type: 'url', autocomplete: 'url' })}
${field('DOI', 'DOI')}
${field('ISBN', 'ISBN')}
${field('accessDate', 'Date accessed', { hint: 'For web pages, for example 2026-10-06.' })}
<button type="submit">Save citation</button>
</form>`;
}

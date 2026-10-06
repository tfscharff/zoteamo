// The "Add to the list" form on the edit page, plus the way into entering details by hand.
import { html } from '../html.js';
import { LIMITS } from '../validate.js';
import { errorFor, errorSummary, textArea, textField } from './forms.js';

export function addItemForm({ base, values = {}, errors = [] }) {
  return html`<section aria-labelledby="add-title">
<h2 id="add-title">Add to the list</h2>
${errorSummary(errors, 'add-')}
<form method="post" action="${base}/items" class="stack" data-busy-label="Looking it up… this takes a few seconds">
${textField({ id: 'add-input', name: 'input', label: 'Link, DOI, ISBN, PMID or arXiv ID', value: values.input, error: errorFor(errors, 'input'), hint: 'Looking it up takes a few seconds, or up to 15 seconds if nobody has added anything for a while.', required: true, maxlength: LIMITS.input, autocomplete: 'off' })}
${textField({ id: 'add-added_by', name: 'added_by', label: 'Your name', optional: true, value: values.addedBy, error: errorFor(errors, 'added_by'), maxlength: LIMITS.addedBy, autocomplete: 'name' })}
${textArea({ id: 'add-note', name: 'note', label: 'Note', optional: true, value: values.note, error: errorFor(errors, 'note'), maxlength: LIMITS.note, rows: 2 })}
<button type="submit">Add to list</button>
</form>
<form method="post" action="${base}/items">
<input type="hidden" name="manual" value="1">
<input type="hidden" name="added_by" value="${values.addedBy ?? ''}">
<p>No link or identifier? <button type="submit" class="secondary">Enter the details by hand</button></p>
</form>
</section>`;
}

// The create-list form, re-shown with errors when the static home page form fails validation.
import { html } from '../html.js';
import { errorFor, errorSummary, styleRadios, textArea, textField } from './forms.js';

export function createListForm({ values = {}, errors = [] } = {}) {
  return html`<h1>Create a reading list</h1>
${errorSummary(errors)}
<form method="post" action="/api/lists" class="stack">
${textField({ id: 'title', label: 'List name', value: values.title, error: errorFor(errors, 'title'), required: true, maxlength: 300, autocomplete: 'off' })}
${textArea({ id: 'description', label: 'Description', optional: true, value: values.description, error: errorFor(errors, 'description'), maxlength: 2000 })}
${styleRadios({ selected: values.defaultStyle || 'apa', error: errorFor(errors, 'default_style'), hint: 'Anyone viewing the list can switch styles for themselves.' })}
<button type="submit">Create reading list</button>
</form>`;
}

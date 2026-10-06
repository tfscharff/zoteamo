// The edit page's "Links and settings" panel. It opens by itself after creating a list, replacing its edit link,
// or a settings error.
import { html } from '../html.js';
import { LIMITS } from '../validate.js';
import { attr, errorFor, errorSummary, styleRadios, textArea, textField } from './forms.js';

export function linksPanel({ list, token, origin, params, forms = {} }) {
  const created = params.get('created') === '1';
  const rotated = params.get('rotated') === '1';
  const settings = forms.settings ?? {
    values: { title: list.title, description: list.description, defaultStyle: list.default_style },
    errors: [],
  };
  const { values, errors } = settings;
  return html`<details class="links-panel"${attr('open', created || rotated || errors.length > 0)}>
<summary>Links and settings</summary>
${created ? html`<p class="notice" role="status">Your reading list is ready. Save the edit link somewhere safe, because it’s the only way back in.</p>` : ''}
${rotated ? html`<p class="notice" role="status">Here’s the new edit link. The old one no longer works, so share this one with your group.</p>` : ''}
<h2>Links to this list</h2>
<p><strong>Anyone with the edit link can change this list. Keep it within the group.</strong></p>
<div class="field"><label for="edit-link">Edit link (for members)</label><input id="edit-link" value="${origin}/e/${token}" type="text" readonly data-copy></div>
<div class="field"><label for="view-link">View link (read-only, for sharing)</label><input id="view-link" value="${origin}/l/${list.view_token}" type="text" readonly data-copy></div>
<h2>List settings</h2>
${errorSummary(errors, 'list-')}
<form method="post" action="/e/${token}/settings" class="stack">
${textField({ id: 'list-title', name: 'title', label: 'List name', value: values.title, error: errorFor(errors, 'title'), required: true, maxlength: LIMITS.title })}
${textArea({ id: 'list-description', name: 'description', label: 'Description', optional: true, value: values.description, error: errorFor(errors, 'description'), maxlength: LIMITS.description })}
${styleRadios({ prefix: 'list-', selected: values.defaultStyle, error: errorFor(errors, 'default_style') })}
<button type="submit">Save settings</button>
</form>
<h2>Replace the edit link</h2>
<p>If the edit link has spread beyond your group, replace it. The old link stops working straight away, so you’ll need to share the new one with members.</p>
<form method="post" action="/e/${token}/rotate-edit-link"><button type="submit" class="secondary">Replace the edit link</button></form>
</details>`;
}

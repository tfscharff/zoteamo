// Shown when a page lists several items (translation-server 300). The choice relies on translation-server's
// in-memory session, which may be gone by the time the member answers; add-flow handles that.
import { html } from '../html.js';
import { attr } from './forms.js';

const MAX_CHOICES = 50;
const labelOf = (value) => (typeof value === 'string' ? value : value?.title) || 'Untitled item';

export function selectPage({ base, itemId, url, session, choices }) {
  const entries = Object.entries(choices).slice(0, MAX_CHOICES);
  return html`<h1>Which item did you mean?</h1>
<p>That page lists several items. Choose the one to add.</p>
<form method="post" action="${base}/items/${itemId}/select" class="stack">
<input type="hidden" name="url" value="${url}">
<input type="hidden" name="session" value="${session}">
<input type="hidden" name="choices" value="${JSON.stringify(Object.fromEntries(entries))}">
<fieldset class="field">
<legend>Items found on the page</legend>
${entries.map(([key, value], i) => html`<div class="choice"><input type="radio" id="choice-${i}" name="choice" value="${key}"${attr('checked', i === 0)}><label for="choice-${i}">${labelOf(value)}</label></div>`)}
</fieldset>
<button type="submit">Add this item</button>
</form>
<form method="post" action="${base}/items/${itemId}/delete">
<button type="submit" class="secondary">Cancel and don’t add anything</button>
</form>`;
}

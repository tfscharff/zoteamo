// The no-JavaScript confirmation step before deleting an item.
import { html } from '../html.js';
import { hiddenText } from './item-actions.js';

export function confirmDeletePage({ base, item, title }) {
  return html`<h1>Delete “${title}”?</h1>
<p>This removes the item, its note and its votes from the list. It can’t be undone.</p>
<form method="post" action="${base}/items/${item.id}/delete">
<button type="submit" class="danger">Delete${hiddenText(title)}</button>
</form>
<p><a href="${base}#item-${item.id}">Keep it and go back to the list</a></p>`;
}

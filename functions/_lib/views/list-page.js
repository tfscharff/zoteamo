// The main list page, for both the view link and the edit link.
import { html } from '../html.js';
import { linksPanel } from './links-panel.js';
import { errorMessage, statusMessage } from './messages.js';

export function listPage({ list, items, canEdit, token, origin, params, style, forms = {} }) {
  const status = statusMessage(params, items);
  const error = errorMessage(params);
  return html`<h1>${list.title}</h1>
${list.description ? html`<p class="lede">${list.description}</p>` : ''}
${canEdit ? '' : html`<p>You’re viewing a read-only copy of this list.</p>`}
<p class="status-message" role="status">${status ?? ''}</p>
${error ? html`<div class="notice notice-error" role="alert"><p>${error}</p></div>` : ''}
${canEdit ? linksPanel({ list, token, origin, params, forms }) : ''}
<p>No items yet.</p>`;
}

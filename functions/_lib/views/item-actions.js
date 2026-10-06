// Edit-link controls for one item. Each control's accessible name includes the item's title (spec §7).
import { html } from '../html.js';
import { LIMITS, STATUSES, STATUS_LABELS } from '../validate.js';
import { errorFor, errorSummary, selectField, textArea, textField } from './forms.js';

export const hiddenText = (text) => html`<span class="visually-hidden"> ${text}</span>`;

export function statusForm({ base, item, title, values, errors = [] }) {
  const prefix = `item-${item.id}-`;
  const v = values ?? { status: item.status, meetingDate: item.meeting_date ?? '', note: item.note };
  return html`${errorSummary(errors, prefix)}
<form method="post" action="${base}/items/${item.id}/status" class="stack">
${selectField({ id: `${prefix}status`, name: 'status', label: 'Status', options: STATUSES.map((s) => [s, STATUS_LABELS[s]]), selected: v.status, error: errorFor(errors, 'status') })}
${textField({ id: `${prefix}meeting_date`, name: 'meeting_date', type: 'date', label: 'Meeting date', optional: true, value: v.meetingDate, error: errorFor(errors, 'meeting_date') })}
${textArea({ id: `${prefix}note`, name: 'note', label: 'Note', optional: true, value: v.note, error: errorFor(errors, 'note'), maxlength: LIMITS.note, rows: 2 })}
<button type="submit">Save${hiddenText(`status of ${title}`)}</button>
</form>`;
}

export function itemActions(item, { token, title }) {
  const base = `/e/${token}`;
  const path = `${base}/items/${item.id}`;
  return html`<div class="item-actions">
<form method="post" action="${path}/vote"><button type="submit" class="secondary">${item.voted ? 'Remove vote' : 'Vote'}${hiddenText(`for ${title}`)}</button></form>
<a href="${path}/delete">Delete${hiddenText(title)}</a>
<details><summary>Change status${hiddenText(`of ${title}`)}</summary>
${statusForm({ base, item, title })}
</details>
</div>`;
}

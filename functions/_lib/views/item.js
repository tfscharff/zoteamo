// One item as a heading-led article. Citation HTML was sanitized when it was saved, so it's trusted here.
import { html, raw } from '../html.js';
import { STATUS_LABELS } from '../validate.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : (iso ?? '');
}

export const itemTitle = (item) => item.title || item.input || 'Untitled item';

function citation(item, style) {
  const cite = item[`cite_${style}`];
  if (item.citation_state === 'ready' && cite) {
    return html`<p class="citation" data-copy-text="${item[`text_${style}`] ?? ''}">${raw(cite)}</p>${raw(item.coins ?? '')}`;
  }
  const lead = item.citation_state === 'failed' ? 'Couldn’t get citation details' : 'The citation isn’t ready yet';
  return html`<p class="citation citation-missing">${lead}${item.citation_error ? `: ${item.citation_error}` : '.'}</p>`;
}

export function itemArticle(item, { style }) {
  const id = `item-${item.id}`;
  const title = itemTitle(item);
  return html`<article class="item" id="${id}" aria-labelledby="${id}-title">
<h3 id="${id}-title" class="item-title">${title}</h3>
${citation(item, style)}
<dl class="item-meta">
<div><dt>Status</dt><dd>${STATUS_LABELS[item.status]}${item.meeting_date ? `, meeting ${formatDate(item.meeting_date)}` : ''}</dd></div>
${item.added_by ? html`<div><dt>Added by</dt><dd>${item.added_by}</dd></div>` : ''}
<div><dt>Votes</dt><dd>${item.votes}</dd></div>
</dl>
${item.note ? html`<p class="item-note"><strong>Note:</strong> ${item.note}</p>` : ''}
</article>`;
}

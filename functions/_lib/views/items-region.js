// The style switcher and the three item sections. Wrapped in #items so enhance.js can swap it without a reload.
import { html } from '../html.js';
import { orderItems } from '../ordering.js';
import { STYLES, STYLE_LABELS } from '../validate.js';
import { attr } from './forms.js';
import { itemArticle } from './item.js';

const SECTIONS = [
  ['upNext', 'Up next', 'Nothing is scheduled yet.'],
  ['suggested', 'Suggested', 'No suggestions yet.'],
  ['discussed', 'Discussed', 'Nothing has been discussed yet.'],
];

function styleSwitch(style, action) {
  return html`<form method="get" action="${action}" class="style-switch">
<div class="field"><label for="style">Citation style</label>
<select id="style" name="style">${STYLES.map((s) => html`<option value="${s}"${attr('selected', s === style)}>${STYLE_LABELS[s]}</option>`)}</select></div>
<button type="submit" class="secondary">Show citations</button>
</form>`;
}

function exportLinks(list, style) {
  const base = `/l/${list.view_token}`;
  return html`<section aria-labelledby="export-title">
<h2 id="export-title">Export</h2>
<ul class="export-links">
<li><a href="${base}/export.bib">BibTeX file (.bib)</a></li>
<li><a href="${base}/export.ris">RIS file (.ris), for most reference managers</a></li>
<li><a href="${base}/export.txt?style=${style}" data-copy-all>Plain-text bibliography in ${STYLE_LABELS[style]} (.txt)</a></li>
</ul>
<p class="hint">To save items straight into Zotero, use the Zotero Connector in your browser on this page. It finds every item.</p>
</section>`;
}

export function itemsRegion({ items, style, canEdit, token, list }) {
  const groups = orderItems(items);
  return html`<div id="items">
${styleSwitch(style, canEdit ? `/e/${token}` : `/l/${list.view_token}`)}
${SECTIONS.map(([key, heading, empty]) => html`<section aria-labelledby="section-${key}">
<h2 id="section-${key}">${heading} <span class="count">(${groups[key].length})</span></h2>
${groups[key].length ? groups[key].map((item) => itemArticle(item, { style, canEdit, token })) : html`<p>${empty}</p>`}
</section>`)}
${exportLinks(list, style)}
</div>`;
}

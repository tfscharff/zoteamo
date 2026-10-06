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

function styleSwitch(style) {
  return html`<form method="get" class="style-switch">
<div class="field"><label for="style">Citation style</label>
<select id="style" name="style">${STYLES.map((s) => html`<option value="${s}"${attr('selected', s === style)}>${STYLE_LABELS[s]}</option>`)}</select></div>
<button type="submit" class="secondary">Show citations</button>
</form>`;
}

export function itemsRegion({ items, style, canEdit, token }) {
  const groups = orderItems(items);
  return html`<div id="items">
${styleSwitch(style)}
${SECTIONS.map(([key, heading, empty]) => html`<section aria-labelledby="section-${key}">
<h2 id="section-${key}">${heading} <span class="count">(${groups[key].length})</span></h2>
${groups[key].length ? groups[key].map((item) => itemArticle(item, { style, canEdit, token })) : html`<p>${empty}</p>`}
</section>`)}
</div>`;
}

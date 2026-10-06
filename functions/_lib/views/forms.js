// Form building blocks: an error summary at the top, inline errors and hints tied with aria-describedby.
import { escapeHtml, html, raw } from '../html.js';
import { STYLES, STYLE_LABELS } from '../validate.js';

export function attr(name, value) {
  if (value === null || value === undefined || value === false || value === '') return '';
  if (value === true) return raw(` ${name}`);
  return raw(` ${name}="${escapeHtml(value)}"`);
}

export const errorFor = (errors, field) => errors?.find((e) => e.field === field)?.message;

export function errorSummary(errors, prefix = '') {
  if (!errors?.length) return '';
  return html`<div class="error-summary" role="alert" aria-labelledby="${prefix}error-summary-title" tabindex="-1">
<h2 id="${prefix}error-summary-title">There’s a problem</h2>
<ul>${errors.map((e) => html`<li><a href="#${prefix}${e.field}">${e.message}</a></li>`)}</ul>
</div>`;
}

const describedBy = (id, hint, error) => [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');

function notes(id, hint, error) {
  return html`${hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}
${error ? html`<p class="error-message" id="${id}-error"><span class="visually-hidden">Error:</span> ${error}</p>` : ''}`;
}

function label(id, text, optional) {
  return html`<label for="${id}">${text}${optional ? html` <span class="optional">(optional)</span>` : ''}</label>`;
}

// Always emits an explicit type (html-validate no-implicit-input-type), after value.
export function textField({ id, name = id, label: text, value = '', hint, error, type = 'text', required, maxlength, autocomplete, optional }) {
  return html`<div class="field">
${label(id, text, optional)}
${notes(id, hint, error)}
<input id="${id}" name="${name}" value="${value ?? ''}" type="${type}"${attr('required', required)}${attr('maxlength', maxlength)}${attr('autocomplete', autocomplete)}${attr('aria-describedby', describedBy(id, hint, error))}${attr('aria-invalid', error ? 'true' : null)}>
</div>`;
}

export function textArea({ id, name = id, label: text, value = '', hint, error, rows = 3, maxlength, optional }) {
  return html`<div class="field">
${label(id, text, optional)}
${notes(id, hint, error)}
<textarea id="${id}" name="${name}" rows="${rows}"${attr('maxlength', maxlength)}${attr('aria-describedby', describedBy(id, hint, error))}${attr('aria-invalid', error ? 'true' : null)}>${value ?? ''}</textarea>
</div>`;
}

export function selectField({ id, name = id, label: text, options, selected, hint, error }) {
  return html`<div class="field">
${label(id, text, false)}
${notes(id, hint, error)}
<select id="${id}" name="${name}"${attr('aria-describedby', describedBy(id, hint, error))}${attr('aria-invalid', error ? 'true' : null)}>
${options.map(([value, optionLabel]) => html`<option value="${value}"${attr('selected', value === selected)}>${optionLabel}</option>`)}
</select>
</div>`;
}

export function styleRadios({ prefix = '', name = 'default_style', selected = 'apa', legend = 'Default citation style', hint, error }) {
  const base = `${prefix}${name}`;
  const described = describedBy(base, hint, error);
  return html`<fieldset class="field">
<legend>${legend}</legend>
${notes(base, hint, error)}
${STYLES.map((style, i) => {
    const id = i === 0 ? base : `${base}-${style}`;
    return html`<div class="choice"><input type="radio" id="${id}" name="${name}" value="${style}"${attr('checked', style === selected)}${attr('aria-describedby', described)}><label for="${id}">${STYLE_LABELS[style]}</label></div>`;
  })}
</fieldset>`;
}

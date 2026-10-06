import { describe, expect, it } from 'vitest';
import { escapeHtml, html, raw } from '../../functions/_lib/html.js';

describe('html', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">'Tom' & Jerry</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;Tom&#39; &amp; Jerry&lt;/a&gt;',
    );
  });

  it('escapes interpolated values but not the template', () => {
    expect(String(html`<p title="${'"x"'}">${'<script>'}</p>`)).toBe('<p title="&quot;x&quot;">&lt;script&gt;</p>');
  });

  it('does not double-escape nested templates and joins arrays', () => {
    const items = ['a&b', 'c'].map((v) => html`<li>${v}</li>`);
    expect(String(html`<ul>${items}</ul>`)).toBe('<ul><li>a&amp;b</li><li>c</li></ul>');
  });

  it('renders null, undefined and false as nothing but keeps 0', () => {
    expect(String(html`${null}${undefined}${false}${0}`)).toBe('0');
  });

  it('passes raw() through untouched', () => {
    expect(String(html`<p>${raw('<i>ok</i>')}</p>`)).toBe('<p><i>ok</i></p>');
  });
});

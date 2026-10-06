import { describe, expect, it } from 'vitest';
import { sanitizeCitation, sanitizeCoins } from '../../functions/_lib/sanitize.js';

describe('sanitizeCitation', () => {
  it.each([
    ['keeps allowed tags', '<i>Title</i> and <b>b</b><sup>2</sup><sub>x</sub><em>e</em><strong>s</strong>',
      '<i>Title</i> and <b>b</b><sup>2</sup><sub>x</sub><em>e</em><strong>s</strong>'],
    ['unwraps citeproc divs', '<div class="csl-entry">Doe, J. (2020). <i>A</i>.</div>\n', 'Doe, J. (2020). <i>A</i>.'],
    ['keeps span only with a class', '<span class="nocase">X</span><span style="font-variant:small-caps;">Y</span>',
      '<span class="nocase">X</span>Y'],
    ['drops other attributes', '<i onclick="x()">a</i><span class="x" onmouseover="y">t</span>',
      '<i>a</i><span class="x">t</span>'],
    ['removes scripts with their content', 'a<script>alert(1)</script>b<style>p{}</style>c', 'abc'],
    ['unwraps links', '<a href="javascript:x">link</a>', 'link'],
    ['escapes stray characters', 'a < b & c > d "q"', 'a &lt; b &amp; c &gt; d &quot;q&quot;'],
    ['keeps valid entities', 'Smith &amp; Jones &#8211; &#x2014; 2020', 'Smith &amp; Jones &#8211; &#x2014; 2020'],
    ['closes unclosed tags', '<i>open', '<i>open</i>'],
    ['ignores stray closing tags', '</b>x', 'x'],
    ['repairs misnesting', '<i><b>x</i>y</b>', '<i><b>x</b></i>y'],
    ['removes comments', '<!-- x -->a', 'a'],
    ['lower-cases tag names', '<I>x</I>', '<i>x</i>'],
    ['ignores self-closing allowed tags', '<i/>x', 'x'],
    ['cleans class values', '<span class="a&quot; b">t</span>', '<span class="aquot b">t</span>'],
    ['handles empty input', undefined, ''],
  ])('%s', (_name, input, expected) => {
    expect(sanitizeCitation(input)).toBe(expected);
  });
});

describe('sanitizeCoins', () => {
  it('rebuilds a COinS span and keeps its query string', () => {
    const input = '<span class="Z3988" title="ctx_ver=Z39.88-2004&amp;rft.btitle=A%20Book&amp;rft.au=&quot;Q&quot;"></span>';
    expect(sanitizeCoins(input)).toBe(
      '<span class="Z3988" title="ctx_ver=Z39.88-2004&amp;rft.btitle=A%20Book&amp;rft.au=&quot;Q&quot;"></span>',
    );
  });

  it('drops extra attributes and non-COinS spans', () => {
    expect(sanitizeCoins('<span title="a" class="Z3988" onmouseover="x"></span><span class="other" title="b"></span>'))
      .toBe('<span class="Z3988" title="a"></span>');
  });

  it('cannot be broken out of with decoded quotes', () => {
    const out = sanitizeCoins('<span class="Z3988" title="&quot;&gt;&lt;script&gt;x&lt;/script&gt;"></span>');
    expect(out).toBe('<span class="Z3988" title="&quot;&gt;&lt;script&gt;x&lt;/script&gt;"></span>');
  });

  it('returns an empty string for junk', () => {
    expect(sanitizeCoins('nothing here')).toBe('');
    expect(sanitizeCoins(undefined)).toBe('');
  });
});

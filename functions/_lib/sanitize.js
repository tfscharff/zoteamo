// Allow-list sanitizer for citeproc-js HTML, and a rebuilder for translation-server COinS spans.
// Runs once when an item is saved; page views use the stored result.
import { escapeHtml } from './html.js';

const ALLOWED = new Set(['i', 'b', 'em', 'strong', 'span', 'sup', 'sub']);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'template', 'iframe', 'object', 'noscript', 'textarea', 'title']);
const TAG = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
const ENTITY = /^&(?:#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/;
const CLASS_ATTR = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function escapeText(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '&') out += ENTITY.test(text.slice(i, i + 40)) ? '&' : '&amp;';
    else if (c === '<') out += '&lt;';
    else if (c === '>') out += '&gt;';
    else if (c === '"') out += '&quot;';
    else out += c;
  }
  return out;
}

function classOf(attrs) {
  const m = CLASS_ATTR.exec(attrs);
  return (m?.[1] ?? m?.[2] ?? '').replace(/[^\w -]/g, '').replace(/\s+/g, ' ').trim();
}

export function sanitizeCitation(input) {
  const source = String(input ?? '');
  const open = []; // { name, emitted }
  let out = '';
  let last = 0;
  let dropping = null;
  const closeTo = (index) => {
    while (open.length > index) {
      const tag = open.pop();
      if (tag.emitted) out += `</${tag.name}>`;
    }
  };
  for (const m of source.matchAll(TAG)) {
    if (!dropping) out += escapeText(source.slice(last, m.index));
    last = m.index + m[0].length;
    if (!m[2]) continue; // comment
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (dropping) {
      if (closing && name === dropping) dropping = null;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      if (!closing) dropping = name;
      continue;
    }
    if (!ALLOWED.has(name)) continue;
    if (closing) {
      const at = open.findLastIndex((tag) => tag.name === name);
      if (at !== -1) closeTo(at);
      continue;
    }
    if (/\/\s*$/.test(m[3])) continue;
    const cls = name === 'span' ? classOf(m[3]) : '';
    const emitted = name !== 'span' || cls !== '';
    open.push({ name, emitted });
    if (emitted) out += name === 'span' ? `<span class="${cls}">` : `<${name}>`;
  }
  if (!dropping) out += escapeText(source.slice(last));
  closeTo(0);
  return out.trim();
}

const SPAN_OPEN = /<span\b([^>]*)>/gi;
const TITLE_ATTR = /\btitle\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const Z3988 = /\bclass\s*=\s*["'][^"']*\bZ3988\b/i;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text) {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, ref) => {
    if (ref[0] !== '#') return NAMED[ref.toLowerCase()] ?? whole;
    const code = ref[1].toLowerCase() === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

export function sanitizeCoins(input) {
  const spans = [];
  for (const m of String(input ?? '').matchAll(SPAN_OPEN)) {
    if (!Z3988.test(m[1])) continue;
    const title = TITLE_ATTR.exec(m[1]);
    if (!title) continue;
    spans.push(`<span class="Z3988" title="${escapeHtml(decodeEntities(title[1] ?? title[2]))}"></span>`);
  }
  return spans.join('');
}

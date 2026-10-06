// Formats CSL-JSON items as APA, MLA and Chicago (notes-bibliography) bibliography entries, as HTML and plain text.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import CSL from 'citeproc';

export const STYLE_FILES = { apa: 'apa.csl', mla: 'modern-language-association.csl', chicago: 'chicago-notes-bibliography.csl' };

const CSL_DIR = join(import.meta.dirname, 'csl');
const read = (name) => readFileSync(join(CSL_DIR, name), 'utf8');
const LOCALE = read('locales-en-US.xml');
const STYLES = Object.fromEntries(Object.entries(STYLE_FILES).map(([key, file]) => [key, read(file)]));

// Building an engine parses the whole style (about a second each), so build one per style, eagerly at module load (Lambda init phase), and reuse it.
// Each call replaces the engine's items; the Lambda handles one request at a time per instance.
let nextId = 0; // citeproc caches items by id, so an id must never be reused for different content
const current = new Map();
const sys = { retrieveLocale: () => LOCALE, retrieveItem: (id) => current.get(id) };
const engines = Object.fromEntries(Object.entries(STYLES).map(([key, xml]) => [key, new CSL.Engine(sys, xml, 'en-US', true)]));

// Each item is registered alone, so one entry never affects another (no disambiguation or "ibid" across items).
function bibliography(engine, item, format) {
  current.clear();
  current.set(item.id, item);
  engine.setOutputFormat(format);
  engine.updateItems([item.id]);
  const [, entries] = engine.makeBibliography();
  return entries.join('').trim();
}

export function formatItems(items) {
  return items.map((input) => {
    const item = { ...input, id: `item-${nextId++}` };
    return Object.fromEntries(Object.keys(STYLES).map((key) => {
      const engine = engines[key];
      return [key, { html: bibliography(engine, item, 'html'), text: bibliography(engine, item, 'text') }];
    }));
  });
}

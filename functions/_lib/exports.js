// Export files built from stored strings only. No Lambda calls at export time (spec §4).
function join(parts) {
  const kept = parts.filter((part) => typeof part === 'string' && part.trim()).map((part) => part.trim());
  return kept.length ? `${kept.join('\n\n')}\n` : '';
}

export const EXPORT_FORMATS = {
  'export.bib': { contentType: 'application/x-bibtex; charset=utf-8', ext: 'bib', body: (items) => join(items.map((i) => i.bibtex)) },
  'export.ris': { contentType: 'application/x-research-info-systems; charset=utf-8', ext: 'ris', body: (items) => join(items.map((i) => i.ris)) },
  'export.txt': { contentType: 'text/plain; charset=utf-8', ext: 'txt', body: (items, style) => join(items.map((i) => i[`text_${style}`])) },
};

export function exportFilename(title, ext) {
  const slug = String(title ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/, '');
  return `${slug || 'reading-list'}.${ext}`;
}

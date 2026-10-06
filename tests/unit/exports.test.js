import { describe, expect, it } from 'vitest';
import { EXPORT_FORMATS, exportFilename } from '../../functions/_lib/exports.js';

describe('exports', () => {
  it('joins stored strings with blank lines, skipping empty ones', () => {
    const items = [{ bibtex: '@book{a}\n', ris: 'TY  - BOOK\r\nER  - ', text_mla: 'A.' }, { bibtex: '', ris: null, text_mla: ' B. ' }];
    expect(EXPORT_FORMATS['export.bib'].body(items)).toBe('@book{a}\n');
    expect(EXPORT_FORMATS['export.ris'].body(items)).toBe('TY  - BOOK\r\nER  -\n');
    expect(EXPORT_FORMATS['export.txt'].body(items, 'mla')).toBe('A.\n\nB.\n');
    expect(EXPORT_FORMATS['export.txt'].body([], 'mla')).toBe('');
  });

  it('makes safe file names from list titles', () => {
    expect(exportFilename('Autumn Reads: Café & Co!', 'bib')).toBe('autumn-reads-cafe-co.bib');
    expect(exportFilename('***', 'ris')).toBe('reading-list.ris');
    expect(exportFilename('x'.repeat(100), 'txt')).toBe(`${'x'.repeat(60)}.txt`);
  });
});

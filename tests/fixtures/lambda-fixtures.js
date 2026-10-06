// Canned Lambda responses shared by the enrich and route tests.
export const BOOK = {
  key: 'ABCD1234', version: 0, itemType: 'book', title: 'The Reading Group',
  creators: [{ creatorType: 'author', firstName: 'Jane', lastName: 'Doe' }],
  date: '2020', publisher: 'Example Press', place: 'Chicago', ISBN: '9780000000002',
  notes: [], attachments: [{ title: 'Snapshot' }],
};

export const CSL_BOOK = {
  id: 'http://zotero.org/x', type: 'book', title: 'The Reading Group',
  author: [{ family: 'Doe', given: 'Jane' }], issued: { 'date-parts': [[2020]] },
  publisher: 'Example Press', 'publisher-place': 'Chicago', ISBN: '9780000000002',
};

export const EXPORTS = {
  bibtex: '\n@book{doe_reading_2020,\n\ttitle = {The {Reading} {Group}},\n\tauthor = {Doe, Jane},\n\tyear = {2020},\n}\n',
  ris: 'TY  - BOOK\r\nTI  - The Reading Group\r\nAU  - Doe, Jane\r\nPY  - 2020\r\nER  - \r\n',
  coins: '<span class="Z3988" title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook&amp;rft.btitle=The%20Reading%20Group"></span>',
};

export const FORMATTED = {
  apa: { html: '<div class="csl-entry">Doe, J. (2020). <i>The Reading Group</i>. Example Press.</div>', text: 'Doe, J. (2020). The Reading Group. Example Press.\n' },
  mla: { html: '<div class="csl-entry">Doe, Jane. <i>The Reading Group</i>. Example Press, 2020.</div>', text: 'Doe, Jane. The Reading Group. Example Press, 2020.' },
  chicago: { html: '<div class="csl-entry">Doe, Jane. <i>The Reading Group</i>. Chicago: Example Press, 2020.<script>x</script></div>', text: 'Doe, Jane. The Reading Group. Chicago: Example Press, 2020.' },
};

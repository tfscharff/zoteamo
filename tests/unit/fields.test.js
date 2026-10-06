import { describe, expect, it } from 'vitest';
import { formForItem, formFromZotero, readEditForm, rolesFor, validateEditForm, zoteroFromForm } from '../../functions/_lib/fields.js';

const formOf = (single, multi = {}) => ({ get: (k) => single[k] ?? '', getAll: (k) => multi[k] ?? [] });
const blank = { title: '', container: '', date: '', publisher: '', place: '', volume: '', issue: '', pages: '', url: '', DOI: '', ISBN: '', accessDate: '' };

describe('formFromZotero', () => {
  it('maps type-specific fields to the generic form fields', () => {
    expect(formFromZotero({ itemType: 'webpage', title: 'Notes', websiteTitle: 'Blog', url: 'https://x.org' })).toMatchObject({ container: 'Blog', url: 'https://x.org' });
    expect(formFromZotero({ itemType: 'thesis', university: 'Uni' }).publisher).toBe('Uni');
    expect(formFromZotero({ creators: [{ creatorType: 'editor', name: 'Society' }] }).creators)
      .toEqual([{ firstName: '', lastName: 'Society', creatorType: 'editor' }]);
  });
});

describe('formForItem', () => {
  it('pre-fills the pasted identifier when there is no metadata', () => {
    expect(formForItem({ zotero_json: null, input: 'doi:10.1234/x', input_kind: 'doi' }).DOI).toBe('10.1234/x');
    expect(formForItem({ zotero_json: null, input: 'https://x.org/a', input_kind: 'url' }).url).toBe('https://x.org/a');
    expect(formForItem({ zotero_json: '{"itemType":"book","title":"T"}', input: 'x', input_kind: 'url' }).title).toBe('T');
  });
});

describe('readEditForm', () => {
  it('zips creator rows and drops empty ones', () => {
    const values = readEditForm(formOf({ itemType: 'book', title: 'T' }, {
      creator_first: ['Ana', '', ''], creator_last: ['Ruiz', 'Example Society', ''], creator_role: ['author', 'editor', 'author'],
    }));
    expect(values.creators).toEqual([
      { firstName: 'Ana', lastName: 'Ruiz', creatorType: 'author' },
      { firstName: '', lastName: 'Example Society', creatorType: 'editor' },
    ]);
  });
});

describe('validateEditForm', () => {
  it('requires a title, a known type and a web URL', () => {
    const errors = validateEditForm({ ...blank, itemType: 'nonsense', url: 'ftp://x', creators: [] }, { itemType: 'book' });
    expect(errors.map((e) => e.field)).toEqual(['title', 'itemType', 'url']);
  });

  it('accepts an unknown type the item already had', () => {
    expect(validateEditForm({ ...blank, title: 'T', itemType: 'film', creators: [] }, { itemType: 'film' })).toEqual([]);
  });

  it('asks for a last name when only a first name is given', () => {
    const errors = validateEditForm({ ...blank, title: 'T', itemType: 'book', creators: [{ firstName: 'Ana', lastName: '', creatorType: 'author' }] }, { itemType: 'book' });
    expect(errors).toEqual([{ field: 'creator-last-1', message: 'Person 1 needs a last name or an organization name.' }]);
  });
  it('rejects prototype keys as item types', () => {
    const errors = validateEditForm({ ...blank, title: 'T', itemType: 'constructor', creators: [] }, { itemType: 'book' });
    expect(errors.map((e) => e.field)).toEqual(['itemType']);
  });

  it('only offers editor and translator on types that use them', () => {
    const person = (creatorType) => [{ firstName: '', lastName: 'X', creatorType }];
    const check = (itemType, creatorType, previous = { itemType }) =>
      validateEditForm({ ...blank, title: 'T', itemType, creators: person(creatorType) }, previous);
    expect(check('webpage', 'editor')).toEqual([{ field: 'creator-role-1', message: 'Choose a role for person 1.' }]);
    expect(check('book', 'editor')).toEqual([]);
    expect(check('webpage', 'seriesEditor', { itemType: 'webpage', creators: [{ creatorType: 'seriesEditor', name: 'X' }] })).toEqual([]);
    expect(rolesFor('webpage')).toEqual(['author', 'contributor']);
  });
});

describe('zoteroFromForm', () => {
  it('does not throw for a prototype-key type the item already had', () => {
    const z = zoteroFromForm({ ...blank, itemType: 'constructor', title: 'T', creators: [] }, { itemType: 'constructor', title: 'Old' });
    expect(z).toEqual({ itemType: 'constructor', title: 'T', creators: [] });
  });

  it('writes only the fields that belong to the type', () => {
    const z = zoteroFromForm({
      ...blank, itemType: 'journalArticle', title: 'Reading Together', container: 'Journal of Groups', volume: '12', issue: '3',
      pages: '45-67', DOI: '10.1/x', publisher: 'Ignored Press', creators: [
        { firstName: 'Alex', lastName: 'Smith', creatorType: 'author' },
        { firstName: '', lastName: 'Example Society', creatorType: 'editor' },
      ],
    }, { itemType: 'journalArticle', ISSN: '1234-5678', title: 'Old' });
    expect(z).toEqual({
      itemType: 'journalArticle', ISSN: '1234-5678', title: 'Reading Together', publicationTitle: 'Journal of Groups',
      volume: '12', issue: '3', pages: '45-67', DOI: '10.1/x',
      creators: [{ creatorType: 'author', firstName: 'Alex', lastName: 'Smith' }, { creatorType: 'editor', name: 'Example Society' }],
    });
  });

  it('drops the old type’s fields when the type changes, keeping type-independent ones', () => {
    const z = zoteroFromForm({ ...blank, itemType: 'book', title: 'T', container: 'Ignored', ISBN: '9780262033848', creators: [] },
      { itemType: 'bookSection', bookTitle: 'Collected', ISBN: 'old', abstractNote: 'Abs', series: 'S' });
    expect(z).toEqual({ itemType: 'book', abstractNote: 'Abs', title: 'T', ISBN: '9780262033848', creators: [] });
  });

  it('only touches universal fields for types it doesn’t know', () => {
    const z = zoteroFromForm({ ...blank, itemType: 'film', title: 'New', publisher: 'x', creators: [] }, { itemType: 'film', distributor: 'Studio', title: 'Old' });
    expect(z).toEqual({ itemType: 'film', distributor: 'Studio', title: 'New', creators: [] });
  });
});

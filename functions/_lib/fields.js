// Maps the hand-edit form to Zotero item JSON (the source of truth) and back. Only fields that belong to the
// item type are written, so translation-server can export the result.
import { detect } from './detect.js';
import { LIMITS } from './validate.js';

export const ITEM_TYPES = {
  book: { label: 'Book', fields: ['publisher', 'place', 'volume', 'ISBN'] },
  bookSection: { label: 'Book chapter', container: 'bookTitle', fields: ['publisher', 'place', 'volume', 'pages', 'ISBN'] },
  journalArticle: { label: 'Journal article', container: 'publicationTitle', fields: ['volume', 'issue', 'pages', 'DOI'] },
  magazineArticle: { label: 'Magazine article', container: 'publicationTitle', fields: ['volume', 'issue', 'pages'] },
  newspaperArticle: { label: 'Newspaper article', container: 'publicationTitle', fields: ['place', 'pages'] },
  webpage: { label: 'Web page', container: 'websiteTitle', fields: [] },
  blogPost: { label: 'Blog post', container: 'blogTitle', fields: [] },
  report: { label: 'Report', publisher: 'institution', fields: ['publisher', 'place', 'pages'] },
  thesis: { label: 'Thesis', publisher: 'university', fields: ['publisher', 'place'] },
  conferencePaper: { label: 'Conference paper', container: 'proceedingsTitle', fields: ['publisher', 'place', 'volume', 'pages', 'DOI', 'ISBN'] },
  document: { label: 'Document', fields: ['publisher'] },
};
export const CREATOR_ROLES = { author: 'Author', editor: 'Editor', translator: 'Translator', contributor: 'Contributor' };
const EDITOR_TYPES = ['book', 'bookSection', 'journalArticle', 'conferencePaper'];

// Own-property lookups, so keys like "constructor" never resolve to Object.prototype members.
export const typeOf = (key) => (Object.hasOwn(ITEM_TYPES, key) ? ITEM_TYPES[key] : undefined);
export const roleLabel = (key) => (Object.hasOwn(CREATOR_ROLES, key) ? CREATOR_ROLES[key] : key);
export const previousRoles = (zotero) => (zotero?.creators ?? []).map((c) => c.creatorType).filter(Boolean);

// Roles a member may pick: editor and translator only where they make sense, plus any the item already has.
export function rolesFor(itemType, previous = []) {
  const roles = ['author', 'contributor'];
  if (EDITOR_TYPES.includes(itemType)) roles.push('editor', 'translator');
  for (const role of previous) if (!roles.includes(role)) roles.push(role);
  return roles;
}
export const FORM_FIELDS = ['title', 'container', 'date', 'publisher', 'place', 'volume', 'issue', 'pages', 'url', 'DOI', 'ISBN', 'accessDate'];

const UNIVERSAL = ['title', 'date', 'url', 'accessDate'];
const KEEP_ON_TYPE_CHANGE = ['abstractNote', 'language', 'shortTitle', 'extra', 'tags', 'collections', 'relations'];
const publisherKey = (type) => type?.publisher ?? 'publisher';
const zoteroKey = (type, field) => (field === 'publisher' ? publisherKey(type) : field);
const MANAGED_KEYS = new Set([
  ...UNIVERSAL,
  ...Object.values(ITEM_TYPES).flatMap((t) => [t.container, ...t.fields.map((f) => zoteroKey(t, f))]).filter(Boolean),
]);

export function parseZoteroJson(item) {
  try {
    const parsed = item.zotero_json ? JSON.parse(item.zotero_json) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function formFromZotero(z = {}) {
  const type = typeOf(z.itemType);
  return {
    itemType: z.itemType || 'book',
    title: z.title ?? '',
    container: type?.container ? (z[type.container] ?? '') : '',
    date: z.date ?? '',
    publisher: z[publisherKey(type)] ?? '',
    place: z.place ?? '', volume: z.volume ?? '', issue: z.issue ?? '', pages: z.pages ?? '',
    url: z.url ?? '', DOI: z.DOI ?? '', ISBN: z.ISBN ?? '', accessDate: z.accessDate ?? '',
    creators: (z.creators ?? []).map((c) => ({
      firstName: c.firstName ?? '', lastName: c.lastName ?? c.name ?? '', creatorType: c.creatorType ?? 'author',
    })),
  };
}

const PREFILL = { url: 'url', doi: 'DOI', isbn: 'ISBN' };

export function formForItem(item) {
  const values = formFromZotero(parseZoteroJson(item));
  const field = PREFILL[item.input_kind];
  if (!item.zotero_json && field) {
    try {
      values[field] = detect(item.input).value;
    } catch {
      values[field] = item.input;
    }
  }
  return values;
}

export function readEditForm(form) {
  const values = Object.fromEntries(FORM_FIELDS.map((f) => [f, form.get(f)]));
  values.itemType = form.get('itemType');
  const first = form.getAll('creator_first');
  const roles = form.getAll('creator_role');
  values.creators = form.getAll('creator_last')
    .map((lastName, i) => ({ firstName: first[i] ?? '', lastName, creatorType: roles[i] || 'author' }))
    .filter((c) => c.firstName || c.lastName);
  return values;
}

export function validateEditForm(values, previous = {}) {
  const errors = [];
  const allowedRoles = rolesFor(values.itemType, previousRoles(previous));
  if (!values.title) errors.push({ field: 'title', message: 'Enter a title.' });
  if (!typeOf(values.itemType) && values.itemType !== previous.itemType) errors.push({ field: 'itemType', message: 'Choose an item type.' });
  if (values.url && !/^https?:\/\/\S+$/i.test(values.url)) {
    errors.push({ field: 'url', message: 'Enter a full web address starting with https:// or http://.' });
  }
  for (const field of FORM_FIELDS) {
    if (values[field].length > LIMITS.field) errors.push({ field, message: `Keep this to ${LIMITS.field} characters or fewer.` });
  }
  values.creators.forEach((c, i) => {
    if (!c.lastName) errors.push({ field: `creator-last-${i + 1}`, message: `Person ${i + 1} needs a last name or an organization name.` });
    if (!allowedRoles.includes(c.creatorType)) errors.push({ field: `creator-role-${i + 1}`, message: `Choose a role for person ${i + 1}.` });
  });
  return errors;
}

export function zoteroFromForm(values, previous = {}) {
  const typeChanged = previous.itemType !== values.itemType;
  const next = typeChanged
    ? Object.fromEntries(Object.entries(previous).filter(([key]) => KEEP_ON_TYPE_CHANGE.includes(key)))
    : { ...previous };
  next.itemType = values.itemType;
  const type = typeOf(values.itemType);
  for (const key of type ? MANAGED_KEYS : UNIVERSAL) delete next[key];
  for (const key of UNIVERSAL) if (values[key]) next[key] = values[key];
  if (type) {
    if (type.container && values.container) next[type.container] = values.container;
    for (const field of type.fields) if (values[field]) next[zoteroKey(type, field)] = values[field];
  }
  next.creators = values.creators.map((c) =>
    c.firstName ? { creatorType: c.creatorType, firstName: c.firstName, lastName: c.lastName } : { creatorType: c.creatorType, name: c.lastName });
  return next;
}

import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as editForm, onRequestPost as saveEdit } from '../../functions/e/[token]/items/[id]/edit.js';
import { onRequestPost as retry } from '../../functions/e/[token]/items/[id]/retry.js';
import { fakeLambda } from './fake-lambda.js';
import { onRequestGet as listPage } from '../../functions/e/[token]/index.js';
import { call, createTestList, location, seedItem } from './helpers.js';

afterEach(() => vi.restoreAllMocks());

const row = (id) => env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
const get = (token, id, query = '') => call(editForm, { path: `/e/${token}/items/${id}/edit${query}`, params: { token, id } });
const post = (handler, token, id, action, form = {}) =>
  call(handler, { method: 'POST', path: `/e/${token}/items/${id}/${action}`, params: { token, id }, form });

const ARTICLE = [
  ['itemType', 'journalArticle'], ['title', 'Reading Together'], ['container', 'Journal of Groups'],
  ['date', '2019'], ['volume', '12'], ['issue', '3'], ['pages', '45-67'], ['DOI', '10.1234/jog'],
  ['publisher', 'Ignored'], ['place', ''], ['url', ''], ['ISBN', ''], ['accessDate', ''],
  ['creator_first', 'Alex'], ['creator_last', 'Smith'], ['creator_role', 'author'],
  ['creator_first', ''], ['creator_last', 'Example Society'], ['creator_role', 'editor'],
  ['creator_first', ''], ['creator_last', ''], ['creator_role', 'author'],
];

describe('edit a citation by hand', () => {
  it('shows the stored details with spare contributor rows', async () => {
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { title: 'A Book' });
    const page = await (await get(editToken, itemId)).text();
    expect(page).toContain('<h1>Edit citation</h1>');
    expect(page).toContain('id="title" name="title" value="A Book"');
    expect(page).toContain('<option value="book" selected>Book</option>');
    expect(page).toContain('<legend>Person 3</legend>');
  });

  it('explains a failed lookup and pre-fills the pasted link', async () => {
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { title: 'x', ready: false });
    await env.DB.prepare(`UPDATE items SET citation_state = 'failed', citation_error = 'No citation details could be found there.', input = 'https://example.com/paper' WHERE id = ?`).bind(itemId).run();
    const page = await (await get(editToken, itemId, '?lookup=failed')).text();
    expect(page).toContain('We couldn’t get the details automatically: No citation details could be found there.');
    expect(page).toContain('value="https://example.com/paper"');
  });

  it('saves the edited metadata and re-derives every format', async () => {
    const calls = fakeLambda();
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { title: 'A Book' });
    const res = await post(saveEdit, editToken, itemId, 'edit', ARTICLE);
    expect(location(res)).toBe(`/e/${editToken}?updated=${itemId}#item-${itemId}`);
    const saved = await row(itemId);
    expect(JSON.parse(saved.zotero_json)).toEqual({
      itemType: 'journalArticle', title: 'Reading Together', publicationTitle: 'Journal of Groups', date: '2019',
      volume: '12', issue: '3', pages: '45-67', DOI: '10.1234/jog',
      creators: [{ creatorType: 'author', firstName: 'Alex', lastName: 'Smith' }, { creatorType: 'editor', name: 'Example Society' }],
    });
    expect(saved).toMatchObject({ citation_state: 'ready', title: 'Reading Together' });
    expect(calls.some((c) => c.key === 'translation.test /export')).toBe(true);
  });

  it('re-shows the form with linked errors and keeps what was typed', async () => {
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { title: 'A Book' });
    const res = await post(saveEdit, editToken, itemId, 'edit', ARTICLE.map(([k, v]) => [k, k === 'title' ? '' : v]));
    expect(res.status).toBe(422);
    const page = await res.text();
    expect(page).toContain('<a href="#title">Enter a title.</a>');
    expect(page).toContain('value="Journal of Groups"');
    expect(page).toContain('value="Example Society"');
  });

  it('keeps the edit when the formatter is down', async () => {
    fakeLambda({ 'format.test /': () => new Response('down', { status: 503 }) });
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { title: 'A Book' });
    await post(saveEdit, editToken, itemId, 'edit', ARTICLE);
    expect(await row(itemId)).toMatchObject({ citation_state: 'pending', title: 'Reading Together', citation_error: 'The citation formatter failed (503).' });
  });
});

describe('retry', () => {
  it('re-derives an item that has metadata', async () => {
    fakeLambda();
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { title: 'A Book', ready: false });
    await env.DB.prepare(`UPDATE items SET zotero_json = '{"itemType":"book","title":"A Book"}', citation_error = 'down' WHERE id = ?`).bind(itemId).run();
    const res = await post(retry, editToken, itemId, 'retry');
    expect(location(res)).toBe(`/e/${editToken}?updated=${itemId}#item-${itemId}`);
    expect((await row(itemId)).citation_state).toBe('ready');
  });

  it('repeats the lookup for an item that has none', async () => {
    fakeLambda();
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { title: 'retry-lookup', ready: false });
    await env.DB.prepare(`UPDATE items SET citation_state = 'failed', input = 'https://example.com/retry-me' WHERE id = ?`).bind(itemId).run();
    const res = await post(retry, editToken, itemId, 'retry');
    expect(location(res)).toBe(`/e/${editToken}?added=${itemId}#item-${itemId}`);
    expect(await row(itemId)).toMatchObject({ citation_state: 'ready', title: 'The Reading Group' });
  });

  it('sends a manual item with no input to the edit form', async () => {
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { title: '', ready: false });
    await env.DB.prepare(`UPDATE items SET input = '', input_kind = 'manual' WHERE id = ?`).bind(itemId).run();
    expect(location(await post(retry, editToken, itemId, 'retry'))).toBe(`/e/${editToken}/items/${itemId}/edit`);
  });
});

describe('items from another list', () => {
  it('cannot be edited or retried', async () => {
    const owner = await createTestList();
    const itemId = await seedItem(owner.id, { title: 'Theirs' });
    const { editToken } = await createTestList();
    expect((await get(editToken, itemId)).status).toBe(404);
    expect((await post(saveEdit, editToken, itemId, 'edit', ARTICLE)).status).toBe(404);
    expect((await post(retry, editToken, itemId, 'retry')).status).toBe(404);
    expect((await row(itemId)).title).toBe('Theirs');
  });
});

describe('item controls on the edit page', () => {
  const page = async (token) => (await call(listPage, { path: `/e/${token}`, params: { token } })).text();

  it('shows Retry and Edit for a pending item, only Edit for a ready one', async () => {
    const { id, editToken } = await createTestList();
    const pending = await seedItem(id, { title: 'Pending One', ready: false });
    const ready = await seedItem(id, { title: 'Ready One' });
    const html = await page(editToken);
    expect(html).toContain(`action="/e/${editToken}/items/${pending}/retry"`);
    expect(html).toContain(`href="/e/${editToken}/items/${pending}/edit"`);
    expect(html).toContain(`href="/e/${editToken}/items/${ready}/edit"`);
    expect(html).not.toContain(`/items/${ready}/retry`);
  });
});

import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as editPage } from '../../functions/e/[token]/index.js';
import { onRequestPost as addItem } from '../../functions/e/[token]/items/index.js';
import { onRequestPost as selectItem } from '../../functions/e/[token]/items/[id]/select.js';
import { fakeLambda } from './fake-lambda.js';
import { call, createTestList, location, seedItem } from './helpers.js';

afterEach(() => vi.restoreAllMocks());

const add = (token, form, cookie) =>
  call(addItem, { method: 'POST', path: `/e/${token}/items`, params: { token }, form, cookie });
const row = (id) => env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
const count = async (listId) => (await env.DB.prepare('SELECT COUNT(*) AS n FROM items WHERE list_id = ?').bind(listId).first()).n;
const addedId = (res) => location(res).match(/\?added=([0-9a-f-]{36})#item-/)[1];

const MULTIPLE = { url: 'https://example.com/list', session: 'sess-1', items: { 0: 'First <b>one</b>', 1: { title: '"Second"' } } };
const multipleRoute = { 'translation.test /web': (_url, body) => (body.startsWith('{') ? Response.json([{ itemType: 'book', title: 'Picked' }]) : Response.json(MULTIPLE, { status: 300 })) };

describe('add an item', () => {
  it('looks up a DOI and stores every format', async () => {
    const calls = fakeLambda();
    const { editToken } = await createTestList();
    const res = await add(editToken, { input: 'doi:10.1234/add-1', added_by: 'Ana', note: 'For May' });
    expect(res.status).toBe(303);
    expect(location(res)).toMatch(new RegExp(`^/e/${editToken}\\?added=[0-9a-f-]{36}#item-[0-9a-f-]{36}$`));
    const saved = await row(addedId(res));
    expect(saved).toMatchObject({ input_kind: 'doi', citation_state: 'ready', title: 'The Reading Group', added_by: 'Ana', note: 'For May' });
    expect(saved.cite_apa).toBe('Doe, J. (2020). <i>The Reading Group</i>. Example Press.');
    expect(saved.cite_chicago).not.toContain('script');
    expect(calls[0]).toMatchObject({ key: 'translation.test /search', body: '10.1234/add-1' });
    expect(calls[0].authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(res.headers.getSetCookie().join()).toContain('zoteamo_name=Ana');
  });

  it('re-shows the form with a linked error for input it can’t read', async () => {
    const calls = fakeLambda();
    const { id, editToken } = await createTestList();
    const res = await add(editToken, { input: 'http://localhost/secret', added_by: 'Bo <b>', note: 'n' });
    expect(res.status).toBe(422);
    const page = await res.text();
    expect(page).toContain('<title>Error: Test list – zoteamo</title>');
    expect(page).toContain('<a href="#add-input">That link points to a local or private address, which can’t be looked up.</a>');
    expect(page).toContain('id="add-input-error"');
    expect(page).toContain('value="http://localhost/secret"');
    expect(page).toContain('value="Bo &lt;b&gt;"');
    expect(page.indexOf('id="add-title"')).toBeLessThan(page.indexOf('class="links-panel"'));
    expect(calls).toHaveLength(0);
    expect(await count(id)).toBe(0);
  });

  it('stops at 30 new items an hour, counting only the last hour', async () => {
    fakeLambda();
    const { id, editToken } = await createTestList();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 30; i++) await seedItem(id, { title: `Old ${i}`, createdAt: twoHoursAgo, ready: false });
    expect((await add(editToken, { input: 'doi:10.1234/add-2' })).status).toBe(303);
    for (let i = 0; i < 29; i++) await seedItem(id, { title: `New ${i}`, ready: false });
    const res = await add(editToken, { input: 'doi:10.1234/add-3' });
    expect(res.status).toBe(429);
    expect(await res.text()).toContain('This list has had 30 items added in the last hour');
  });

  it('marks the item failed and opens the manual form when nothing is found', async () => {
    fakeLambda({ 'translation.test /web': () => new Response('No translators', { status: 501 }) });
    const { editToken } = await createTestList();
    const res = await add(editToken, { input: 'https://example.com/nothing-here' });
    const [, itemId] = location(res).match(new RegExp(`^/e/${editToken}/items/([0-9a-f-]{36})/edit\\?lookup=failed$`));
    expect(await row(itemId)).toMatchObject({ citation_state: 'failed', citation_error: 'No citation details could be found there.' });
  });

  it('survives translation-server being unreachable', async () => {
    fakeLambda({ 'translation.test /web': () => { throw new TypeError('network down'); } });
    const { editToken } = await createTestList();
    const res = await add(editToken, { input: 'https://example.com/down' });
    expect(res.status).toBe(303);
    const itemId = location(res).match(/items\/([0-9a-f-]{36})\/edit/)[1];
    expect(await row(itemId)).toMatchObject({ citation_state: 'failed', citation_error: 'The lookup service couldn’t be reached.' });
  });

  it('keeps the item pending with a reason when the formatter fails', async () => {
    fakeLambda({ 'format.test /': () => new Response('boom', { status: 502 }) });
    const { editToken } = await createTestList();
    const res = await add(editToken, { input: 'https://example.com/fmt-down' });
    expect(await row(addedId(res))).toMatchObject({ citation_state: 'pending', citation_error: 'The citation formatter failed (502).' });
  });

  it('starts a manual item', async () => {
    const calls = fakeLambda();
    const { editToken } = await createTestList();
    const res = await add(editToken, { manual: '1', added_by: 'Cy' });
    const [, itemId] = location(res).match(new RegExp(`^/e/${editToken}/items/([0-9a-f-]{36})/edit$`));
    expect(await row(itemId)).toMatchObject({ input_kind: 'manual', input: '', added_by: 'Cy', citation_state: 'pending' });
    expect(calls).toHaveLength(0);
  });

  it('also rate limits starting a manual item', async () => {
    const { id, editToken } = await createTestList();
    for (let i = 0; i < 30; i++) await seedItem(id, { title: `New ${i}`, ready: false });
    expect((await add(editToken, { manual: '1' })).status).toBe(429);
  });

  it('pre-fills the name from the cookie on the edit page', async () => {
    const { editToken } = await createTestList();
    const res = await call(editPage, { path: `/e/${editToken}`, params: { token: editToken }, cookie: 'zoteamo_name=Ana%20R' });
    expect(await res.text()).toContain('id="add-added_by" name="added_by" value="Ana R"');
  });

  it('returns 404 for an unknown edit token', async () => {
    expect((await add('AAAAAAAAAAAAAAAAAAAAAA', { input: 'doi:10.1/x' })).status).toBe(404);
  });
});

describe('several items on one page', () => {
  async function startChoice(overrides = multipleRoute) {
    const calls = fakeLambda(overrides);
    const { id, editToken } = await createTestList();
    const res = await add(editToken, { input: 'https://example.com/list' });
    const page = await res.text();
    const itemId = page.match(/items\/([0-9a-f-]{36})\/select/)[1];
    return { calls, listId: id, editToken, res, page, itemId };
  }
  const choose = (editToken, itemId, form) =>
    call(selectItem, { method: 'POST', path: `/e/${editToken}/items/${itemId}/select`, params: { token: editToken, id: itemId }, form });

  it('shows an escaped choice page', async () => {
    const { res, page } = await startChoice();
    expect(res.status).toBe(200);
    expect(page).toContain('<h1>Which item did you mean?</h1>');
    expect(page).toContain('<label for="choice-0">First &lt;b&gt;one&lt;/b&gt;</label>');
    expect(page).toContain('<label for="choice-1">&quot;Second&quot;</label>');
    expect(page).toContain('name="session" value="sess-1"');
    expect(page).toContain('name="choices" value="{&quot;0&quot;:&quot;First &lt;b&gt;one&lt;/b&gt;&quot;');
  });

  it('adds the chosen item', async () => {
    const { calls, editToken, itemId } = await startChoice();
    const res = await choose(editToken, itemId, { url: MULTIPLE.url, session: 'sess-1', choices: JSON.stringify(MULTIPLE.items), choice: '1' });
    expect(location(res)).toBe(`/e/${editToken}?added=${itemId}#item-${itemId}`);
    expect(JSON.parse(calls.find((c) => c.body.startsWith('{')).body)).toEqual({ url: MULTIPLE.url, session: 'sess-1', items: { 1: { title: '"Second"' } } });
    expect(await row(itemId)).toMatchObject({ citation_state: 'ready', title: 'Picked' });
  });

  it('removes the pending item when the choice has expired', async () => {
    const { editToken, itemId } = await startChoice({
      'translation.test /web': (_url, body) => (body.startsWith('{') ? new Response('expired', { status: 400 }) : Response.json(MULTIPLE, { status: 300 })),
    });
    const res = await choose(editToken, itemId, { url: MULTIPLE.url, session: 'sess-1', choices: JSON.stringify(MULTIPLE.items), choice: '0' });
    expect(location(res)).toBe(`/e/${editToken}?error=choice_expired`);
    expect(await row(itemId)).toBeNull();
  });

  it('refuses a tampered private URL without calling translation-server', async () => {
    const { calls, editToken, itemId } = await startChoice();
    const before = calls.length;
    const res = await choose(editToken, itemId, { url: 'http://localhost/x', session: 'sess-1', choices: JSON.stringify(MULTIPLE.items), choice: '0' });
    expect(location(res)).toBe(`/e/${editToken}?error=choice_expired`);
    expect(calls).toHaveLength(before);
  });

  it('returns 404 for an item from another list or an unknown id', async () => {
    fakeLambda();
    const { editToken } = await createTestList();
    const other = await createTestList();
    const foreign = await seedItem(other.id, { ready: false });
    const form = { url: MULTIPLE.url, session: 's', choices: '{}', choice: '0' };
    expect((await choose(editToken, foreign, form)).status).toBe(404);
    expect((await choose(editToken, crypto.randomUUID(), form)).status).toBe(404);
    expect(await row(foreign)).not.toBeNull();
  });

  it('leaves an item that is already filled in alone', async () => {
    const calls = fakeLambda();
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { ready: true });
    const res = await choose(editToken, itemId, { url: MULTIPLE.url, session: 's', choices: JSON.stringify(MULTIPLE.items), choice: '0' });
    expect(res.status).toBe(303);
    expect(location(res)).toBe(`/e/${editToken}#item-${itemId}`);
    expect(await row(itemId)).toMatchObject({ citation_state: 'ready' });
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['choices that are not JSON', { choices: 'not json', choice: '0' }],
    ['a choice key that is not offered', { choices: JSON.stringify(MULTIPLE.items), choice: '9' }],
  ])('removes the pending item for %s without a lookup', async (_name, fields) => {
    const { calls, editToken, itemId } = await startChoice();
    const before = calls.length;
    const res = await choose(editToken, itemId, { url: MULTIPLE.url, session: 'sess-1', ...fields });
    expect(location(res)).toBe(`/e/${editToken}?error=choice_expired`);
    expect(await row(itemId)).toBeNull();
    expect(calls.slice(before).filter((c) => c.body.startsWith('{'))).toHaveLength(0);
  });
});

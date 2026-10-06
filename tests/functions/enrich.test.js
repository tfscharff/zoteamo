import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { getCached, putCached } from '../../functions/_lib/db/cache.js';
import { insertItem } from '../../functions/_lib/db/items.js';
import { derive, deriveAndSave, lookup, lookupChoice, LookupError } from '../../functions/_lib/enrich.js';
import { LambdaError } from '../../functions/_lib/lambda.js';
import { BOOK, CSL_BOOK, EXPORTS, FORMATTED } from '../fixtures/lambda-fixtures.js';
import { createTestList } from './helpers.js';

function fakeClient({ translation, format } = {}) {
  const calls = [];
  return {
    calls,
    async translation(path, body, contentType = 'text/plain') {
      calls.push(['translation', path, body, contentType]);
      return translation ? translation(path, body) : Response.json([BOOK]);
    },
    async exportAs(fmt) {
      calls.push(['export', fmt]);
      return fmt === 'csljson' ? JSON.stringify([CSL_BOOK]) : EXPORTS[fmt];
    },
    async format(items) {
      calls.push(['format', items]);
      return format ? format(items) : [FORMATTED];
    },
  };
}

const row = (id) => env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();

// A response whose body stream errors mid-read.
const brokenBody = (status) => {
  const body = new ReadableStream({ pull(controller) { controller.error(new TypeError('network lost')); } });
  return new Response(body, { status });
};

describe('lookup', () => {
  it('looks up a URL with /web, strips attachments and caches the item', async () => {
    const client = fakeClient();
    const detected = { kind: 'url', value: 'https://example.com/cache-me' };
    const first = await lookup(client, env.DB, detected);
    expect(first.kind).toBe('item');
    expect(first.item.title).toBe('The Reading Group');
    expect(first.item).not.toHaveProperty('attachments');
    expect(client.calls).toEqual([['translation', '/web', 'https://example.com/cache-me', 'text/plain']]);
    expect((await lookup(client, env.DB, detected)).item.title).toBe('The Reading Group');
    expect(client.calls).toHaveLength(1);
  });

  it('looks up identifiers with /search', async () => {
    const client = fakeClient();
    await lookup(client, env.DB, { kind: 'isbn', value: '9780262033848' });
    expect(client.calls[0].slice(0, 3)).toEqual(['translation', '/search', '9780262033848']);
  });

  it('ignores cache entries older than 30 days', async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await putCached(env.DB, 'doi:10.1/stale', { itemType: 'book', title: 'Stale' }, old);
    expect(await getCached(env.DB, 'doi:10.1/stale')).toBeNull();
    const client = fakeClient();
    expect((await lookup(client, env.DB, { kind: 'doi', value: '10.1/stale' })).item.title).toBe('The Reading Group');
  });

  it('returns choices when a page lists several items', async () => {
    const client = fakeClient({
      translation: () => Response.json({ url: 'https://example.com/list', session: 's1', items: { 0: 'One', 1: 'Two' } }, { status: 300 }),
    });
    expect(await lookup(client, env.DB, { kind: 'url', value: 'https://example.com/list' })).toEqual({
      kind: 'choose', url: 'https://example.com/list', session: 's1', choices: { 0: 'One', 1: 'Two' },
    });
  });

  it.each([
    [501, 'No citation details could be found there.'],
    [500, 'The lookup service returned an error (500).'],
  ])('explains a %i from translation-server', async (status, message) => {
    const client = fakeClient({ translation: () => new Response('err', { status }) });
    await expect(lookup(client, env.DB, { kind: 'url', value: `https://example.com/e${status}` })).rejects.toThrow(new LookupError(message));
  });

  it('treats a response with only notes as nothing found', async () => {
    const client = fakeClient({ translation: () => Response.json([{ itemType: 'note', note: 'x' }]) });
    await expect(lookup(client, env.DB, { kind: 'url', value: 'https://example.com/notes' })).rejects.toThrow(LookupError);
  });

  it.each([200, 300])('turns a failed body read (%i) into a LambdaError', async (status) => {
    const client = fakeClient({ translation: () => brokenBody(status) });
    await expect(lookup(client, env.DB, { kind: 'url', value: `https://example.com/broken${status}` }))
      .rejects.toThrow(new LambdaError('The lookup service couldn’t be reached.'));
  });
});

describe('lookupChoice', () => {
  it('posts the chosen key back to /web as JSON', async () => {
    const client = fakeClient();
    const item = await lookupChoice(client, { url: 'https://example.com/list', session: 's1', choices: { 0: 'One', 1: 'Two' }, key: '1' });
    expect(item.title).toBe('The Reading Group');
    const [, path, body, type] = client.calls[0];
    expect([path, type]).toEqual(['/web', 'application/json']);
    expect(JSON.parse(body)).toEqual({ url: 'https://example.com/list', session: 's1', items: { 1: 'Two' } });
  });

  it('fails clearly when the choice is unknown or expired', async () => {
    await expect(lookupChoice(fakeClient(), { url: 'u', session: 's', choices: {}, key: '0' })).rejects.toThrow(LookupError);
    const expired = fakeClient({ translation: () => new Response('gone', { status: 400 }) });
    await expect(lookupChoice(expired, { url: 'u', session: 's', choices: { 0: 'x' }, key: '0' })).rejects.toThrow(LookupError);
  });

  it('turns a failed body read into a LambdaError', async () => {
    const client = fakeClient({ translation: () => brokenBody(200) });
    await expect(lookupChoice(client, { url: 'u', session: 's', choices: { 0: 'x' }, key: '0' })).rejects.toThrow(LambdaError);
  });
});

describe('derive and save', () => {
  it('derives sanitized citations, plain text and exports in order', async () => {
    const client = fakeClient();
    const d = await derive(client, BOOK);
    expect(d.title).toBe('The Reading Group');
    expect(d.cite.apa).toBe('Doe, J. (2020). <i>The Reading Group</i>. Example Press.');
    expect(d.cite.chicago).not.toContain('script');
    expect(d.text.apa).toBe('Doe, J. (2020). The Reading Group. Example Press.');
    expect(d.bibtex.startsWith('@book{')).toBe(true);
    expect(d.coins).toMatch(/^<span class="Z3988" title="ctx_ver=/);
    expect(JSON.parse(d.cslJson)).toEqual([CSL_BOOK]);
    expect(client.calls.filter((c) => c[0] === 'export').map((c) => c[1])).toEqual(['csljson', 'bibtex', 'ris', 'coins']);
    expect(client.calls.find((c) => c[0] === 'format')[1]).toEqual([CSL_BOOK]);
  });

  it('rejects an incomplete formatter result', async () => {
    const client = fakeClient({ format: () => [{ apa: { html: 'a', text: 'a' } }] });
    await expect(derive(client, BOOK)).rejects.toThrow(LambdaError);
  });

  it('saves a ready item', async () => {
    const { id: listId } = await createTestList();
    const itemId = await insertItem(env.DB, { listId, input: 'x', inputKind: 'url' });
    expect(await deriveAndSave(fakeClient(), env.DB, itemId, BOOK)).toEqual({ ok: true });
    expect(await row(itemId)).toMatchObject({ citation_state: 'ready', title: 'The Reading Group', citation_error: null });
  });

  it('keeps the metadata and stays pending when the formatter is down', async () => {
    const { id: listId } = await createTestList();
    const itemId = await insertItem(env.DB, { listId, input: 'x', inputKind: 'url' });
    const client = fakeClient({ format: () => { throw new LambdaError('The citation formatter failed (502).'); } });
    expect(await deriveAndSave(client, env.DB, itemId, BOOK)).toEqual({ ok: false, error: 'The citation formatter failed (502).' });
    const saved = await row(itemId);
    expect(saved).toMatchObject({ citation_state: 'pending', citation_error: 'The citation formatter failed (502).', title: 'The Reading Group' });
    expect(JSON.parse(saved.zotero_json).title).toBe('The Reading Group');
  });

  it('lets unexpected errors through', async () => {
    const { id: listId } = await createTestList();
    const itemId = await insertItem(env.DB, { listId, input: 'x', inputKind: 'url' });
    const client = fakeClient({ format: () => { throw new RangeError('bug'); } });
    await expect(deriveAndSave(client, env.DB, itemId, BOOK)).rejects.toThrow(RangeError);
  });
});

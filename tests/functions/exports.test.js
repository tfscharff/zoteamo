import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { onRequestGet as editPage } from '../../functions/e/[token]/index.js';
import { onRequestGet as exportFile } from '../../functions/l/[token]/[file].js';
import { call, createTestList, seedItem } from './helpers.js';

// .text() warns on non-text content types in workerd; decode the bytes instead.
const text = async (res) => new TextDecoder().decode(await res.arrayBuffer());
const get = (token, file, query = '') => call(exportFile, { path: `/l/${token}/${file}${query}`, params: { token, file } });

async function setup() {
  const list = await createTestList({ title: 'Autumn reads', defaultStyle: 'apa' });
  await seedItem(list.id, { title: 'Second', createdAt: '2026-01-01T00:00:00.000Z' });
  await seedItem(list.id, { title: 'First', status: 'up_next', meetingDate: '2026-10-20' });
  const failed = await seedItem(list.id, { title: 'Broken', ready: false });
  await env.DB.prepare(`UPDATE items SET citation_state = 'failed' WHERE id = ?`).bind(failed).run();
  return list;
}

describe('exports', () => {
  it('serves BibTeX in page order as a download', async () => {
    const { viewToken } = await setup();
    const res = await get(viewToken, 'export.bib');
    expect(res.headers.get('content-type')).toBe('application/x-bibtex; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="autumn-reads.bib"');
    const body = await text(res);
    expect(body.indexOf('title = {First}')).toBeLessThan(body.indexOf('title = {Second}'));
    expect(body).not.toContain('Broken');
  });

  it('accepts the edit token too', async () => {
    const { editToken } = await setup();
    expect(await text(await get(editToken, 'export.ris'))).toContain('TI  - First');
  });

  it('serves plain text in the requested style', async () => {
    const { viewToken } = await setup();
    expect(await (await get(viewToken, 'export.txt', '?style=mla')).text()).toBe('Doe, Jane. First. 2020.\n\nDoe, Jane. Second. 2020.\n');
    expect(await (await get(viewToken, 'export.txt')).text()).toContain('Doe, J. (2020). First.');
  });

  it.each([['export.pdf'], ['index.html']])('returns 404 for %s', async (file) => {
    const { viewToken } = await setup();
    expect((await get(viewToken, file)).status).toBe(404);
  });

  it('returns 404 for an unknown token', async () => {
    expect((await get('AAAAAAAAAAAAAAAAAAAAAA', 'export.bib')).status).toBe(404);
  });

  it('links exports with the view token on the edit page', async () => {
    const { editToken, viewToken } = await setup();
    const page = await (await call(editPage, { path: `/e/${editToken}?style=chicago`, params: { token: editToken } })).text();
    expect(page).toContain(`href="/l/${viewToken}/export.bib"`);
    expect(page).toContain(`href="/l/${viewToken}/export.txt?style=chicago" data-copy-all`);
  });
});

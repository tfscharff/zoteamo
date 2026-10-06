import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { onRequestGet as editPage } from '../../functions/e/[token]/index.js';
import { onRequestGet as viewPage } from '../../functions/l/[token]/index.js';
import { call, createTestList, seedItem } from './helpers.js';

const view = async (viewToken, query = '', cookie) =>
  call(viewPage, { path: `/l/${viewToken}${query}`, params: { token: viewToken }, cookie });

describe('list page items', () => {
  it('groups and orders items like the spec says', async () => {
    const { id, viewToken } = await createTestList();
    await seedItem(id, { title: 'Old idea', createdAt: '2026-01-01T00:00:00.000Z' });
    const popular = await seedItem(id, { title: 'Popular idea' });
    await seedItem(id, { title: 'Later meeting', status: 'up_next', meetingDate: '2026-11-01' });
    await seedItem(id, { title: 'Next meeting', status: 'up_next', meetingDate: '2026-10-20' });
    await seedItem(id, { title: 'Done already', status: 'discussed', meetingDate: '2026-09-01' });
    for (const voter of ['v1', 'v2']) {
      await env.DB.prepare('INSERT INTO votes (item_id, voter_id, created_at) VALUES (?, ?, ?)').bind(popular, voter, '2026-10-01').run();
    }
    const page = await (await view(viewToken)).text();
    const order = ['Next meeting', 'Later meeting', 'Popular idea', 'Old idea', 'Done already'].map((t) => page.indexOf(`>${t}</h3>`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(page).toContain('Up next <span class="count">(2)</span>');
    expect(page).toMatch(/<dt>Votes<\/dt><dd>2<\/dd>/);
    expect(page).toContain('meeting 20 October 2026');
  });

  it('shows the group default style, then ?style, then the remembered cookie', async () => {
    const { id, viewToken } = await createTestList({ defaultStyle: 'chicago' });
    await seedItem(id, { title: 'Styled' });
    expect(await (await view(viewToken)).text()).toContain('Chicago, 2020.');
    const mla = await view(viewToken, '?style=mla');
    expect(await mla.text()).toContain('Doe, Jane. <i>Styled</i>. 2020.');
    expect(mla.headers.getSetCookie().join()).toContain('zoteamo_style=mla');
    expect(await (await view(viewToken, '', 'zoteamo_style=apa')).text()).toContain('Doe, J. (2020). <i>Styled</i>.');
  });

  it('escapes titles, notes and copy text but keeps sanitized citation HTML and COinS', async () => {
    const { id, viewToken } = await createTestList();
    await seedItem(id, { title: '<script>alert(1)</script>', note: '<img src=x>' });
    await seedItem(id, { title: '"Quoted" & Co' });
    const page = await (await view(viewToken)).text();
    expect(page).not.toContain('<script>alert(1)');
    expect(page).toContain('&lt;script&gt;alert(1)&lt;/script&gt;</h3>');
    expect(page).toContain('&lt;img src=x&gt;');
    expect(page).toContain('data-copy-text="Doe, J. (2020). &quot;Quoted&quot; &amp; Co."');
    expect(page).toContain('<i>&quot;Quoted&quot; &amp; Co</i>');
    expect(page).toContain('<span class="Z3988" title="ctx_ver=Z39.88-2004&amp;rft.btitle=Book"></span>');
  });

  it('explains pending and failed citations', async () => {
    const { id, viewToken } = await createTestList();
    await seedItem(id, { title: 'Waiting', ready: false });
    const failed = await seedItem(id, { title: 'Broken', ready: false });
    await env.DB.prepare(`UPDATE items SET citation_state = 'failed', citation_error = 'No details found.' WHERE id = ?`).bind(failed).run();
    const page = await (await view(viewToken)).text();
    expect(page).toContain('The citation isn’t ready yet.');
    expect(page).toContain('Couldn’t get citation details: No details found.');
  });

  it('sets a voter cookie on the edit page only', async () => {
    const { editToken, viewToken } = await createTestList();
    const edit = await call(editPage, { path: `/e/${editToken}`, params: { token: editToken } });
    expect(edit.headers.getSetCookie().join()).toMatch(/zoteamo_voter=[0-9a-f-]{36};/);
    expect((await view(viewToken)).headers.getSetCookie().join()).not.toContain('zoteamo_voter');
  });

  it('announces a newly added item', async () => {
    const { id, editToken } = await createTestList();
    const itemId = await seedItem(id, { title: 'Fresh' });
    const res = await call(editPage, { path: `/e/${editToken}?added=${itemId}`, params: { token: editToken } });
    expect(await res.text()).toContain('<p class="status-message" role="status">Added: Fresh</p>');
  });
});

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { onRequestPost as createListRoute } from '../../functions/api/lists.js';
import { onRequestGet as editPage } from '../../functions/e/[token]/index.js';
import { onRequestGet as viewPage } from '../../functions/l/[token]/index.js';
import { hashToken } from '../../functions/_lib/tokens.js';
import { call, createTestList, location, ORIGIN } from './helpers.js';

describe('create a list', () => {
  it('stores the list with a hashed edit token and redirects to the edit link', async () => {
    const res = await call(createListRoute, {
      method: 'POST', path: '/api/lists', form: { title: 'Autumn reads', description: 'Fiction', default_style: 'mla' },
    });
    expect(res.status).toBe(303);
    const token = location(res).match(/^\/e\/([A-Za-z0-9_-]{22})\?created=1$/)[1];
    const list = await env.DB.prepare('SELECT * FROM lists WHERE edit_token_hash = ?').bind(await hashToken(token)).first();
    expect(list).toMatchObject({ title: 'Autumn reads', description: 'Fiction', default_style: 'mla' });
    expect(list.view_token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const raw = await env.DB.prepare('SELECT COUNT(*) AS n FROM lists WHERE edit_token_hash = ?').bind(token).first();
    expect(raw.n).toBe(0);
  });

  it('re-shows the form with linked errors when the name is missing', async () => {
    const res = await call(createListRoute, {
      method: 'POST', path: '/api/lists', form: { title: '', description: '<b>x</b>', default_style: 'apa' },
    });
    expect(res.status).toBe(422);
    const page = await res.text();
    expect(page).toContain('<title>Error: Create a reading list – zoteamo</title>');
    expect(page).toContain('There’s a problem');
    expect(page).toContain('<a href="#title">Enter a name for the list.</a>');
    expect(page).toContain('aria-invalid="true"');
    expect(page).toContain('&lt;b&gt;x&lt;/b&gt;</textarea>');
  });
});

describe('list pages', () => {
  it('shows both links and the warning after creation', async () => {
    const { editToken, viewToken } = await createTestList();
    const res = await call(editPage, { path: `/e/${editToken}?created=1`, params: { token: editToken } });
    expect(res.status).toBe(200);
    const page = await res.text();
    expect(page).toContain(`value="${ORIGIN}/e/${editToken}"`);
    expect(page).toContain(`value="${ORIGIN}/l/${viewToken}"`);
    expect(page).toContain('Anyone with the edit link can change this list. Keep it within the group.');
    expect(page).toContain('<details class="links-panel" open>');
    expect(page).toContain('<meta name="robots" content="noindex">');
  });

  it('never puts the edit link on the view page', async () => {
    const { editToken, viewToken } = await createTestList({ title: 'Shared' });
    const res = await call(viewPage, { path: `/l/${viewToken}`, params: { token: viewToken } });
    expect(res.status).toBe(200);
    const page = await res.text();
    expect(page).toContain('<h1>Shared</h1>');
    expect(page).toContain('read-only');
    expect(page).not.toContain(editToken);
    expect(page).not.toContain(await hashToken(editToken));
    expect(page).not.toContain('/e/');
  });

  it('escapes the list title', async () => {
    const { viewToken } = await createTestList({ title: '<script>x</script>' });
    const page = await (await call(viewPage, { path: `/l/${viewToken}`, params: { token: viewToken } })).text();
    expect(page).toContain('<h1>&lt;script&gt;x&lt;/script&gt;</h1>');
  });

  it.each([
    ['unknown edit token', 'e', 'AAAAAAAAAAAAAAAAAAAAAA'],
    ['malformed edit token', 'e', 'short'],
    ['unknown view token', 'l', 'AAAAAAAAAAAAAAAAAAAAAA'],
  ])('returns 404 for an %s', async (_name, prefix, token) => {
    const handler = prefix === 'e' ? editPage : viewPage;
    const res = await call(handler, { path: `/${prefix}/${token}`, params: { token } });
    expect(res.status).toBe(404);
  });

  it('does not accept an edit token on the view route', async () => {
    const { editToken } = await createTestList();
    const res = await call(viewPage, { path: `/l/${editToken}`, params: { token: editToken } });
    expect(res.status).toBe(404);
  });
});

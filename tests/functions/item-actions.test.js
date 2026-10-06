import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { onRequestGet as editPage } from '../../functions/e/[token]/index.js';
import { onRequestGet as confirmDelete, onRequestPost as deleteRoute } from '../../functions/e/[token]/items/[id]/delete.js';
import { onRequestPost as statusRoute } from '../../functions/e/[token]/items/[id]/status.js';
import { onRequestPost as voteRoute } from '../../functions/e/[token]/items/[id]/vote.js';
import { onRequestPost as rotateRoute } from '../../functions/e/[token]/rotate-edit-link.js';
import { onRequestPost as settingsRoute } from '../../functions/e/[token]/settings.js';
import { call, createTestList, location, seedItem } from './helpers.js';

const VOTER = 'zoteamo_voter=6f1c2a8e-1b2c-4d5e-8f90-123456789abc';
const row = (id) => env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
const votes = async (id) => (await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE item_id = ?').bind(id).first()).n;
const post = (handler, token, path, { id, form = {}, cookie } = {}) =>
  call(handler, { method: 'POST', path: `/e/${token}${path}`, params: { token, id }, form, cookie });

async function setup() {
  const list = await createTestList();
  const itemId = await seedItem(list.id, { title: 'A Book' });
  return { ...list, itemId };
}

describe('votes', () => {
  it('toggles this browser’s vote', async () => {
    const { editToken, itemId } = await setup();
    const first = await post(voteRoute, editToken, `/items/${itemId}/vote`, { id: itemId, cookie: VOTER });
    expect(location(first)).toBe(`/e/${editToken}#item-${itemId}`);
    expect(await votes(itemId)).toBe(1);
    await post(voteRoute, editToken, `/items/${itemId}/vote`, { id: itemId, cookie: VOTER });
    expect(await votes(itemId)).toBe(0);
  });

  it('gives a new voter a cookie', async () => {
    const { editToken, itemId } = await setup();
    const res = await post(voteRoute, editToken, `/items/${itemId}/vote`, { id: itemId });
    expect(res.headers.getSetCookie().join()).toMatch(/zoteamo_voter=[0-9a-f-]{36};/);
  });

  it('names vote and status controls after the item', async () => {
    const { editToken } = await setup();
    const page = await (await call(editPage, { path: `/e/${editToken}`, params: { token: editToken }, cookie: VOTER })).text();
    expect(page).toContain('Vote<span class="visually-hidden"> for A Book</span>');
    expect(page).toContain('Change status<span class="visually-hidden"> of A Book</span>');
    expect(page).toContain('Delete<span class="visually-hidden"> A Book</span>');
  });
});

describe('status', () => {
  it('saves status, meeting date and note', async () => {
    const { editToken, itemId } = await setup();
    const res = await post(statusRoute, editToken, `/items/${itemId}/status`, {
      id: itemId, form: { status: 'up_next', meeting_date: '2026-11-05', note: 'Chapters 1–3' },
    });
    expect(location(res)).toBe(`/e/${editToken}?updated=${itemId}#item-${itemId}`);
    expect(await row(itemId)).toMatchObject({ status: 'up_next', meeting_date: '2026-11-05', note: 'Chapters 1–3' });
  });

  it('clears the meeting date when left empty', async () => {
    const { editToken, itemId } = await setup();
    await post(statusRoute, editToken, `/items/${itemId}/status`, { id: itemId, form: { status: 'discussed', meeting_date: '', note: '' } });
    expect((await row(itemId)).meeting_date).toBeNull();
  });

  it('re-shows the form with linked errors for a bad date', async () => {
    const { editToken, itemId } = await setup();
    const res = await post(statusRoute, editToken, `/items/${itemId}/status`, { id: itemId, form: { status: 'up_next', meeting_date: '2026-02-30', note: '' } });
    expect(res.status).toBe(422);
    expect(await res.text()).toContain(`<a href="#item-${itemId}-meeting_date">`);
    expect((await row(itemId)).status).toBe('suggested');
  });
});

describe('delete', () => {
  it('asks first, then deletes the item and its votes', async () => {
    const { editToken, itemId } = await setup();
    await post(voteRoute, editToken, `/items/${itemId}/vote`, { id: itemId, cookie: VOTER });
    const confirm = await call(confirmDelete, { path: `/e/${editToken}/items/${itemId}/delete`, params: { token: editToken, id: itemId } });
    const page = await confirm.text();
    expect(page).toContain('<h1>Delete “A Book”?</h1>');
    expect(page).toContain(`action="/e/${editToken}/items/${itemId}/delete"`);
    const res = await post(deleteRoute, editToken, `/items/${itemId}/delete`, { id: itemId });
    expect(location(res)).toBe(`/e/${editToken}?deleted=1`);
    expect(await row(itemId)).toBeNull();
    expect(await votes(itemId)).toBe(0);
  });
});

describe('items from another list', () => {
  it('are never reachable through this list’s edit link', async () => {
    const other = await setup();
    const { editToken } = await createTestList();
    const id = other.itemId;
    const attempts = [
      post(voteRoute, editToken, `/items/${id}/vote`, { id, cookie: VOTER }),
      post(statusRoute, editToken, `/items/${id}/status`, { id, form: { status: 'discussed', meeting_date: '', note: 'x' } }),
      post(deleteRoute, editToken, `/items/${id}/delete`, { id }),
      call(confirmDelete, { path: `/e/${editToken}/items/${id}/delete`, params: { token: editToken, id } }),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(404);
    expect(await row(id)).toMatchObject({ status: 'suggested', note: '' });
    expect(await votes(id)).toBe(0);
  });
});

describe('list settings and edit link', () => {
  it('saves settings', async () => {
    const { id, editToken } = await createTestList();
    const res = await post(settingsRoute, editToken, '/settings', { form: { title: 'Renamed', description: 'New', default_style: 'chicago' } });
    expect(location(res)).toBe(`/e/${editToken}?saved=settings`);
    expect(await env.DB.prepare('SELECT title, description, default_style FROM lists WHERE id = ?').bind(id).first())
      .toEqual({ title: 'Renamed', description: 'New', default_style: 'chicago' });
  });

  it('re-shows settings with linked errors, panel open', async () => {
    const { editToken } = await createTestList();
    const res = await post(settingsRoute, editToken, '/settings', { form: { title: '', description: '', default_style: 'apa' } });
    expect(res.status).toBe(422);
    const page = await res.text();
    expect(page).toContain('<details class="links-panel" open>');
    expect(page).toContain('<a href="#list-title">Enter a name for the list.</a>');
  });

  it('replaces the edit link and retires the old one', async () => {
    const { editToken } = await createTestList();
    const res = await post(rotateRoute, editToken, '/rotate-edit-link');
    const [, fresh] = location(res).match(/^\/e\/([A-Za-z0-9_-]{22})\?rotated=1$/);
    expect(fresh).not.toBe(editToken);
    expect((await call(editPage, { path: `/e/${editToken}`, params: { token: editToken } })).status).toBe(404);
    const page = await (await call(editPage, { path: `/e/${fresh}?rotated=1`, params: { token: fresh } })).text();
    expect(page).toContain('Here’s the new edit link. The old one no longer works');
  });
});

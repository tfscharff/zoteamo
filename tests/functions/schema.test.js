import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const now = '2026-10-06T00:00:00.000Z';
const insertList = (id, style = 'apa') =>
  env.DB.prepare(
    `INSERT INTO lists (id, title, default_style, view_token, edit_token_hash, created_at, updated_at)
     VALUES (?, 'T', ?, ?, ?, ?, ?)`,
  ).bind(id, style, `v-${id}`, `h-${id}`, now, now).run();

describe('D1 schema', () => {
  it('creates the four tables', async () => {
    const { results } = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name IN ('lists','items','votes','lookup_cache') ORDER BY name`,
    ).all();
    expect(results.map((r) => r.name)).toEqual(['items', 'lists', 'lookup_cache', 'votes']);
  });

  it('rejects an unknown citation style', async () => {
    await expect(insertList('bad', 'harvard')).rejects.toThrow(/CHECK/);
  });

  it('deletes items when their list is deleted', async () => {
    await insertList('l1');
    await env.DB.prepare(
      `INSERT INTO items (id, list_id, input, input_kind, citation_state, created_at, updated_at)
       VALUES ('i1', 'l1', 'x', 'url', 'pending', ?, ?)`,
    ).bind(now, now).run();
    await env.DB.prepare(`DELETE FROM lists WHERE id = 'l1'`).run();
    const row = await env.DB.prepare(`SELECT id FROM items WHERE id = 'i1'`).first();
    expect(row).toBeNull();
  });
});

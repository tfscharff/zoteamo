// D1 queries for lists. Edit tokens are looked up by hash and compared in constant time.
import { hashToken, newToken, safeEqual, TOKEN_PATTERN } from '../tokens.js';

const NOW = () => new Date().toISOString();

export async function createList(db, { title, description = '', defaultStyle = 'apa' }, now = NOW()) {
  const id = crypto.randomUUID();
  const viewToken = newToken();
  const editToken = newToken();
  await db.prepare(
    `INSERT INTO lists (id, title, description, default_style, view_token, edit_token_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, title, description, defaultStyle, viewToken, await hashToken(editToken), now, now).run();
  return { id, viewToken, editToken };
}

export async function findListByEditToken(db, token) {
  if (!TOKEN_PATTERN.test(token ?? '')) return null;
  const hash = await hashToken(token);
  const row = await db.prepare('SELECT * FROM lists WHERE edit_token_hash = ?').bind(hash).first();
  return row && safeEqual(row.edit_token_hash, hash) ? row : null;
}

export async function findListByViewToken(db, token) {
  if (!TOKEN_PATTERN.test(token ?? '')) return null;
  return db.prepare('SELECT * FROM lists WHERE view_token = ?').bind(token).first();
}

export async function findListByAnyToken(db, token) {
  return (await findListByViewToken(db, token)) ?? (await findListByEditToken(db, token));
}

export async function updateListSettings(db, listId, { title, description, defaultStyle }, now = NOW()) {
  await db.prepare('UPDATE lists SET title = ?, description = ?, default_style = ?, updated_at = ? WHERE id = ?')
    .bind(title, description, defaultStyle, now, listId).run();
}

export async function rotateEditToken(db, listId, now = NOW()) {
  const editToken = newToken();
  await db.prepare('UPDATE lists SET edit_token_hash = ?, updated_at = ? WHERE id = ?')
    .bind(await hashToken(editToken), now, listId).run();
  return editToken;
}

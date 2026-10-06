// lookup_cache: avoids repeat translation-server calls. Entries older than 30 days count as missing.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function getCached(db, key, now = new Date()) {
  const row = await db.prepare('SELECT zotero_json, fetched_at FROM lookup_cache WHERE key = ?').bind(key).first();
  if (!row || now.getTime() - new Date(row.fetched_at).getTime() > MAX_AGE_MS) return null;
  return JSON.parse(row.zotero_json);
}

export async function putCached(db, key, item, now = new Date()) {
  await db.prepare(
    `INSERT INTO lookup_cache (key, zotero_json, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET zotero_json = excluded.zotero_json, fetched_at = excluded.fetched_at`,
  ).bind(key, JSON.stringify(item), now.toISOString()).run();
}

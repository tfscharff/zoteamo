// D1 queries for items. Every lookup by item ID is scoped to its list.
const NOW = () => new Date().toISOString();

const PAGE_COLUMNS = `items.id, items.title, items.input, items.input_kind, items.citation_state, items.citation_error,
  items.cite_apa, items.cite_mla, items.cite_chicago, items.text_apa, items.text_mla, items.text_chicago, items.coins,
  items.added_by, items.note, items.status, items.meeting_date, items.created_at, items.updated_at`;

export async function insertItem(db, { listId, input, inputKind, addedBy = '', note = '' }, now = NOW()) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO items (id, list_id, input, input_kind, title, citation_state, added_by, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', 'pending', ?, ?, ?, ?)`,
  ).bind(id, listId, input, inputKind, addedBy, note, now, now).run();
  return id;
}

export function getItem(db, listId, itemId) {
  return db.prepare('SELECT * FROM items WHERE id = ? AND list_id = ?').bind(itemId, listId).first();
}

export async function listItems(db, listId, voterId = '') {
  const { results } = await db.prepare(
    `SELECT ${PAGE_COLUMNS},
       (SELECT COUNT(*) FROM votes WHERE votes.item_id = items.id) AS votes,
       EXISTS (SELECT 1 FROM votes WHERE votes.item_id = items.id AND votes.voter_id = ?) AS voted
     FROM items WHERE items.list_id = ?`,
  ).bind(voterId, listId).all();
  return results;
}

export async function saveCitation(db, itemId, d, now = NOW()) {
  await db.prepare(
    `UPDATE items SET zotero_json = ?, csl_json = ?, title = COALESCE(NULLIF(?, ''), title),
       cite_apa = ?, cite_mla = ?, cite_chicago = ?, text_apa = ?, text_mla = ?, text_chicago = ?,
       bibtex = ?, ris = ?, coins = ?, citation_state = 'ready', citation_error = NULL, updated_at = ?
     WHERE id = ?`,
  ).bind(
    d.zoteroJson, d.cslJson, d.title, d.cite.apa, d.cite.mla, d.cite.chicago,
    d.text.apa, d.text.mla, d.text.chicago, d.bibtex, d.ris, d.coins, now, itemId,
  ).run();
}

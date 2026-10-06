// GET: confirm deleting an item. POST: delete it.
import { deleteItem } from '../../../../_lib/db/items.js';
import { redirect } from '../../../../_lib/http.js';
import { loadEditItem } from '../../../../_lib/item-context.js';
import { confirmDeletePage } from '../../../../_lib/views/confirm-delete.js';
import { itemTitle } from '../../../../_lib/views/item.js';
import { renderPage } from '../../../../_lib/views/layout.js';

export async function onRequestGet(context) {
  const { item, base, response } = await loadEditItem(context);
  if (response) return response;
  const title = itemTitle(item);
  return renderPage({ title: `Delete ${title}`, body: confirmDeletePage({ base, item, title }) });
}

export async function onRequestPost(context) {
  const { list, item, base, response } = await loadEditItem(context);
  if (response) return response;
  await deleteItem(context.env.DB, list.id, item.id);
  return redirect(`${base}?deleted=1`);
}

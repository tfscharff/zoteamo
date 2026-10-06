// Loads the list for an edit link and, for item routes, one of its items. Anything else is a 404.
import { getItem } from './db/items.js';
import { findListByEditToken } from './db/lists.js';
import { notFoundPage } from './views/layout.js';

export async function loadEditList({ env, params }) {
  const list = await findListByEditToken(env.DB, params.token);
  return list ? { list, base: `/e/${params.token}` } : { response: notFoundPage() };
}

export async function loadEditItem(context) {
  const found = await loadEditList(context);
  if (found.response) return found;
  const item = await getItem(context.env.DB, found.list.id, context.params.id);
  return item ? { ...found, item } : { response: notFoundPage() };
}

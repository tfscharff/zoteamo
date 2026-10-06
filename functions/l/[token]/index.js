// GET /l/{viewToken}: the read-only list.
import { findListByViewToken } from '../../_lib/db/lists.js';
import { renderList } from '../../_lib/list-view.js';
import { notFoundPage } from '../../_lib/views/layout.js';

export async function onRequestGet(context) {
  const list = await findListByViewToken(context.env.DB, context.params.token);
  if (!list) return notFoundPage();
  return renderList(context, list, { canEdit: false, token: context.params.token });
}

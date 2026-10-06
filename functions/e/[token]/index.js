// GET /e/{editToken}: the list with editing controls.
import { findListByEditToken } from '../../_lib/db/lists.js';
import { renderList } from '../../_lib/list-view.js';
import { notFoundPage } from '../../_lib/views/layout.js';

export async function onRequestGet(context) {
  const list = await findListByEditToken(context.env.DB, context.params.token);
  if (!list) return notFoundPage();
  return renderList(context, list, { canEdit: true, token: context.params.token });
}

// POST /e/{t}/rotate-edit-link: issue a new edit token. The old one stops working immediately.
import { rotateEditToken } from '../../_lib/db/lists.js';
import { redirect } from '../../_lib/http.js';
import { loadEditList } from '../../_lib/item-context.js';

export async function onRequestPost(context) {
  const { list, response } = await loadEditList(context);
  if (response) return response;
  const editToken = await rotateEditToken(context.env.DB, list.id);
  return redirect(`/e/${editToken}?rotated=1`);
}

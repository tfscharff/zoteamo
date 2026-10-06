// POST /e/{t}/items/{id}/vote: toggle this browser's vote.
import { toggleVote } from '../../../../_lib/db/items.js';
import { parseCookies, redirect } from '../../../../_lib/http.js';
import { loadEditItem } from '../../../../_lib/item-context.js';
import { ensureVoter } from '../../../../_lib/style.js';

export async function onRequestPost(context) {
  const { item, base, response } = await loadEditItem(context);
  if (response) return response;
  const { voterId, cookie } = ensureVoter(parseCookies(context.request));
  await toggleVote(context.env.DB, item.id, voterId);
  return redirect(`${base}#item-${item.id}`, { cookies: cookie ? [cookie] : [] });
}

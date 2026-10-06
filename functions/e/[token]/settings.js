// POST /e/{t}/settings: list name, description and default style.
import { updateListSettings } from '../../_lib/db/lists.js';
import { readForm, redirect } from '../../_lib/http.js';
import { loadEditList } from '../../_lib/item-context.js';
import { renderList } from '../../_lib/list-view.js';
import { validateListSettings } from '../../_lib/validate.js';

export async function onRequestPost(context) {
  const { list, base, response } = await loadEditList(context);
  if (response) return response;
  const { values, errors } = validateListSettings(await readForm(context.request));
  if (errors.length) {
    return renderList(context, list, { canEdit: true, token: context.params.token, status: 422, forms: { settings: { values, errors } } });
  }
  await updateListSettings(context.env.DB, list.id, values);
  return redirect(`${base}?saved=settings`);
}

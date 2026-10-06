// GET/POST /e/{t}/items/{id}/edit: edit an item's citation details by hand, then re-derive every format.
import { deriveAndSave } from '../../../../_lib/enrich.js';
import { formForItem, parseZoteroJson, readEditForm, validateEditForm, zoteroFromForm } from '../../../../_lib/fields.js';
import { readForm, redirect } from '../../../../_lib/http.js';
import { loadEditItem } from '../../../../_lib/item-context.js';
import { createLambdaClient } from '../../../../_lib/lambda.js';
import { editItemPage } from '../../../../_lib/views/edit-item.js';
import { itemTitle } from '../../../../_lib/views/item.js';
import { renderPage } from '../../../../_lib/views/layout.js';

export async function onRequestGet(context) {
  const { item, base, response } = await loadEditItem(context);
  if (response) return response;
  const lookupFailed = new URL(context.request.url).searchParams.get('lookup') === 'failed';
  const body = editItemPage({ base, item, values: formForItem(item), lookupFailed });
  return renderPage({ title: `Edit citation: ${itemTitle(item)}`, body });
}

export async function onRequestPost(context) {
  const { item, base, response } = await loadEditItem(context);
  if (response) return response;
  const previous = parseZoteroJson(item);
  const values = readEditForm(await readForm(context.request));
  const errors = validateEditForm(values, previous);
  if (errors.length) {
    const body = editItemPage({ base, item, values, errors, previous });
    return renderPage({ title: `Error: Edit citation: ${itemTitle(item)}`, body, status: 422 });
  }
  await deriveAndSave(createLambdaClient(context.env), context.env.DB, item.id, zoteroFromForm(values, previous));
  return redirect(`${base}?updated=${item.id}#item-${item.id}`);
}

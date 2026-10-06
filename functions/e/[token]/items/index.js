// POST /e/{t}/items: add an item from a link or identifier, or start one to fill in by hand.
import { runLookup } from '../../../_lib/add-flow.js';
import { insertItem } from '../../../_lib/db/items.js';
import { detect, InputError } from '../../../_lib/detect.js';
import { readForm, redirect, setCookie } from '../../../_lib/http.js';
import { loadEditList } from '../../../_lib/item-context.js';
import { renderList } from '../../../_lib/list-view.js';
import { isRateLimited, RATE_LIMIT_MESSAGE } from '../../../_lib/rate-limit.js';
import { validateAddItem } from '../../../_lib/validate.js';

export async function onRequestPost(context) {
  const { list, base, response } = await loadEditList(context);
  if (response) return response;
  const { env, params } = context;
  const form = await readForm(context.request);
  const manual = form.get('manual') === '1';
  const { values, errors } = validateAddItem(form);
  let detected = null;
  if (!manual && !errors.length) {
    try {
      detected = detect(values.input);
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      errors.push({ field: 'input', message: error.message });
    }
  }
  const showForm = (status, formErrors) =>
    renderList(context, list, { canEdit: true, token: params.token, status, forms: { add: { values, errors: formErrors } } });
  if (errors.length) return showForm(422, errors);
  if (await isRateLimited(env.DB, list.id)) return showForm(429, [{ field: 'input', message: RATE_LIMIT_MESSAGE }]);

  const cookies = values.addedBy ? [setCookie('zoteamo_name', values.addedBy)] : [];
  const itemId = await insertItem(env.DB, {
    listId: list.id,
    input: manual ? '' : values.input,
    inputKind: manual ? 'manual' : detected.kind,
    addedBy: values.addedBy,
    note: manual ? '' : values.note,
  });
  if (manual) return redirect(`${base}/items/${itemId}/edit`, { cookies });
  return runLookup({ env, base, itemId, detected, cookies });
}

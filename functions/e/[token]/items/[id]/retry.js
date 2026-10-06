// POST /e/{t}/items/{id}/retry: re-derive formats from stored metadata, or repeat the lookup if there is none.
import { runLookup } from '../../../../_lib/add-flow.js';
import { detect, InputError } from '../../../../_lib/detect.js';
import { deriveAndSave } from '../../../../_lib/enrich.js';
import { parseZoteroJson } from '../../../../_lib/fields.js';
import { redirect } from '../../../../_lib/http.js';
import { loadEditItem } from '../../../../_lib/item-context.js';
import { createLambdaClient } from '../../../../_lib/lambda.js';

export async function onRequestPost(context) {
  const { item, base, response } = await loadEditItem(context);
  if (response) return response;
  const { env } = context;
  if (item.zotero_json) {
    await deriveAndSave(createLambdaClient(env), env.DB, item.id, parseZoteroJson(item));
    return redirect(`${base}?updated=${item.id}#item-${item.id}`);
  }
  let detected;
  try {
    detected = detect(item.input);
  } catch (error) {
    if (!(error instanceof InputError)) throw error;
    return redirect(`${base}/items/${item.id}/edit`);
  }
  return runLookup({ env, base, itemId: item.id, detected });
}

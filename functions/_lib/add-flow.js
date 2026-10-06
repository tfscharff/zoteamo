// Turns a detected input into a stored citation: look it up, maybe ask which item, then derive and save.
import { deleteItem, markFailed } from './db/items.js';
import { deriveAndSave, lookup, lookupChoice, LookupError } from './enrich.js';
import { redirect } from './http.js';
import { createLambdaClient, LambdaError } from './lambda.js';
import { renderPage } from './views/layout.js';
import { selectPage } from './views/select.js';

const isExpected = (error) => error instanceof LookupError || error instanceof LambdaError;
const addedUrl = (base, itemId) => `${base}?added=${itemId}#item-${itemId}`;

export async function runLookup({ env, base, itemId, detected, cookies = [] }) {
  const client = createLambdaClient(env);
  let result;
  try {
    result = await lookup(client, env.DB, detected);
  } catch (error) {
    if (!isExpected(error)) throw error;
    await markFailed(env.DB, itemId, error.message);
    return redirect(`${base}/items/${itemId}/edit?lookup=failed`, { cookies });
  }
  if (result.kind === 'choose') {
    return renderPage({ title: 'Which item did you mean?', body: selectPage({ base, itemId, ...result }), cookies });
  }
  await deriveAndSave(client, env.DB, itemId, result.item);
  return redirect(addedUrl(base, itemId), { cookies });
}

export async function runChoice({ env, base, list, itemId, url, session, choices, key }) {
  const client = createLambdaClient(env);
  try {
    if (!url) throw new LookupError('That choice is no longer available.');
    const item = await lookupChoice(client, { url, session, choices, key });
    await deriveAndSave(client, env.DB, itemId, item);
    return redirect(addedUrl(base, itemId));
  } catch (error) {
    if (!isExpected(error)) throw error;
    await deleteItem(env.DB, list.id, itemId);
    return redirect(`${base}?error=choice_expired`);
  }
}

// The add/edit pipeline (spec §4): look up metadata, then derive and store every citation format.
// translation-server exports run one after another (reserved concurrency 2) while the formatter runs alongside.
import { getCached, putCached } from './db/cache.js';
import { saveCitation, saveZoteroJson, setCitationError } from './db/items.js';
import { cacheKey } from './detect.js';
import { LambdaError } from './lambda.js';
import { sanitizeCitation, sanitizeCoins } from './sanitize.js';
import { STYLES } from './validate.js';

export class LookupError extends Error {}

const STATUS_MESSAGES = {
  400: 'That link couldn’t be read.',
  404: 'Nothing was found for that identifier.',
  501: 'No citation details could be found there.',
};

const isCitable = (item) => item && typeof item === 'object' && item.itemType && !['note', 'attachment'].includes(item.itemType);

// Reads a response body as JSON. A stream that fails mid-read is a service failure (LambdaError);
// a body that isn't valid JSON is just "no data" (null).
async function readJson(res) {
  let text;
  try {
    text = await res.text();
  } catch {
    throw new LambdaError('The lookup service couldn’t be reached.');
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function firstItem(res) {
  if (res.status !== 200) {
    throw new LookupError(STATUS_MESSAGES[res.status] ?? `The lookup service returned an error (${res.status}).`);
  }
  const items = await readJson(res);
  const item = Array.isArray(items) ? items.find(isCitable) : null;
  if (!item) throw new LookupError(STATUS_MESSAGES[501]);
  const { attachments, notes, ...clean } = item;
  return clean;
}

export async function lookup(client, db, detected) {
  const key = cacheKey(detected);
  const cached = await getCached(db, key);
  if (cached) return { kind: 'item', item: cached };
  const isUrl = detected.kind === 'url';
  const res = await client.translation(isUrl ? '/web' : '/search', detected.value);
  if (res.status === 300) {
    if (!isUrl) throw new LookupError('That identifier matches several items. Try a more specific one.');
    const body = (await readJson(res)) ?? {};
    const choices = body.items && typeof body.items === 'object' && !Array.isArray(body.items) ? body.items : {};
    if (!body.session || !Object.keys(choices).length) throw new LookupError(STATUS_MESSAGES[501]);
    return { kind: 'choose', url: body.url ?? detected.value, session: body.session, choices };
  }
  const item = await firstItem(res);
  await putCached(db, key, item);
  return { kind: 'item', item };
}

export async function lookupChoice(client, { url, session, choices, key }) {
  if (!Object.hasOwn(choices, key)) throw new LookupError('That choice is no longer available.');
  const body = JSON.stringify({ url, session, items: { [key]: choices[key] } });
  const res = await client.translation('/web', body, 'application/json');
  if (res.status !== 200) throw new LookupError('That choice expired.');
  return firstItem(res);
}

function parseJson(text, what) {
  try {
    return JSON.parse(text);
  } catch {
    throw new LambdaError(`The ${what} wasn’t valid JSON.`);
  }
}

export async function derive(client, zoteroItem) {
  const items = [zoteroItem];
  const csl = parseJson(await client.exportAs('csljson', items), 'CSL-JSON export');
  const exportsInTurn = async () => ({
    bibtex: await client.exportAs('bibtex', items),
    ris: await client.exportAs('ris', items),
    coins: await client.exportAs('coins', items),
  });
  const [results, exported] = await Promise.all([client.format(csl), exportsInTurn()]);
  const formatted = results[0];
  if (!STYLES.every((s) => typeof formatted?.[s]?.html === 'string' && typeof formatted[s].text === 'string')) {
    throw new LambdaError('The citation formatter sent back an incomplete citation.');
  }
  const perStyle = (fn) => Object.fromEntries(STYLES.map((s) => [s, fn(formatted[s])]));
  return {
    zoteroJson: JSON.stringify(zoteroItem),
    cslJson: JSON.stringify(csl),
    title: String(zoteroItem.title ?? '').trim(),
    cite: perStyle((f) => sanitizeCitation(f.html)),
    text: perStyle((f) => f.text.trim()),
    bibtex: exported.bibtex.trim(),
    ris: exported.ris.trim(),
    coins: sanitizeCoins(exported.coins),
  };
}

export async function deriveAndSave(client, db, itemId, zoteroItem) {
  await saveZoteroJson(db, itemId, zoteroItem);
  try {
    await saveCitation(db, itemId, await derive(client, zoteroItem));
    return { ok: true };
  } catch (error) {
    if (!(error instanceof LambdaError)) throw error;
    await setCitationError(db, itemId, error.message);
    return { ok: false, error: error.message };
  }
}

// Lambda handler for the zoteamo-format Function URL: POST {"items": [CSL-JSON, ...]} -> {"results": [...]}.
import { formatItems } from './format.mjs';

const MAX_ITEMS = 50;
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export async function handler(event) {
  let payload;
  try {
    const raw = event?.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event?.body ?? '');
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: 'The body must be JSON.' });
  }
  const items = payload?.items;
  if (!Array.isArray(items) || items.length > MAX_ITEMS || !items.every(isObject)) {
    return json(400, { error: `"items" must be an array of up to ${MAX_ITEMS} CSL-JSON objects.` });
  }
  try {
    return json(200, { results: formatItems(items) });
  } catch (error) {
    console.error(error);
    return json(500, { error: 'Formatting failed.' });
  }
}

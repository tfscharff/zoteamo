// POST /e/{t}/items/{id}/select: finish adding an item after the member picks one of several.
import { runChoice } from '../../../../_lib/add-flow.js';
import { detect } from '../../../../_lib/detect.js';
import { readForm, redirect } from '../../../../_lib/http.js';
import { loadEditItem } from '../../../../_lib/item-context.js';

function publicUrl(value) {
  try {
    const detected = detect(value);
    return detected.kind === 'url' ? detected.value : null;
  } catch {
    return null;
  }
}

function parseChoices(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function onRequestPost(context) {
  const { list, item, base, response } = await loadEditItem(context);
  if (response) return response;
  if (item.citation_state !== 'pending' || item.zotero_json) return redirect(`${base}#item-${item.id}`);
  const form = await readForm(context.request);
  return runChoice({
    env: context.env, base, list, itemId: item.id,
    url: publicUrl(form.get('url')), session: form.get('session'),
    choices: parseChoices(form.get('choices')), key: form.get('choice'),
  });
}

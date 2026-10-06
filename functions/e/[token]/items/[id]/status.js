// POST /e/{t}/items/{id}/status: status, meeting date and note.
import { updateStatus } from '../../../../_lib/db/items.js';
import { html } from '../../../../_lib/html.js';
import { readForm, redirect } from '../../../../_lib/http.js';
import { loadEditItem } from '../../../../_lib/item-context.js';
import { validateStatus } from '../../../../_lib/validate.js';
import { itemTitle } from '../../../../_lib/views/item.js';
import { statusForm } from '../../../../_lib/views/item-actions.js';
import { renderPage } from '../../../../_lib/views/layout.js';

export async function onRequestPost(context) {
  const { list, item, base, response } = await loadEditItem(context);
  if (response) return response;
  const { values, errors } = validateStatus(await readForm(context.request));
  if (errors.length) {
    const title = itemTitle(item);
    const body = html`<h1>Change status of “${title}”</h1>
${statusForm({ base, item, title, values, errors })}
<p><a href="${base}#item-${item.id}">Back to the list</a></p>`;
    return renderPage({ title: `Error: Change status of ${title}`, body, status: 422 });
  }
  await updateStatus(context.env.DB, list.id, item.id, values);
  return redirect(`${base}?updated=${item.id}#item-${item.id}`);
}

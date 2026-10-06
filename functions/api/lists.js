// POST /api/lists: create a reading list, then go to its edit link.
import { createList } from '../_lib/db/lists.js';
import { readForm, redirect } from '../_lib/http.js';
import { validateListSettings } from '../_lib/validate.js';
import { createListForm } from '../_lib/views/create-list.js';
import { renderPage } from '../_lib/views/layout.js';

export async function onRequestPost({ request, env }) {
  const { values, errors } = validateListSettings(await readForm(request));
  if (errors.length) {
    const body = createListForm({ values, errors });
    return renderPage({ title: 'Error: Create a reading list', body, status: 422, noindex: false });
  }
  const { editToken } = await createList(env.DB, values);
  return redirect(`/e/${editToken}?created=1`);
}

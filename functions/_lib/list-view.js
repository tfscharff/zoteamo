// Renders a list page for the view link (read-only) or the edit link.
import { listItems } from './db/items.js';
import { parseCookies } from './http.js';
import { chooseStyle, ensureVoter } from './style.js';
import { renderPage } from './views/layout.js';
import { listPage } from './views/list-page.js';

export async function renderList({ request, env }, list, { canEdit, token, status = 200, forms = {}, cookies = [] } = {}) {
  const url = new URL(request.url);
  const jar = parseCookies(request);
  const { style, cookie: styleCookie } = chooseStyle(url, jar, list.default_style);
  const { voterId, cookie: voterCookie } = canEdit ? ensureVoter(jar) : { voterId: '', cookie: null };
  const items = await listItems(env.DB, list.id, voterId);
  const body = listPage({ list, items, canEdit, token, origin: url.origin, params: url.searchParams, style, forms });
  return renderPage({ title: list.title, body, status, cookies: [...cookies, styleCookie, voterCookie].filter(Boolean) });
}

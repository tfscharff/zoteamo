// Renders a list page for the view link (read-only) or the edit link.
import { renderPage } from './views/layout.js';
import { listPage } from './views/list-page.js';

export async function renderList({ request }, list, { canEdit, token, status = 200, forms = {}, cookies = [] } = {}) {
  const url = new URL(request.url);
  const body = listPage({
    list, items: [], canEdit, token, origin: url.origin, params: url.searchParams, style: list.default_style, forms,
  });
  return renderPage({ title: list.title, body, status, cookies });
}

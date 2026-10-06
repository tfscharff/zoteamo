// GET /l/{token}/export.bib | export.ris | export.txt: the list as a file, in page order (view or edit token).
import { listExportItems } from '../../_lib/db/items.js';
import { findListByAnyToken } from '../../_lib/db/lists.js';
import { EXPORT_FORMATS, exportFilename } from '../../_lib/exports.js';
import { parseCookies } from '../../_lib/http.js';
import { flattenOrdered, orderItems } from '../../_lib/ordering.js';
import { chooseStyle } from '../../_lib/style.js';
import { notFoundPage } from '../../_lib/views/layout.js';

export async function onRequestGet({ request, env, params }) {
  const format = Object.hasOwn(EXPORT_FORMATS, params.file) ? EXPORT_FORMATS[params.file] : null;
  const list = format ? await findListByAnyToken(env.DB, params.token) : null;
  if (!list) return notFoundPage();
  const { style } = chooseStyle(new URL(request.url), parseCookies(request), list.default_style);
  const items = flattenOrdered(orderItems(await listExportItems(env.DB, list.id)));
  return new Response(format.body(items, style), {
    headers: {
      'content-type': format.contentType,
      'content-disposition': `attachment; filename="${exportFilename(list.title, format.ext)}"`,
    },
  });
}

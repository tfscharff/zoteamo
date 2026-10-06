// Calls a Pages Function handler directly with a realistic context.
import { env } from 'cloudflare:test';
import { createList } from '../../functions/_lib/db/lists.js';
import { insertItem, saveCitation } from '../../functions/_lib/db/items.js';
import { escapeHtml } from '../../functions/_lib/html.js';

export const ORIGIN = 'https://zoteamo.test';

export async function call(handler, { method = 'GET', path = '/', params = {}, form, headers = {}, cookie } = {}) {
  const init = { method, headers: { ...headers } };
  if (form) {
    init.body = new URLSearchParams(form);
    init.headers['content-type'] = 'application/x-www-form-urlencoded';
  }
  if (method === 'POST' && !('origin' in init.headers)) init.headers.origin = ORIGIN;
  if (cookie) init.headers.cookie = cookie;
  const request = new Request(ORIGIN + path, init);
  return handler({ request, env, params, data: {}, waitUntil() {}, next: async () => new Response('next') });
}

export const location = (res) => res.headers.get('location');

export const createTestList = (overrides = {}) =>
  createList(env.DB, { title: 'Test list', description: '', defaultStyle: 'apa', ...overrides });

export function derived(title = 'A Book') {
  const t = escapeHtml(title);
  return {
    zoteroJson: JSON.stringify({ itemType: 'book', title }),
    cslJson: '[]',
    title,
    cite: { apa: `Doe, J. (2020). <i>${t}</i>.`, mla: `Doe, Jane. <i>${t}</i>. 2020.`, chicago: `Doe, Jane. <i>${t}</i>. Chicago, 2020.` },
    text: { apa: `Doe, J. (2020). ${title}.`, mla: `Doe, Jane. ${title}. 2020.`, chicago: `Doe, Jane. ${title}. Chicago, 2020.` },
    bibtex: `@book{doe2020,\n  title = {${title}}\n}`,
    ris: `TY  - BOOK\nTI  - ${title}\nER  - `,
    coins: '<span class="Z3988" title="ctx_ver=Z39.88-2004&amp;rft.btitle=Book"></span>',
  };
}

export async function seedItem(listId, { title = 'A Book', ready = true, status = 'suggested', meetingDate = null, createdAt, addedBy = '', note = '' } = {}) {
  const id = await insertItem(env.DB, { listId, input: `https://example.org/${encodeURIComponent(title)}`, inputKind: 'url', addedBy, note }, createdAt);
  if (ready) await saveCitation(env.DB, id, derived(title));
  await env.DB.prepare('UPDATE items SET status = ?, meeting_date = ? WHERE id = ?').bind(status, meetingDate, id).run();
  return id;
}

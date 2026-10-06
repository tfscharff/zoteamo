// Calls a Pages Function handler directly with a realistic context.
import { env } from 'cloudflare:test';

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

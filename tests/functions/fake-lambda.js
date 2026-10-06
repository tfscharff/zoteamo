// Fakes both Lambda Function URLs by spying on fetch. Override a route ("host path") to simulate failures.
import { vi } from 'vitest';
import { BOOK, CSL_BOOK, EXPORTS, FORMATTED } from '../fixtures/lambda-fixtures.js';

export function fakeLambda(overrides = {}) {
  const calls = [];
  const routes = {
    'translation.test /web': () => Response.json([BOOK]),
    'translation.test /search': () => Response.json([BOOK]),
    'translation.test /export': (url) => {
      const format = url.searchParams.get('format');
      return format === 'csljson' ? Response.json([CSL_BOOK]) : new Response(EXPORTS[format]);
    },
    'format.test /': () => Response.json({ results: [FORMATTED] }),
    ...overrides,
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const key = `${url.hostname} ${url.pathname}`;
    const body = await request.clone().text();
    calls.push({ key, url, body, authorization: request.headers.get('authorization') });
    const handler = routes[key];
    return handler ? handler(url, body) : new Response(`no fake for ${key}`, { status: 404 });
  });
  return calls;
}

// Runs before every Function: blocks cross-site POSTs and adds security headers.
import { sameOrigin, withSecurityHeaders } from './_lib/security.js';

export async function onRequest(context) {
  if (context.request.method === 'POST' && !sameOrigin(context.request)) {
    return withSecurityHeaders(
      new Response('This form was sent from another site, so it was refused.', {
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      }),
    );
  }
  return withSecurityHeaders(await context.next());
}

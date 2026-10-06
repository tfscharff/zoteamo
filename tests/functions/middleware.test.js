import { describe, expect, it } from 'vitest';
import { onRequest } from '../../functions/_middleware.js';
import { call } from './helpers.js';

describe('middleware', () => {
  it('adds security headers to every response', async () => {
    const res = await call(onRequest, { path: '/l/x' });
    expect(res.headers.get('referrer-policy')).toBe('same-origin');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(await res.text()).toBe('next');
  });

  it('allows same-origin POSTs', async () => {
    const res = await call(onRequest, { method: 'POST', path: '/api/lists', form: { title: 'x' } });
    expect(res.status).toBe(200);
  });

  it('rejects cross-origin and origin-less POSTs', async () => {
    const evil = await call(onRequest, { method: 'POST', path: '/api/lists', headers: { origin: 'https://evil.test' } });
    expect(evil.status).toBe(403);
    expect(evil.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const none = await call(onRequest, { method: 'POST', path: '/api/lists', headers: { origin: null } });
    expect(none.status).toBe(403);
    const opaque = await call(onRequest, { method: 'POST', path: '/api/lists', headers: { origin: 'null' } });
    expect(opaque.status).toBe(403);
  });
});

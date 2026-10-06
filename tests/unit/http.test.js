import { describe, expect, it } from 'vitest';
import { htmlResponse, parseCookies, readForm, redirect, setCookie } from '../../functions/_lib/http.js';

describe('http helpers', () => {
  it('parses cookies and decodes values', () => {
    const request = new Request('https://x.test/', { headers: { cookie: 'a=1; zoteamo_name=Ana%20Ruiz; bad=%E0' } });
    expect(parseCookies(request)).toEqual({ a: '1', zoteamo_name: 'Ana Ruiz' });
  });

  it('returns an empty object without a cookie header', () => {
    expect(parseCookies(new Request('https://x.test/'))).toEqual({});
  });

  it('builds a secure, http-only, lax cookie', () => {
    expect(setCookie('zoteamo_style', 'mla')).toBe(
      'zoteamo_style=mla; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly',
    );
    expect(setCookie('n', 'a b', { maxAge: 60 })).toContain('n=a%20b; Path=/; Max-Age=60;');
  });

  it('redirects with 303 and sets every cookie', () => {
    const res = redirect('/e/abc', { cookies: ['a=1', 'b=2'] });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/e/abc');
    expect(res.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
  });

  it('serves HTML as UTF-8 with the given status', async () => {
    const res = htmlResponse('<p>hi</p>', { status: 422, cookies: ['a=1'] });
    expect(res.status).toBe(422);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.getSetCookie()).toEqual(['a=1']);
    expect(await res.text()).toBe('<p>hi</p>');
  });

  it('reads trimmed form values, with empty strings for missing fields', async () => {
    const body = new URLSearchParams([['title', '  Hi  '], ['c', 'x'], ['c', ' y ']]);
    const form = await readForm(new Request('https://x.test/', { method: 'POST', body }));
    expect(form.get('title')).toBe('Hi');
    expect(form.get('missing')).toBe('');
    expect(form.getAll('c')).toEqual(['x', 'y']);
  });
});

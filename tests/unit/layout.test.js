import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layout, notFoundPage, renderPage } from '../../functions/_lib/views/layout.js';
import { CSP } from '../../functions/_lib/security.js';

describe('layout', () => {
  it('renders one h1-free shell with skip link, landmarks and noindex', () => {
    const page = String(layout({ title: 'A & B', body: '<h1>x</h1>' }));
    expect(page).toMatch(/^<!DOCTYPE html>/);
    expect(page).toContain('<title>A &amp; B – zoteamo</title>');
    expect(page).toContain('<meta name="robots" content="noindex">');
    expect(page).toContain('<a class="skip-link" href="#main">');
    expect(page).toContain('<main id="main" class="wrap">');
    expect(page).toContain('https://github.com/tfscharff/zoteamo');
    expect(page).toContain('&lt;h1&gt;x&lt;/h1&gt;');
  });

  it('can omit noindex', () => {
    expect(String(layout({ title: 't', body: '', noindex: false }))).not.toContain('noindex');
  });

  it('renderPage returns HTML with status and cookies', async () => {
    const res = renderPage({ title: 't', body: 'b', status: 422, cookies: ['a=1'] });
    expect(res.status).toBe(422);
    expect(res.headers.getSetCookie()).toEqual(['a=1']);
    expect(await res.text()).toContain('<title>t – zoteamo</title>');
  });

  it('notFoundPage is a 404 with a heading', async () => {
    const res = notFoundPage();
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('<h1>This link doesn\u2019t work</h1>');
  });

  it('uses the same CSP as the static _headers file', () => {
    expect(readFileSync('src/_headers', 'utf8')).toContain(`Content-Security-Policy: ${CSP}`);
  });
});

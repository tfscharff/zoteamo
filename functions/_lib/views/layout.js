// Page shell for server-rendered pages. Keep the header and footer in step with src/_includes/base.njk.
import site from '../../../src/_data/site.json' with { type: 'json' };
import { html, raw } from '../html.js';
import { htmlResponse } from '../http.js';

const FONT = '/assets/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2';

export function layout({ title, body, noindex = true }) {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${noindex ? raw('<meta name="robots" content="noindex">') : ''}
<title>${title} – ${site.name}</title>
<link rel="preload" href="${FONT}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/enhance.js" type="module"></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/">${site.name}</a>
    <nav aria-label="Site">
      <ul>
        <li><a href="/about/">About</a></li>
      </ul>
    </nav>
  </div>
</header>
<main id="main" class="wrap">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>zoteamo is free software under the <a href="${site.source}/blob/main/LICENSE">GNU AGPL</a>. <a href="${site.source}">Source code</a>.</p>
  </div>
</footer>
</body>
</html>`;
}

export function renderPage({ title, body, status = 200, cookies = [], noindex = true }) {
  return htmlResponse(layout({ title, body, noindex }), { status, cookies });
}

export function notFoundPage() {
  const body = html`<h1>This link doesn\u2019t work</h1>
<p>The reading list may have been given a new edit link, or the address may be incomplete. Ask someone in your group for the current link.</p>
<p><a href="/">Create a new reading list</a></p>`;
  return renderPage({ title: 'Link not found', body, status: 404 });
}

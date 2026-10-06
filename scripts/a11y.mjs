#!/usr/bin/env node
// Accessibility check (spec §7): builds the site, seeds a local D1 list, serves it with `wrangler pages dev`,
// then runs html-validate on the server-rendered pages and pa11y-ci (WCAG2AAA, axe + htmlcs) on every page.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer';

const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = '.a11y';
const VIEW = 'a11yViewToken000000000';
const EDIT = 'a11yEditToken000000000';
const ITEM = '00000000-0000-4000-8000-000000000001';
const isWindows = process.platform === 'win32';
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: isWindows, env: { ...process.env, CI: 'true' } });
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const PAGES = {
  home: '/',
  about: '/about/',
  'not-found': '/no-such-page',
  view: `/l/${VIEW}`,
  'edit-created': `/e/${EDIT}?created=1`,
  'edit-item': `/e/${EDIT}/items/${ITEM}/edit`,
  'delete-item': `/e/${EDIT}/items/${ITEM}/delete`,
  'dead-link': '/l/AAAAAAAAAAAAAAAAAAAAAA',
};

function seedSql() {
  const now = new Date().toISOString();
  const cite = 'Doe, J. (2020). <i>The Reading Group</i>. Example Press.';
  const text = 'Doe, J. (2020). The Reading Group. Example Press.';
  const zotero = JSON.stringify({ itemType: 'book', title: 'The Reading Group', creators: [{ creatorType: 'author', firstName: 'Jane', lastName: 'Doe' }] });
  const hash = createHash('sha256').update(EDIT).digest('hex');
  return `DELETE FROM lists WHERE id = 'a11y-list';
INSERT INTO lists (id, title, description, default_style, view_token, edit_token_hash, created_at, updated_at)
  VALUES ('a11y-list', 'Accessibility check', 'Seeded by scripts/a11y.mjs', 'apa', ${sql(VIEW)}, ${sql(hash)}, ${sql(now)}, ${sql(now)});
INSERT INTO items (id, list_id, input, input_kind, title, zotero_json, cite_apa, cite_mla, cite_chicago, text_apa, text_mla, text_chicago,
  coins, citation_state, added_by, note, status, meeting_date, created_at, updated_at)
  VALUES (${sql(ITEM)}, 'a11y-list', 'https://example.org/book', 'url', 'The Reading Group', ${sql(zotero)}, ${sql(cite)}, ${sql(cite)}, ${sql(cite)},
  ${sql(text)}, ${sql(text)}, ${sql(text)}, '', 'ready', 'Ana', 'Chapters 1–3', 'up_next', '2026-11-05', ${sql(now)}, ${sql(now)});
INSERT INTO items (id, list_id, input, input_kind, title, citation_state, citation_error, created_at, updated_at)
  VALUES ('00000000-0000-4000-8000-000000000002', 'a11y-list', 'https://example.org/missing', 'url', '', 'failed',
  'No citation details could be found there.', ${sql(now)}, ${sql(now)});
`;
}

async function waitForServer(server) {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(`wrangler pages dev exited early (code ${server.exitCode}).`);
    try {
      if ((await fetch(`${BASE}/`)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('wrangler pages dev did not start within 60 seconds.');
}

function stop(server) {
  if (isWindows) {
    try {
      execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // Already gone.
    }
  } else {
    server.kill('SIGTERM');
  }
}

// Real-browser regression check: a form POST must carry a same-origin Origin header, never "null".
async function checkCreateForm() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
    await page.type('#title', 'Browser check list');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('form[action="/api/lists"] button[type="submit"]'),
    ]);
    const url = page.url();
    if (!/\/e\/[A-Za-z0-9_-]{22}\?created=1$/.test(url)) {
      throw new Error(`Create-form check failed: expected a redirect to /e/{token}?created=1 but ended at ${url}. A browser may be sending a bad Origin header (check Referrer-Policy).`);
    }
    console.log('Create-form check passed: the browser submitted the form and landed on /e/<token>?created=1.');
  } finally {
    await browser.close();
  }
}

async function portInUse() {
  try {
    await fetch(`${BASE}/`);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (await portInUse()) throw new Error(`Port ${PORT} is in use; stop the other server first.`);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT);
  run('npm', ['run', 'build']);
  run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'zoteamo', '--local']);
  writeFileSync(join(OUT, 'seed.sql'), seedSql());
  run('npx', ['wrangler', 'd1', 'execute', 'zoteamo', '--local', '--file', join(OUT, 'seed.sql')]);
  const server = spawn('npx', ['wrangler', 'pages', 'dev', '_site', '--port', String(PORT), '--ip', '127.0.0.1'], { stdio: 'ignore', shell: isWindows });
  try {
    await waitForServer(server);
    for (const [name, path] of Object.entries(PAGES)) {
      writeFileSync(join(OUT, `${name}.html`), await (await fetch(BASE + path)).text());
    }
    run('npx', ['html-validate', `${OUT}/*.html`]);
    writeFileSync(join(OUT, 'pa11y.json'), JSON.stringify({
      defaults: { standard: 'WCAG2AAA', runners: ['axe', 'htmlcs'], timeout: 60000, chromeLaunchConfig: { args: ['--no-sandbox'] } },
      urls: Object.values(PAGES).map((path) => BASE + path),
    }, null, 2));
    run('npx', ['pa11y-ci', '--config', join(OUT, 'pa11y.json')]);
    await checkCreateForm();
  } finally {
    stop(server);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

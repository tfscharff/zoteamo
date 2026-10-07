// Cloudflare Pages bundles functions/ with its own older wrangler (3.x), whose esbuild rejects
// import attributes such as `with { type: 'json' }`. Keep Functions code free of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

test('Functions code uses no import attributes', () => {
  const offenders = jsFiles('functions').filter((file) =>
    /\bimport\b[^;]*?\bfrom\s*['"][^'"]+['"]\s*(with|assert)\s*\{/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});

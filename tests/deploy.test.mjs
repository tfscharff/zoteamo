import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootstrapArgs, bucketName, checkoutProblem, cloneArgs, copyFilter, deployArgs, packageArgs, parseRef, reservedConcurrencyFor } from '../scripts/lib/deploy.mjs';

test('parseRef accepts only a full commit SHA', () => {
  assert.equal(parseRef(' 3a9d17614896fc1fea73d7b880ea79273b605275\n'), '3a9d17614896fc1fea73d7b880ea79273b605275');
  assert.throws(() => parseRef('master'), /40-character/);
});

test('the pinned translation-server ref is a full SHA', () => {
  parseRef(readFileSync('infra/translation-server.ref', 'utf8'));
});

test('the deploy bucket is our own, named per account', () => {
  assert.equal(bucketName('145395257847'), 'zoteamo-deploy-145395257847');
  const args = packageArgs('zoteamo-deploy-1');
  assert.deepEqual(args.slice(0, 2), ['cloudformation', 'package']);
  assert.equal(args[args.indexOf('--s3-bucket') + 1], 'zoteamo-deploy-1');
  assert.equal(args[args.indexOf('--region') + 1], 'us-east-1');
});

test('deploy needs named IAM and only stops at the change set when reviewing', () => {
  const live = deployArgs({ review: false });
  assert.ok(live.includes('CAPABILITY_NAMED_IAM'));
  assert.ok(live.includes('CAPABILITY_AUTO_EXPAND'));
  assert.equal(live[live.indexOf('--stack-name') + 1], 'zoteamo');
  assert.ok(!live.includes('--no-execute-changeset'));
  assert.ok(deployArgs({ review: true }).includes('--no-execute-changeset'));
});

test('deploy passes the reserved concurrency as a stack parameter', () => {
  const args = deployArgs({ review: false, reservedConcurrency: 0 });
  assert.equal(args[args.indexOf('--parameter-overrides') + 1], 'ReservedConcurrency=0');
  assert.ok(!deployArgs({ review: false }).includes('--parameter-overrides'));
});

test('reserved concurrency is 2 only when the account limit leaves AWS its 100 unreserved', () => {
  assert.equal(reservedConcurrencyFor(1000), 2);
  assert.equal(reservedConcurrencyFor(104), 2);
  assert.equal(reservedConcurrencyFor(103), 0);
  assert.equal(reservedConcurrencyFor(10), 0);
});

test('bootstrap requires an email address and passes it as a parameter', () => {
  assert.throws(() => bootstrapArgs({ email: undefined }), /--email/);
  const args = bootstrapArgs({ email: 'a@example.org', review: true });
  assert.ok(args.includes('AlertEmail=a@example.org'));
  assert.equal(args[args.indexOf('--stack-name') + 1], 'zoteamo-bootstrap');
  assert.ok(args.includes('--no-execute-changeset'));
});

test('copyFilter skips git metadata and npm shims on either slash style', () => {
  assert.equal(copyFilter('infra/.build/translation-server/modules/translators/.git'), false);
  assert.equal(copyFilter('infra\\.build\\translation-server\\node_modules\\.bin\\mocha'), false);
  assert.equal(copyFilter('infra/.build/translation-server/node_modules/koa/index.js'), true);
  assert.equal(copyFilter('infra/.build/translation-server/modules/translators/DOI.js'), true);
});

test('the translation-server clone keeps upstream line endings', () => {
  const args = cloneArgs('https://example.test/repo.git', 'infra/.build/ts');
  assert.deepEqual(args.slice(0, 3), ['-c', 'core.autocrlf=false', 'clone']);
  assert.deepEqual(args.slice(3), ['https://example.test/repo.git', 'infra/.build/ts']);
});

test('a source directory without its own .git is refused, not treated as the parent repo', () => {
  assert.match(checkoutProblem({ dirExists: true, gitExists: false }, 'src-dir'), /src-dir exists but is not a git checkout/);
  assert.equal(checkoutProblem({ dirExists: true, gitExists: true }, 'src-dir'), null);
  assert.equal(checkoutProblem({ dirExists: false, gitExists: false }, 'src-dir'), null);
});

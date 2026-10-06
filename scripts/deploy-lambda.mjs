#!/usr/bin/env node
// Builds and deploys the zoteamo stack (spec section 9): upstream translation-server at the pinned SHA (cloned into
// the gitignored infra/.build/, never vendored) plus our bundled formatter.
// Usage: npm run deploy:lambda [-- --review]   (--review creates the change set without executing it)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { bucketName, checkoutProblem, cloneArgs, copyFilter, deployArgs, packageArgs, parseRef, REGION, STACK, TRANSLATION_REPO } from './lib/deploy.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUILD = join(ROOT, 'infra/.build');
const SOURCE = join(BUILD, 'translation-server');
const PACKAGE = join(BUILD, 'translation-package');
const FORMAT = join(BUILD, 'format');
const review = process.argv.includes('--review');
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32' && cmd === 'npm', ...opts });

function buildTranslationServer() {
  const sha = parseRef(readFileSync(join(ROOT, 'infra/translation-server.ref'), 'utf8'));
  const problem = checkoutProblem({ dirExists: existsSync(SOURCE), gitExists: existsSync(join(SOURCE, '.git')) }, SOURCE);
  if (problem) throw new Error(problem);
  if (!existsSync(SOURCE)) run('git', cloneArgs(TRANSLATION_REPO, SOURCE));
  run('git', ['-C', SOURCE, 'fetch', 'origin']);
  run('git', ['-C', SOURCE, 'checkout', '--detach', sha]);
  run('git', ['-C', SOURCE, 'submodule', 'update', '--init', '--recursive']);
  run('npm', ['ci', '--omit=dev'], { cwd: SOURCE });
  rmSync(PACKAGE, { recursive: true, force: true });
  // Same contents as upstream's lambda_package script: config, modules, node_modules, src.
  for (const dir of ['config', 'modules', 'node_modules', 'src']) {
    cpSync(join(SOURCE, dir), join(PACKAGE, dir), { recursive: true, filter: copyFilter });
  }
}

async function buildFormatter() {
  rmSync(FORMAT, { recursive: true, force: true });
  await build({
    entryPoints: [join(ROOT, 'infra/format/index.mjs')],
    outfile: join(FORMAT, 'index.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  // esbuild does not bundle the CSL files format.mjs reads via import.meta.dirname, so ship them beside the bundle.
  cpSync(join(ROOT, 'infra/format/csl'), join(FORMAT, 'csl'), { recursive: true });
}

async function main() {
  mkdirSync(BUILD, { recursive: true });
  buildTranslationServer();
  await buildFormatter();
  const account = execFileSync('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'], { encoding: 'utf8' }).trim();
  run('aws', packageArgs(bucketName(account)));
  run('aws', deployArgs({ review }));
  if (!review) {
    run('aws', ['cloudformation', 'describe-stacks', '--region', REGION, '--stack-name', STACK, '--query', 'Stacks[0].Outputs', '--output', 'table']);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

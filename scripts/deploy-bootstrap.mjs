#!/usr/bin/env node
// Creates or updates the zoteamo-bootstrap stack: the deploy bucket and the $0.01 budget alert.
// Usage: npm run deploy:bootstrap -- --email you@example.com [--review]
import { execFileSync } from 'node:child_process';
import { bootstrapArgs } from './lib/deploy.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--email');
try {
  execFileSync('aws', bootstrapArgs({ email: at === -1 ? undefined : args[at + 1], review: args.includes('--review') }), { stdio: 'inherit' });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

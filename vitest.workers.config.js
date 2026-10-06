import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: '2026-08-22',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: ['DB'],
          bindings: {
            TEST_MIGRATIONS: migrations,
            AWS_ACCESS_KEY_ID: 'AKIDTEST',
            AWS_SECRET_ACCESS_KEY: 'secret-test',
            AWS_REGION: 'us-east-1',
            TRANSLATION_URL: 'https://translation.test',
            FORMAT_URL: 'https://format.test',
          },
        },
      }),
    ],
    test: {
      name: 'workers',
      include: ['tests/functions/**/*.test.js'],
      setupFiles: ['./tests/functions/setup.js'],
    },
  };
});

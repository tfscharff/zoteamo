import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { projects: ['./vitest.unit.config.js', './vitest.workers.config.js'] },
});

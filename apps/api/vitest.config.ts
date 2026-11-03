import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { fileParallelism: false, include: ['test/**/*.spec.ts'], globalSetup: ['test/global-setup.ts'], testTimeout: 60_000, hookTimeout: 120_000 },
});

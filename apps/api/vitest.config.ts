import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.spec.ts'], globalSetup: ['test/global-setup.ts'], testTimeout: 60_000, hookTimeout: 120_000 },
});

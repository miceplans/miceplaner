import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'], globalSetup: ['test/global-setup.ts'], testTimeout: 30_000, hookTimeout: 60_000 } });

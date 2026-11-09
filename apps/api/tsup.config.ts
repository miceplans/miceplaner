import { defineConfig } from 'tsup';

/** Vercel의 ESM 파일 추적 대신 API와 workspace 패키지 코드를 하나의 Node 번들로 만든다. */
export default defineConfig({
  entry: ['api/handler.ts'],
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  dts: true,
  clean: true,
  outDir: 'dist',
  outExtension: () => ({ js: '.cjs' }),
  noExternal: [/^@miceplans\//],
});

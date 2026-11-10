import { defineConfig } from 'tsup';

/** Vercel의 ESM 파일 추적 대신 API와 workspace 패키지 코드를 하나의 Node 번들로 만든다. */
export default defineConfig({
  entry: ['api/handler.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  dts: false,
  clean: true,
  outDir: 'dist',
  noExternal: [/^@miceplans\//],
  // jose는 ESM 전용이고 pg는 CommonJS의 동적 require를 사용한다. 둘 다 Node 런타임에서 직접 해석한다.
  external: ['jose', 'pg'],
});

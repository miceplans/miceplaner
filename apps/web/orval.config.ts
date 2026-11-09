import { defineConfig } from 'orval';

/** apps/api가 내보낸 OpenAPI(`pnpm api:spec`)에서 fetch 클라이언트와 TanStack Query 훅을 만든다. */
export default defineConfig({
  miceplans: {
    input: '../api/openapi.json',
    output: {
      target: 'src/lib/api/generated/endpoints.ts',
      schemas: 'src/lib/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      prettier: false,
      override: {
        mutator: { path: 'src/lib/api/http.ts', name: 'http' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});

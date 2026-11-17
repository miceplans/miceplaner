import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const APPS = ['@miceplans/web', '@miceplans/api', '@miceplans/collaboration', '@miceplans/worker'];
// 앱끼리 직접 import 금지. 패키지는 앱을 import하지 않는다 (AGENTS.md 아키텍처 경계).
const appPatterns = {
  group: ['**/apps/*', ...APPS],
  message: '앱끼리 직접 import하지 않으며, 패키지는 앱을 import하지 않는다.',
};

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/next-env.d.ts', '**/dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
  {
    // 앱은 패키지만 import한다 (다른 앱은 제외).
    files: ['apps/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [appPatterns] }] },
  },
  {
    // Client 포털 화면은 contracts(/portal 포함)와 ui만 쓴다 (AGENTS.md 아키텍처 경계).
    files: ['apps/web/src/app/client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [appPatterns, { group: ['@miceplans/db', '@miceplans/domain', '@miceplans/editor-schema', '@miceplans/knowledge', '@miceplans/queue', '@miceplans/ai', '@miceplans/storage', '@miceplans/config'], message: 'Client 포털은 contracts/portal과 ui만 사용한다.' }],
      }],
    },
  },
  {
    // DB 클라이언트는 packages/db repository에서만 쓴다 (테스트·스펙 파일은 제외).
    files: [
      'apps/**/*.{ts,tsx}',
      'packages/contracts/**/*.{ts,tsx}',
      'packages/domain/**/*.{ts,tsx}',
      'packages/ui/**/*.{ts,tsx}',
      'packages/knowledge/**/*.{ts,tsx}',
      'packages/editor-schema/**/*.{ts,tsx}',
      'packages/queue/**/*.{ts,tsx}',
      'packages/storage/**/*.{ts,tsx}',
      'packages/ai/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.spec.ts', '**/test/**'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: 'pg', message: 'DB 클라이언트는 packages/db repository에서만 사용한다.' }], patterns: [appPatterns] }] },
  },
  {
    // 최하위 패키지: 낮은 패키지를 import하지 않는다.
    files: [
      'packages/domain/**/*.{ts,tsx}',
      'packages/ui/**/*.{ts,tsx}',
      'packages/knowledge/**/*.{ts,tsx}',
      'packages/editor-schema/**/*.{ts,tsx}',
      'packages/storage/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.spec.ts', '**/test/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'pg', message: 'DB 클라이언트는 packages/db repository에서만 사용한다.' }],
        patterns: [appPatterns, { group: ['@miceplans/*'], message: '이 패키지는 낮은 패키지로 다른 @miceplans 패키지를 import하지 않는다.' }],
      }],
    },
  },
  {
    // contracts는 domain만 import한다.
    files: ['packages/contracts/**/*.{ts,tsx}'],
    ignores: ['**/*.spec.ts', '**/test/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'pg', message: 'DB 클라이언트는 packages/db repository에서만 사용한다.' }],
        patterns: [appPatterns, { group: ['@miceplans/db', '@miceplans/ui', '@miceplans/queue', '@miceplans/ai', '@miceplans/storage', '@miceplans/knowledge', '@miceplans/editor-schema', '@miceplans/config'], message: 'contracts는 domain만 import한다.' }],
      }],
    },
  },
  {
    // queue는 contracts만 import한다 (테스트 공용은 db/testing 하위 경로 예외).
    files: ['packages/queue/**/*.{ts,tsx}'],
    ignores: ['**/*.spec.ts', '**/test/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'pg', message: 'DB 클라이언트는 packages/db repository에서만 사용한다.' }],
        patterns: [appPatterns, { group: ['@miceplans/db', '@miceplans/domain', '@miceplans/ui', '@miceplans/knowledge', '@miceplans/ai', '@miceplans/storage', '@miceplans/editor-schema', '@miceplans/config'], message: 'queue는 contracts만 import한다.' }],
      }],
    },
  },
  {
    // db는 domain·knowledge·contracts만 import한다.
    files: ['packages/db/**/*.{ts,tsx}'],
    ignores: ['**/*.spec.ts', '**/test/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [appPatterns, { group: ['@miceplans/ui', '@miceplans/queue', '@miceplans/ai', '@miceplans/storage', '@miceplans/editor-schema', '@miceplans/config'], message: 'db는 domain·knowledge·contracts만 import한다.' }],
      }],
    },
  },
  {
    // ai는 contracts·domain만 import한다.
    files: ['packages/ai/**/*.{ts,tsx}'],
    ignores: ['**/*.spec.ts', '**/test/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'pg', message: 'DB 클라이언트는 packages/db repository에서만 사용한다.' }],
        patterns: [appPatterns, { group: ['@miceplans/db', '@miceplans/domain', '@miceplans/ui', '@miceplans/queue', '@miceplans/knowledge', '@miceplans/storage', '@miceplans/editor-schema', '@miceplans/config'], message: 'ai는 contracts·domain만 import한다.' }],
      }],
    },
  },
);

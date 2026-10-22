import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

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
    // 아키텍처 경계: 앱끼리 import 금지, DB 클라이언트는 packages/db 안에서만 사용한다.
    files: ['apps/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}', 'packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'pg', message: 'DB 클라이언트는 packages/db repository에서만 사용한다.' }], patterns: [{ group: ['**/apps/*', '@miceplans/web', '@miceplans/api'], message: '앱끼리 직접 import하지 않는다.' }] }],
    },
  },
);

import { fileURLToPath } from 'node:url';

// 루트 .env를 함께 읽는다. Next는 앱 디렉터리의 .env만 읽기 때문이다. 없으면 건너뛴다.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {}

/** @type {import('next').NextConfig} */
export default { devIndicators: false, output: 'export', images: { unoptimized: true }, transpilePackages: ['@miceplans/ui', '@miceplans/editor-schema'] };

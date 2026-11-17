import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const desktopDir = resolve(import.meta.dirname, '..');
const rootEnv = resolve(desktopDir, '../../.env');
const baseConfigPath = resolve(desktopDir, 'src-tauri/tauri.conf.json');
const releaseConfigPath = resolve(desktopDir, 'src-tauri/tauri.release.conf.json');

// Next.js와 같은 루트 .env를 읽어, 웹 번들과 CSP가 같은 공개 origin을 사용하게 한다.
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

function requiredHttpsOrigin(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}이 필요하다. 데스크톱 배포본에는 API 주소가 빌드 시 포함된다.`);
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`${name}은 운영 배포에서 https URL이어야 한다.`);
  return url.origin;
}

function optionalCollabOrigin() {
  const value = process.env.NEXT_PUBLIC_COLLAB_URL;
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'wss:') throw new Error('NEXT_PUBLIC_COLLAB_URL은 운영 배포에서 wss URL이어야 한다.');
  return url.origin;
}

const apiOrigin = requiredHttpsOrigin('NEXT_PUBLIC_API_URL');
const collabOrigin = optionalCollabOrigin();
const config = JSON.parse(readFileSync(baseConfigPath, 'utf8'));
const connectSources = ["'self'", apiOrigin, ...(collabOrigin ? [collabOrigin] : [])];
config.app.security.csp = [
  "default-src 'self'",
  `connect-src ${connectSources.join(' ')}`,
  "img-src 'self' asset: data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
].join('; ');

writeFileSync(releaseConfigPath, `${JSON.stringify(config, null, 2)}\n`);

const tauri = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
// pnpm은 `pnpm run build -- --target …`의 구분자 `--`도 전달한다.
// 이를 제거하지 않으면 Tauri가 뒤의 target 옵션을 일반 인자로 취급한다.
const tauriArgs = process.argv.slice(2).filter((arg) => arg !== '--');
const result = spawnSync(tauri, ['build', '--config', 'src-tauri/tauri.release.conf.json', ...tauriArgs], {
  cwd: desktopDir,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

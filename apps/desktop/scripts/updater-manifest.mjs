// GitHub Release에 올릴 업데이트 파일과 서명(.sig)을 모아 Tauri 업데이터용 latest.json을 만든다.
// 사용: node updater-manifest.mjs <파일 폴더> <버전> <Release 다운로드 URL 접두사>
// 예:   node updater-manifest.mjs dist 0.1.2 https://github.com/miceplans/miceplaner/releases/download/desktop-v0.1.2
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [dir, version, baseUrl] = process.argv.slice(2);
if (!dir || !version || !baseUrl) {
  throw new Error('사용: node updater-manifest.mjs <파일 폴더> <버전> <다운로드 URL 접두사>');
}

const files = readdirSync(dir, { recursive: true }).map((file) => join(dir, String(file)));
const arch = { aarch64: 'aarch64', x86_64: 'x86_64', arm64: 'aarch64', x64: 'x86_64' };

// 업데이터는 `{os}-{arch}-{설치 형식}`을 먼저 찾고, 없으면 `{os}-{arch}`를 쓴다.
// Windows는 MSI로 설치한 사용자는 MSI로, NSIS로 설치한 사용자는 NSIS로 업데이트되게 둘 다 기록한다.
function platformKeys(fileName) {
  let match = fileName.match(/^MICEPLANNER_(aarch64|x86_64)\.app\.tar\.gz$/);
  if (match) return [`darwin-${arch[match[1]]}`, `darwin-${arch[match[1]]}-app`];
  match = fileName.match(/_(x64|arm64)-setup\.exe$/);
  if (match) return [`windows-${arch[match[1]]}`, `windows-${arch[match[1]]}-nsis`];
  match = fileName.match(/_(x64|arm64)_[^_]+\.msi$/);
  if (match) return [`windows-${arch[match[1]]}-msi`];
  return [];
}

const platforms = {};
for (const sigPath of files.filter((file) => file.endsWith('.sig'))) {
  const fileName = basename(sigPath, '.sig');
  const keys = platformKeys(fileName);
  if (keys.length === 0) throw new Error(`어느 플랫폼의 업데이트 파일인지 알 수 없다: ${fileName}`);
  const entry = {
    signature: readFileSync(sigPath, 'utf8').trim(),
    url: `${baseUrl}/${encodeURIComponent(fileName)}`,
  };
  for (const key of keys) platforms[key] = entry;
}

const required = ['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64', 'windows-aarch64'];
const missing = required.filter((key) => !platforms[key]);
if (missing.length > 0) throw new Error(`업데이트 파일이 빠졌다: ${missing.join(', ')}`);

const manifest = { version, pub_date: new Date().toISOString(), platforms };
writeFileSync(join(dir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`latest.json: ${Object.keys(platforms).sort().join(', ')}`);

// CI 빌드 결과에서 GitHub Release에 올릴 파일만 골라 알아보기 쉬운 이름으로 복사하고,
// Tauri 업데이터용 latest.json과 다운로드 안내 본문(release-notes.md)을 만든다.
// 사용: node release-assets.mjs <빌드 결과 폴더> <출력 폴더> <버전> <Release 다운로드 URL 접두사>
// .sig는 latest.json에 내용이 들어가므로 따로 올리지 않는다. Windows는 NSIS(-setup.exe)만 배포한다.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const [inputDir, outDir, version, baseUrl] = process.argv.slice(2);
if (!inputDir || !outDir || !version || !baseUrl) {
  throw new Error('사용: node release-assets.mjs <빌드 결과 폴더> <출력 폴더> <버전> <다운로드 URL 접두사>');
}

const files = readdirSync(inputDir, { recursive: true }).map((file) => join(inputDir, String(file)));

function findOne(pattern, label) {
  const found = files.filter((file) => pattern.test(basename(file)));
  if (found.length !== 1) throw new Error(`${label} 파일을 하나만 찾아야 하는데 ${found.length}개다.`);
  return found[0];
}

const installers = [
  // Intel Mac은 배포하지 않는다. Apple Silicon(M1 이후)만 지원한다.
  { label: 'Mac (Apple Silicon: M1 이후)', name: 'MICEPLANNER-Mac.dmg', pattern: /_aarch64\.dmg$/ },
  {
    label: 'Windows (일반 PC)',
    name: 'MICEPLANNER-Windows-setup.exe',
    pattern: /_x64-setup\.exe$/,
    platforms: ['windows-x86_64', 'windows-x86_64-nsis'],
  },
  {
    label: 'Windows (ARM PC)',
    name: 'MICEPLANNER-Windows-ARM-setup.exe',
    pattern: /_arm64-setup\.exe$/,
    platforms: ['windows-aarch64', 'windows-aarch64-nsis'],
  },
];
// macOS 업데이트는 dmg가 아니라 .app 압축본을 쓴다. 사람이 받을 파일이 아니므로 updater- 접두사로 목록 뒤에 둔다.
const updaterOnly = [
  {
    name: 'updater-macos-arm64.app.tar.gz',
    pattern: /^MICEPLANNER_aarch64\.app\.tar\.gz$/,
    platforms: ['darwin-aarch64', 'darwin-aarch64-app'],
  },
];

mkdirSync(outDir, { recursive: true });
const platforms = {};
for (const asset of [...installers, ...updaterOnly]) {
  const source = findOne(asset.pattern, asset.name);
  copyFileSync(source, join(outDir, asset.name));
  if (!asset.platforms) continue;
  const signature = readFileSync(`${source}.sig`, 'utf8').trim();
  const entry = { signature, url: `${baseUrl}/${asset.name}` };
  for (const key of asset.platforms) platforms[key] = entry;
}

const manifest = { version, pub_date: new Date().toISOString(), platforms };
writeFileSync(join(outDir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const notes = [
  '## 다운로드',
  '',
  '| 컴퓨터 | 설치 파일 |',
  '| --- | --- |',
  ...installers.map((asset) => `| ${asset.label} | [${asset.name}](${baseUrl}/${asset.name}) |`),
  '',
  '이미 설치되어 있으면 앱을 실행할 때 업데이트 안내가 나옵니다. `latest.json`과 `updater-*` 파일은 자동 업데이트용이라 받지 않아도 됩니다.',
  '',
  'Mac에서 처음 열 때 "확인되지 않은 개발자" 경고가 나오면 **시스템 설정 → 개인정보 보호 및 보안**에서 **그래도 열기**를 누르세요. Windows는 **추가 정보 → 실행**을 누르세요.',
  '',
].join('\n');
writeFileSync(join(dirname(outDir), 'release-notes.md'), notes);
console.log(readdirSync(outDir).sort().join('\n'));

# MICEPLANNER 데스크톱

내부 웹의 정적 export를 Tauri 2 WebView로 제공하는 데스크톱 셸이다. 업무 규칙과 DB 접근은 포함하지 않는다.

## 실행과 배포 빌드

- 개발: `pnpm --filter @miceplans/desktop dev`
- 배포 빌드: `NEXT_PUBLIC_API_URL=https://api.example.com pnpm --filter @miceplans/desktop build`

배포 빌드는 `NEXT_PUBLIC_API_URL`을 HTTPS URL로 요구한다. 협업 서버를 쓸 때는 `NEXT_PUBLIC_COLLAB_URL`도 WSS URL로 설정한다. 두 주소의 origin만 Tauri CSP의 `connect-src`에 포함된다.

API 서버의 `WEB_ORIGIN`에는 `tauri://localhost,http://tauri.localhost`를 포함해야 한다. Windows·macOS CI에서는 GitHub Repository Variables `DESKTOP_API_URL`(필수)과 `DESKTOP_COLLAB_URL`(선택)을 사용한다.

## 네이티브 통합

- 알림은 앱의 알림 화면에서 사용자가 **데스크톱 알림 켜기**를 눌렀을 때만 운영체제 권한을 요청한다. 동의 뒤에만 30초마다 새 미확인 알림을 확인해 표시한다.
- 자료 파일 영역은 브라우저/WebView가 전달한 `File` 하나를 기존 업로드 API로 전송한다. 파일 시스템 플러그인이나 임의 경로 접근 권한은 사용하지 않는다.
- Tauri capability는 기본 창 권한과 `notification:default`만 허용한다. 자동 업데이트는 Rust에서만 수행하므로 WebView에 updater 권한을 주지 않는다.

## 한 번에 두 OS 설치 파일 받기

`pnpm desktop:installers [ref]`는 GitHub Actions에서 Windows(.msi/.exe)와 macOS(.dmg)를 동시에 빌드하고 결과를 `release/`에 내려받는다. `gh` 로그인과 `DESKTOP_API_URL` 변수가 필요하며, ref는 원격에 push되어 있어야 한다.

## 설치 파일 받기

항상 최신 버전을 받는 고정 링크:

- Mac (Apple Silicon: M1 이후): https://github.com/miceplans/miceplaner/releases/latest/download/MICEPLANNER-Mac.dmg
- Windows (일반 PC): https://github.com/miceplans/miceplaner/releases/latest/download/MICEPLANNER-Windows-setup.exe
- Windows (ARM PC): https://github.com/miceplans/miceplaner/releases/latest/download/MICEPLANNER-Windows-ARM-setup.exe

Intel Mac은 배포하지 않는다.

## 자동 업데이트와 릴리스

배포 빌드 앱은 시작할 때 GitHub의 latest Release에 있는 `latest.json`을 확인한다. 새 버전이 있으면 대화상자로 묻고, **업데이트**를 누르면 내려받아 설치한 뒤 다시 시작한다. 개발 실행(`tauri dev`)에서는 확인하지 않는다.

릴리스 순서:

1. `src-tauri/tauri.conf.json`과 `package.json`의 `version`을 올린다(예: `0.1.2`).
2. 커밋을 push한 뒤 같은 버전의 태그를 push한다: `git tag desktop-v0.1.2 && git push origin desktop-v0.1.2`
3. `desktop-release.yml`이 두 OS를 빌드하고 `scripts/release-assets.mjs`로 올릴 파일만 골라 GitHub Release(설치 파일, `updater-*`, `latest.json`, 다운로드 안내)를 만든다. 설치된 앱은 다음 실행 때 업데이트를 안내한다.

서명 키:

- 업데이트 파일은 Tauri 업데이터 키로 서명한다. 공개키는 `tauri.conf.json`의 `plugins.updater.pubkey`에 있다.
- 개인키와 비밀번호는 Repository Secrets `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`에 둔다. **키를 잃으면 이미 설치된 앱에 업데이트를 보낼 수 없으므로** 따로 백업한다.
- 키가 없는 로컬 빌드는 설치 파일만 만들고 업데이트 파일은 만들지 않는다.

OS 코드 서명(macOS 공증, Windows 코드 서명)은 아직 하지 않는다. macOS에서 처음 열 때 차단되면 Finder에서 앱을 우클릭한 뒤 **열기**를 누른다. Windows SmartScreen 경고가 뜨면 **추가 정보 → 실행**을 누른다.

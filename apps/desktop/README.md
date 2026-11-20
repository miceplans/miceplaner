# MICEPLANNER 데스크톱

내부 웹의 정적 export를 Tauri 2 WebView로 제공하는 데스크톱 셸이다. 업무 규칙과 DB 접근은 포함하지 않는다.

## 실행과 배포 빌드

- 개발: `pnpm --filter @miceplans/desktop dev`
- 배포 빌드: `NEXT_PUBLIC_API_URL=https://api.example.com pnpm --filter @miceplans/desktop build`

배포 빌드는 `NEXT_PUBLIC_API_URL`을 HTTPS URL로 요구한다. 협업 서버를 쓸 때는 `NEXT_PUBLIC_COLLAB_URL`도 WSS URL로 설정한다. 두 주소의 origin만 Tauri CSP의 `connect-src`에 포함된다.

API 서버의 `WEB_ORIGIN`에는 `tauri://localhost,http://tauri.localhost`를 포함해야 한다. Windows CI에서는 GitHub Repository Variables `DESKTOP_API_URL`(필수)과 `DESKTOP_COLLAB_URL`(선택)을 사용한다.

## 네이티브 통합

- 알림은 앱의 알림 화면에서 사용자가 **데스크톱 알림 켜기**를 눌렀을 때만 운영체제 권한을 요청한다. 동의 뒤에만 30초마다 새 미확인 알림을 확인해 표시한다.
- 자료 파일 영역은 브라우저/WebView가 전달한 `File` 하나를 기존 업로드 API로 전송한다. 파일 시스템 플러그인이나 임의 경로 접근 권한은 사용하지 않는다.
- Tauri capability는 기본 창 권한과 `notification:default`만 허용한다.

## 한 번에 두 OS 설치 파일 받기

`pnpm desktop:installers [ref]`는 GitHub Actions에서 Windows(.msi/.exe)와 macOS(.dmg)를 동시에 빌드하고 결과를 `release/`에 내려받는다. `gh` 로그인과 `DESKTOP_API_URL` 변수가 필요하며, ref는 원격에 push되어 있어야 한다.

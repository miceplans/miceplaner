# MICEPLANS 데스크톱

내부 웹의 정적 export를 Tauri 2 WebView로 제공하는 데스크톱 셸이다. 업무 규칙과 DB 접근은 포함하지 않는다.

## 실행과 배포 빌드

- 개발: `pnpm --filter @miceplans/desktop dev`
- 배포 빌드: `NEXT_PUBLIC_API_URL=https://api.example.com pnpm --filter @miceplans/desktop build`

배포 빌드는 `NEXT_PUBLIC_API_URL`을 HTTPS URL로 요구한다. 협업 서버를 쓸 때는 `NEXT_PUBLIC_COLLAB_URL`도 WSS URL로 설정한다. 두 주소의 origin만 Tauri CSP의 `connect-src`에 포함된다.

API 서버의 `WEB_ORIGIN`에는 `tauri://localhost,http://tauri.localhost`를 포함해야 한다. Windows CI에서는 GitHub Repository Variables `DESKTOP_API_URL`(필수)과 `DESKTOP_COLLAB_URL`(선택)을 사용한다.

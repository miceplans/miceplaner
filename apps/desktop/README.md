# MICEPLANS 데스크톱

내부 웹의 정적 export를 Tauri 2 WebView로 제공하는 데스크톱 셸이다. 업무 규칙과 DB 접근은 포함하지 않는다.

## 실행과 배포 빌드

- 개발: `pnpm --filter @miceplans/desktop dev`
- 배포 빌드: `NEXT_PUBLIC_API_URL=https://api.example.com pnpm --filter @miceplans/desktop build`

배포 빌드는 `NEXT_PUBLIC_API_URL`을 HTTPS URL로 요구한다. 협업 서버를 쓸 때는 `NEXT_PUBLIC_COLLAB_URL`도 WSS URL로 설정한다. 두 주소의 origin만 Tauri CSP의 `connect-src`에 포함된다.

API 서버의 `WEB_ORIGIN`에는 `tauri://localhost,http://tauri.localhost`를 포함해야 한다. Windows CI에서는 GitHub Repository Variables `DESKTOP_API_URL`(필수)과 `DESKTOP_COLLAB_URL`(선택)을 사용한다.

## 네이티브 통합

- 알림 화면에서 사용자가 **데스크톱 알림 켜기**를 눌러 운영체제 권한을 허용한 뒤에만, 새 unread 알림을 30초 간격으로 OS 알림으로 보낸다.
- 행사 자료 파일 영역으로 파일을 끌어놓으면 웹뷰가 제공한 `File` 객체를 기존 업로드 API로 보낸다. Tauri 파일시스템 권한은 추가하지 않는다.

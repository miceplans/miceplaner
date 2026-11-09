/// 데스크톱은 정적 웹 UI를 WebView에 표시하는 얇은 셸이다.
/// 업무 규칙·API 인증·DB 접근은 웹과 API 계층에만 둔다.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running MICEPLANS desktop");
}

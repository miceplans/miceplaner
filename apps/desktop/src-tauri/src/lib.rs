/// 데스크톱은 정적 웹 UI를 WebView에 표시하는 얇은 셸이다.
/// 업무 규칙·API 인증·DB 접근은 웹과 API 계층에만 둔다.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default().plugin(tauri_plugin_notification::init());

  // 업데이트 확인·설치는 Rust에서만 수행하고 WebView에는 updater 권한을 주지 않는다.
  #[cfg(desktop)]
  let builder = builder
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      // 개발 실행(tauri dev)에서는 배포 버전 확인을 하지 않는다.
      #[cfg(not(debug_assertions))]
      {
        let handle = app.handle().clone();
        tauri::async_runtime::spawn(async move {
          if let Err(error) = updater::check_and_prompt(handle).await {
            eprintln!("업데이트 확인 실패: {error}");
          }
        });
      }
      #[cfg(debug_assertions)]
      let _ = app;
      Ok(())
    });

  builder
    .run(tauri::generate_context!())
    .expect("error while running MICEPLANNER desktop");
}

#[cfg(all(desktop, not(debug_assertions)))]
mod updater {
  use tauri::AppHandle;
  use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
  use tauri_plugin_updater::UpdaterExt;

  /// 새 버전이 있으면 사용자에게 묻고, 동의한 경우에만 내려받아 설치한 뒤 다시 시작한다.
  pub async fn check_and_prompt(app: AppHandle) -> tauri_plugin_updater::Result<()> {
    let Some(update) = app.updater()?.check().await? else {
      return Ok(());
    };

    let dialog_app = app.clone();
    let message = format!(
      "새 버전 {}이(가) 있습니다. (현재 {})\n지금 업데이트하고 다시 시작할까요?",
      update.version, update.current_version
    );
    // blocking_show는 비동기 런타임 워커를 막지 않도록 별도 blocking 스레드에서 띄운다.
    let confirmed = tauri::async_runtime::spawn_blocking(move || {
      dialog_app
        .dialog()
        .message(message)
        .title("MICEPLANNER 업데이트")
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
          "업데이트".to_string(),
          "나중에".to_string(),
        ))
        .blocking_show()
    })
    .await
    .unwrap_or(false);

    if !confirmed {
      return Ok(());
    }

    // Windows는 설치 프로그램을 실행하면서 앱이 종료되고, macOS는 교체 후 직접 다시 시작한다.
    update.download_and_install(|_, _| {}, || {}).await?;
    app.restart();
  }
}

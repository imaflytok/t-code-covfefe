mod chat;
mod oauth;
mod secrets;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat::chat_stream,
            secrets::secret_set,
            secrets::secret_get,
            secrets::secret_delete,
            oauth::oauth_start,
            oauth::oauth_status,
            oauth::oauth_logout,
            oauth::oauth_access_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use keyring::Entry;

/// Store a secret (API key / OAuth token) in the OS keychain.
#[tauri::command]
pub fn secret_set(service: String, account: String, value: String) -> Result<(), String> {
    let entry = Entry::new(&service, &account).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

/// Read a secret. Returns "" when there is no stored entry.
#[tauri::command]
pub fn secret_get(service: String, account: String) -> Result<String, String> {
    let entry = Entry::new(&service, &account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(p) => Ok(p),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete a secret. No-op if it doesn't exist.
#[tauri::command]
pub fn secret_delete(service: String, account: String) -> Result<(), String> {
    let entry = Entry::new(&service, &account).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

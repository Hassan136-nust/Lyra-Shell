use std::process::Command;

#[tauri::command]
fn run_system_action(action: &str) -> Result<String, String> {
    let status = match action {
        "open_explorer" => Command::new("explorer")
            .status()
            .map_err(|e| format!("failed to open File Explorer: {e}"))?,
        "open_task_manager" => Command::new("taskmgr")
            .status()
            .map_err(|e| format!("failed to open Task Manager: {e}"))?,
        "open_terminal" => Command::new("cmd")
            .args(["/C", "start", "wt"])
            .status()
            .map_err(|e| format!("failed to open Windows Terminal: {e}"))?,
        "open_settings" => Command::new("cmd")
            .args(["/C", "start", "ms-settings:"])
            .status()
            .map_err(|e| format!("failed to open Settings: {e}"))?,
        "lock" => Command::new("rundll32.exe")
            .args(["user32.dll,LockWorkStation"])
            .status()
            .map_err(|e| format!("failed to lock workstation: {e}"))?,
        "restart" => Command::new("shutdown")
            .args(["/r", "/t", "0"])
            .status()
            .map_err(|e| format!("failed to restart: {e}"))?,
        "shutdown" => Command::new("shutdown")
            .args(["/s", "/t", "0"])
            .status()
            .map_err(|e| format!("failed to shutdown: {e}"))?,
        _ => return Err(format!("unsupported action: {action}")),
    };

    if status.success() {
        Ok(format!("{action} executed"))
    } else {
        Err(format!("{action} failed with status: {status}"))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![run_system_action])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

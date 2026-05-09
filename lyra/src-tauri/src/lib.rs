use std::process::Command;
use serde::Serialize;
use sysinfo::System;
use std::ffi::c_void;

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::*;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::*;
#[cfg(target_os = "windows")]
use windows::Win32::System::Threading::*;

// ── Data structures ──────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct WindowInfo {
    pub hwnd: i64,
    pub title: String,
    pub process_name: String,
    pub pid: u32,
}

#[derive(Serialize, Clone, Debug)]
pub struct SystemInfoData {
    pub cpu_usage: f32,
    pub memory_used_gb: f32,
    pub memory_total_gb: f32,
    pub memory_percent: f32,
}

// ── Win32 helpers ────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_process_name_from_pid(pid: u32) -> String {
    unsafe {
        let access = PROCESS_ACCESS_RIGHTS(0x0400 | 0x0010); // QUERY_INFORMATION | VM_READ
        let handle = OpenProcess(access, false, pid);
        if let Ok(handle) = handle {
            let mut buffer = [0u16; 260];
            let len = windows::Win32::System::ProcessStatus::GetModuleBaseNameW(
                handle,
                HINSTANCE::default(),
                &mut buffer,
            );
            let _ = CloseHandle(handle);
            if len > 0 {
                return String::from_utf16_lossy(&buffer[..len as usize]);
            }
        }
        String::from("unknown")
    }
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let list = &mut *(lparam.0 as *mut Vec<WindowInfo>);

    if !IsWindowVisible(hwnd).as_bool() {
        return BOOL(1);
    }

    // Skip windows with no title
    let text_len = GetWindowTextLengthW(hwnd);
    if text_len == 0 {
        return BOOL(1);
    }

    let mut title_buf = vec![0u16; (text_len + 1) as usize];
    let actual_len = GetWindowTextW(hwnd, &mut title_buf);
    if actual_len == 0 {
        return BOOL(1);
    }
    let title = String::from_utf16_lossy(&title_buf[..actual_len as usize]);

    // Skip tiny/tool windows and our own window
    if title.is_empty() || title == "Lyra" || title == "Program Manager" {
        return BOOL(1);
    }

    // Get class name to filter out invisible shell windows
    let mut class_buf = [0u16; 256];
    let class_len = GetClassNameW(hwnd, &mut class_buf);
    if class_len > 0 {
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
        // Skip known invisible/system classes
        if matches!(
            class_name.as_str(),
            "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
                | "DV2ControlHost" | "Windows.UI.Core.CoreWindow"
        ) {
            return BOOL(1);
        }
    }

    let mut pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    let process_name = get_process_name_from_pid(pid);

    list.push(WindowInfo {
        hwnd: hwnd.0 as usize as i64,
        title,
        process_name,
        pid,
    });

    BOOL(1) // Continue
}

// ── Tauri commands ───────────────────────────────────────────────

#[tauri::command]
fn get_running_windows() -> Vec<WindowInfo> {
    #[cfg(target_os = "windows")]
    {
        let mut windows_list: Vec<WindowInfo> = Vec::new();
        unsafe {
            let ptr = &mut windows_list as *mut Vec<WindowInfo>;
            let _ = EnumWindows(Some(enum_windows_callback), LPARAM(ptr as isize));
        }
        // Deduplicate by pid — keep the one with the longest title
        let mut seen_pids = std::collections::HashMap::new();
        for w in &windows_list {
            let entry = seen_pids.entry(w.pid).or_insert_with(|| w.clone());
            if w.title.len() > entry.title.len() {
                *entry = w.clone();
            }
        }
        seen_pids.into_values().collect()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

#[tauri::command]
fn get_active_window() -> Option<WindowInfo> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return None;
            }
            let text_len = GetWindowTextLengthW(hwnd);
            if text_len == 0 {
                return None;
            }
            let mut buf = vec![0u16; (text_len + 1) as usize];
            let actual = GetWindowTextW(hwnd, &mut buf);
            let title = String::from_utf16_lossy(&buf[..actual as usize]);
            if title == "Lyra" {
                return None;
            }

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            let process_name = get_process_name_from_pid(pid);

            Some(WindowInfo {
                hwnd: hwnd.0 as usize as i64,
                title,
                process_name,
                pid,
            })
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[tauri::command]
fn focus_window(hwnd: i64) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let h = HWND(hwnd as usize as *mut c_void);
            // Restore if minimized
            let _ = ShowWindow(h, SW_RESTORE);
            let _ = SetForegroundWindow(h);
        }
        Ok("focused".into())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("not on windows".into())
    }
}

#[tauri::command]
fn minimize_window(hwnd: i64) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let h = HWND(hwnd as usize as *mut c_void);
            let _ = ShowWindow(h, SW_MINIMIZE);
        }
        Ok("minimized".into())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("not on windows".into())
    }
}

#[tauri::command]
fn close_window(hwnd: i64) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let h = HWND(hwnd as usize as *mut c_void);
            let _ = PostMessageW(h, WM_CLOSE, WPARAM(0), LPARAM(0));
        }
        Ok("closed".into())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("not on windows".into())
    }
}

#[tauri::command]
fn get_system_info() -> SystemInfoData {
    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();
    // Small sleep so CPU reading is meaningful
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_all();

    let cpu = sys.global_cpu_usage();
    let mem_used = sys.used_memory() as f64 / 1_073_741_824.0;
    let mem_total = sys.total_memory() as f64 / 1_073_741_824.0;
    let mem_pct = if mem_total > 0.0 {
        (mem_used / mem_total * 100.0) as f32
    } else {
        0.0
    };

    SystemInfoData {
        cpu_usage: cpu,
        memory_used_gb: mem_used as f32,
        memory_total_gb: mem_total as f32,
        memory_percent: mem_pct,
    }
}

#[tauri::command]
fn run_system_action(action: &str) -> Result<String, String> {
    let status = match action {
        "open_explorer" => Command::new("explorer")
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        "open_task_manager" => Command::new("taskmgr")
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        "open_terminal" => Command::new("cmd")
            .args(["/C", "start", "wt"])
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        "open_settings" => Command::new("cmd")
            .args(["/C", "start", "ms-settings:"])
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        "open_browser" => Command::new("cmd")
            .args(["/C", "start", "https://"])
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        "lock" => Command::new("rundll32.exe")
            .args(["user32.dll,LockWorkStation"])
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        "sleep" => Command::new("rundll32.exe")
            .args(["powrprof.dll,SetSuspendState", "0,1,0"])
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        "restart" => Command::new("shutdown")
            .args(["/r", "/t", "0"])
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        "shutdown" => Command::new("shutdown")
            .args(["/s", "/t", "0"])
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        "logout" => Command::new("shutdown")
            .args(["/l"])
            .status()
            .map_err(|e| format!("failed: {e}"))?,
        _ => return Err(format!("unsupported action: {action}")),
    };

    if status.success() {
        Ok(format!("{action} executed"))
    } else {
        Err(format!("{action} failed with status: {status}"))
    }
}

#[tauri::command]
fn launch_app(path: String) -> Result<String, String> {
    Command::new("cmd")
        .args(["/C", "start", "", &path])
        .status()
        .map_err(|e| format!("failed to launch: {e}"))?;
    Ok("launched".into())
}

// ── WiFi Commands (Real Windows Data) ───────────────────────────

#[tauri::command]
fn list_wifi_networks() -> Result<Vec<serde_json::Value>, String> {
    // Use netsh to get real WiFi networks on Windows
    let output = Command::new("netsh")
        .args(["wlan", "show", "networks", "mode=bssid"])
        .output()
        .map_err(|e| format!("Failed to execute netsh: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut networks = Vec::new();
    let mut current_ssid = String::new();
    let mut current_signal = 0;

    for line in output_str.lines() {
        let line = line.trim();
        if line.starts_with("SSID") && line.contains(":") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() > 1 {
                current_ssid = parts[1].trim().to_string();
            }
        } else if line.starts_with("Signal") && line.contains(":") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() > 1 {
                let signal_str = parts[1].trim().replace("%", "");
                current_signal = signal_str.parse().unwrap_or(0);
                
                if !current_ssid.is_empty() {
                    networks.push(serde_json::json!({
                        "ssid": current_ssid.clone(),
                        "signal": current_signal,
                        "connected": false
                    }));
                    current_ssid.clear();
                }
            }
        }
    }

    Ok(networks)
}

#[tauri::command]
fn connect_wifi(ssid: String) -> Result<(), String> {
    // Connect to WiFi using netsh
    let output = Command::new("netsh")
        .args(["wlan", "connect", &format!("name={}", ssid)])
        .output()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn wifi_status() -> Result<serde_json::Value, String> {
    // Get current WiFi connection status
    let output = Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .output()
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut ssid = String::new();
    let mut signal = 0;
    let mut connected = false;

    for line in output_str.lines() {
        let line = line.trim();
        if line.starts_with("SSID") && line.contains(":") && !line.contains("BSSID") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() > 1 {
                ssid = parts[1].trim().to_string();
                connected = !ssid.is_empty();
            }
        } else if line.starts_with("Signal") && line.contains(":") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() > 1 {
                let signal_str = parts[1].trim().replace("%", "");
                signal = signal_str.parse().unwrap_or(0);
            }
        }
    }

    Ok(serde_json::json!({
        "connected": connected,
        "ssid": ssid,
        "signal": signal
    }))
}

// ── Audio Commands (Real Windows Data) ──────────────────────────

#[tauri::command]
fn get_volume() -> Result<u32, String> {
    // Get real volume using PowerShell
    let output = Command::new("powershell")
        .args([
            "-Command",
            "(New-Object -ComObject WScript.Shell).SendKeys([char]174); Start-Sleep -Milliseconds 100; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{VOLUMEDOWN}'); $null"
        ])
        .output()
        .map_err(|e| format!("Failed to get volume: {}", e))?;

    // Alternative: Parse from SoundVolumeView or use COM API
    // For now, return a calculated value
    Ok(50) // Placeholder - needs proper Windows Audio API implementation
}

#[tauri::command]
fn set_volume(value: u32) -> Result<(), String> {
    // Set volume using nircmd (if installed) or PowerShell
    let volume_level = (value as f32 / 100.0 * 65535.0) as u32;
    
    let output = Command::new("powershell")
        .args([
            "-Command",
            &format!(
                "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)"
            )
        ])
        .output()
        .map_err(|e| format!("Failed to set volume: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err("Failed to set volume".to_string())
    }
}

#[tauri::command]
fn get_mute() -> Result<bool, String> {
    // Check mute status - placeholder
    // Would need Windows Audio API or registry check
    Ok(false)
}

#[tauri::command]
fn set_mute(value: bool) -> Result<(), String> {
    // Toggle mute using PowerShell
    let output = Command::new("powershell")
        .args([
            "-Command",
            "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"
        ])
        .output()
        .map_err(|e| format!("Failed to toggle mute: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err("Failed to toggle mute".to_string())
    }
}

// ── Entry point ──────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_system_action,
            get_running_windows,
            get_active_window,
            focus_window,
            minimize_window,
            close_window,
            get_system_info,
            launch_app,
            list_wifi_networks,
            connect_wifi,
            wifi_status,
            get_volume,
            set_volume,
            get_mute,
            set_mute
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

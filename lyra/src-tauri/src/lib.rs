use std::process::Command;
use serde::Serialize;
use sysinfo::System;
use std::ffi::c_void;
use std::collections::HashMap;

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::*;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::*;
#[cfg(target_os = "windows")]
use windows::Win32::System::Threading::*;
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::*;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::*;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::Endpoints::*;

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
    let output = Command::new("netsh")
        .args(["wlan", "show", "networks", "mode=bssid"])
        .output()
        .map_err(|e| format!("Failed to execute netsh: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut networks_map: HashMap<String, u32> = HashMap::new();
    let mut current_ssid = String::new();
    let current_wifi = wifi_status()?;
    let connected_ssid = current_wifi["ssid"].as_str().unwrap_or_default().to_string();

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
                let current_signal = signal_str.parse().unwrap_or(0);

                if !current_ssid.is_empty() {
                    let existing = networks_map.entry(current_ssid.clone()).or_insert(0);
                    if current_signal > *existing {
                        *existing = current_signal;
                    }
                    current_ssid.clear();
                }
            }
        }
    }

    let mut networks: Vec<serde_json::Value> = networks_map
        .into_iter()
        .map(|(ssid, signal)| {
            serde_json::json!({
                "ssid": ssid,
                "signal": signal,
                "connected": !connected_ssid.is_empty() && connected_ssid == ssid
            })
        })
        .collect();

    networks.sort_by(|a, b| {
        let sa = a["signal"].as_u64().unwrap_or(0);
        let sb = b["signal"].as_u64().unwrap_or(0);
        sb.cmp(&sa)
    });

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

#[cfg(target_os = "windows")]
fn with_endpoint_volume<T, F>(f: F) -> Result<T, String>
where
    F: FnOnce(&IAudioEndpointVolume) -> Result<T, String>,
{
    unsafe {
        let mut initialized = false;
        let init_hr = CoInitializeEx(None, COINIT_MULTITHREADED);
        if init_hr.is_ok() {
            initialized = true;
        } else if init_hr != RPC_E_CHANGED_MODE {
            return Err(format!("COM init failed: {init_hr:?}"));
        }

        let result = (|| -> Result<T, String> {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                    .map_err(|e| format!("Audio enumerator error: {e}"))?;

            let device = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .map_err(|e| format!("Default audio device error: {e}"))?;

            let endpoint: IAudioEndpointVolume = device
                .Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
                .map_err(|e| format!("Audio endpoint activation error: {e}"))?;

            f(&endpoint)
        })();

        if initialized {
            CoUninitialize();
        }

        result
    }
}

#[tauri::command]
fn get_volume() -> Result<u32, String> {
    #[cfg(target_os = "windows")]
    {
        with_endpoint_volume(|endpoint| {
            let scalar = unsafe {
                endpoint
                    .GetMasterVolumeLevelScalar()
                    .map_err(|e| format!("Read volume failed: {e}"))?
            };
            Ok((scalar.clamp(0.0, 1.0) * 100.0).round() as u32)
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(50)
    }
}

#[tauri::command]
fn set_volume(value: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let clamped = value.min(100) as f32 / 100.0;
        with_endpoint_volume(|endpoint| unsafe {
            endpoint
                .SetMasterVolumeLevelScalar(clamped, std::ptr::null())
                .map_err(|e| format!("Set volume failed: {e}"))?;
            Ok(())
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[tauri::command]
fn get_mute() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        with_endpoint_volume(|endpoint| {
            let muted = unsafe {
                endpoint
                    .GetMute()
                    .map_err(|e| format!("Read mute failed: {e}"))?
            };
            Ok(muted.as_bool())
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
fn set_mute(value: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        with_endpoint_volume(|endpoint| unsafe {
            endpoint
                .SetMute(BOOL::from(value), std::ptr::null())
                .map_err(|e| format!("Set mute failed: {e}"))?;
            Ok(())
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
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

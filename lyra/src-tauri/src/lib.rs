mod auth;
mod lockdown;

use std::collections::{HashMap, HashSet};
use std::ffi::c_void;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use sysinfo::{Networks, System};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
use windows::core::{PCWSTR, PWSTR};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::*;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::Endpoints::*;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::*;
#[cfg(target_os = "windows")]
use windows::Win32::NetworkManagement::WiFi::*;
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::*;
#[cfg(target_os = "windows")]
use windows::Win32::System::Threading::*;
#[cfg(target_os = "windows")]
use windows::Win32::UI::Shell::ShellExecuteW;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::*;

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static ACTION_LAST_RUN: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
static SYSTEM: OnceLock<Mutex<System>> = OnceLock::new();

#[derive(Serialize, Clone, Debug)]
pub struct DiagnosticsInfo {
    pub log_path: String,
}

fn append_diag_log(level: &str, message: impl AsRef<str>) {
    let ts = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let line = format!("[{ts}] [{level}] {}\n", message.as_ref());
    let path = LOG_PATH
        .get()
        .cloned()
        .unwrap_or_else(|| std::env::temp_dir().join("lyra.log"));

    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(line.as_bytes());
    }
}

fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown location".to_string());
        append_diag_log("PANIC", format!("{info} at {location}"));
    }));
}

fn throttle_action(key: &str, min_interval: Duration) -> Result<(), String> {
    let mut last_run = ACTION_LAST_RUN
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| "action throttle lock poisoned".to_string())?;

    let now = Instant::now();
    if let Some(previous) = last_run.get(key) {
        if now.duration_since(*previous) < min_interval {
            append_diag_log("WARN", format!("throttled repeated action: {key}"));
            return Err(format!("{key} was requested too quickly"));
        }
    }
    last_run.insert(key.to_string(), now);
    Ok(())
}

#[cfg(target_os = "windows")]
fn wide_null(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(Some(0)).collect()
}

#[cfg(target_os = "windows")]
fn toggle_native_lock(disable: bool) {
    let val = if disable { "1" } else { "0" };
    let args = format!(
        "add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System /v DisableLockWorkstation /t REG_DWORD /d {} /f",
        val
    );
    let _ = shell_execute_operation("runas", "reg.exe", Some(&args));
}

#[cfg(target_os = "windows")]
fn start_hotkey_listener(app_handle: tauri::AppHandle) {
    // using Tauri Manager to emit
    use tauri::Emitter;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LWIN, VK_RWIN};
    std::thread::spawn(move || {
        let mut pressed = false;
        loop {
            unsafe {
                let win_down = (GetAsyncKeyState(VK_LWIN.0 as i32) as i16) < 0
                    || (GetAsyncKeyState(VK_RWIN.0 as i32) as i16) < 0;
                let l_down = (GetAsyncKeyState(0x4C) as i16) < 0;

                if win_down && l_down {
                    if !pressed {
                        pressed = true;
                        let _ = app_handle.emit("trigger-lyra-lock", ());
                    }
                } else {
                    pressed = false;
                }
            }
            std::thread::sleep(Duration::from_millis(30)); // 30ms heartbeat
        }
    });
}

#[cfg(target_os = "windows")]
fn shell_execute(target: &str, parameters: Option<&str>) -> Result<(), String> {
    shell_execute_operation("open", target, parameters)
}

#[cfg(target_os = "windows")]
fn shell_execute_operation(
    operation: &str,
    target: &str,
    parameters: Option<&str>,
) -> Result<(), String> {
    let operation = wide_null(operation);
    let target = wide_null(target);
    let params = parameters.map(wide_null);

    let result = unsafe {
        ShellExecuteW(
            HWND::default(),
            PCWSTR(operation.as_ptr()),
            PCWSTR(target.as_ptr()),
            params
                .as_ref()
                .map(|p| PCWSTR(p.as_ptr()))
                .unwrap_or(PCWSTR::null()),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };

    if (result.0 as isize) <= 32 {
        Err(format!(
            "ShellExecute failed with code {}",
            result.0 as isize
        ))
    } else {
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn shell_execute_elevated(target: &str, parameters: Option<&str>) -> Result<(), String> {
    shell_execute_operation("runas", target, parameters)
}

fn command_no_window(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn command_output_no_window(program: &str, args: &[&str]) -> Result<std::process::Output, String> {
    command_no_window(program)
        .args(args)
        .output()
        .map_err(|e| format!("failed to execute {program}: {e}"))
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(target_os = "windows")]
fn set_enterprise_eap_credentials(
    profile_name: &str,
    username: &str,
    password: &str,
) -> Result<(), String> {
    let (domain, user_name) = username
        .split_once('\\')
        .map(|(domain, user)| (domain.to_string(), user.to_string()))
        .unwrap_or_else(|| (String::new(), username.to_string()));

    let escaped_username = xml_escape(&user_name);
    let escaped_password = xml_escape(password);
    let escaped_domain = xml_escape(&domain);
    let escaped_routing_identity = xml_escape(username);

    let eap_user_xml = format!(
        r#"<?xml version="1.0"?>
<EapHostUserCredentials xmlns="http://www.microsoft.com/provisioning/EapHostUserCredentials"
  xmlns:eapCommon="http://www.microsoft.com/provisioning/EapCommon"
  xmlns:baseEap="http://www.microsoft.com/provisioning/BaseEapMethodUserCredentials">
  <EapMethod>
    <eapCommon:Type>25</eapCommon:Type>
    <eapCommon:AuthorId>0</eapCommon:AuthorId>
  </EapMethod>
  <Credentials xmlns:eapUser="http://www.microsoft.com/provisioning/EapUserPropertiesV1"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:baseEap="http://www.microsoft.com/provisioning/BaseEapUserPropertiesV1"
    xmlns:MsPeap="http://www.microsoft.com/provisioning/MsPeapUserPropertiesV1"
    xmlns:MsChapV2="http://www.microsoft.com/provisioning/MsChapV2UserPropertiesV1">
    <baseEap:Eap>
      <baseEap:Type>25</baseEap:Type>
      <MsPeap:EapType>
        <MsPeap:RoutingIdentity>{escaped_routing_identity}</MsPeap:RoutingIdentity>
        <baseEap:Eap>
          <baseEap:Type>26</baseEap:Type>
          <MsChapV2:EapType>
            <MsChapV2:Username>{escaped_username}</MsChapV2:Username>
            <MsChapV2:Password>{escaped_password}</MsChapV2:Password>
            <MsChapV2:LogonDomain>{escaped_domain}</MsChapV2:LogonDomain>
          </MsChapV2:EapType>
        </baseEap:Eap>
      </MsPeap:EapType>
    </baseEap:Eap>
  </Credentials>
</EapHostUserCredentials>"#
    );

    unsafe {
        let mut negotiated_version = 0;
        let mut client_handle = HANDLE::default();
        let open_result = WlanOpenHandle(2, None, &mut negotiated_version, &mut client_handle);
        if open_result != 0 {
            return Err(format!("WlanOpenHandle failed: {open_result}"));
        }

        let result = (|| {
            let mut interface_list: *mut WLAN_INTERFACE_INFO_LIST = std::ptr::null_mut();
            let enum_result = WlanEnumInterfaces(client_handle, None, &mut interface_list);
            if enum_result != 0 {
                return Err(format!("WlanEnumInterfaces failed: {enum_result}"));
            }
            if interface_list.is_null() {
                return Err("No WiFi interfaces found".to_string());
            }

            let list = &*interface_list;
            let info_ptr = list.InterfaceInfo.as_ptr();
            let profile_w = wide_null(profile_name);
            let eap_w = wide_null(&eap_user_xml);
            let mut last_error = None;

            for index in 0..list.dwNumberOfItems {
                let interface_info = *info_ptr.add(index as usize);
                let set_result = WlanSetProfileEapXmlUserData(
                    client_handle,
                    &interface_info.InterfaceGuid,
                    PCWSTR(profile_w.as_ptr()),
                    WLAN_SET_EAPHOST_FLAGS(0),
                    PCWSTR(eap_w.as_ptr()),
                    None,
                );
                if set_result == 0 {
                    WlanFreeMemory(interface_list as _);
                    return Ok(());
                }
                last_error = Some(set_result);
            }

            WlanFreeMemory(interface_list as _);
            Err(format!(
                "WlanSetProfileEapXmlUserData failed: {}",
                last_error.unwrap_or(0)
            ))
        })();

        let _ = WlanCloseHandle(client_handle, None);
        result
    }
}

// ── Data structures ──────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct WindowInfo {
    pub hwnd: i64,
    pub title: String,
    pub process_name: String,
    pub process_path: String,
    pub pid: u32,
}

#[derive(Serialize, Clone, Debug)]
pub struct SystemInfoData {
    pub cpu_usage: f32,
    pub memory_used_gb: f32,
    pub memory_total_gb: f32,
    pub memory_percent: f32,
}

#[derive(Serialize, Clone, Debug)]
pub struct NetworkCounters {
    pub rx_bytes: u64,
    pub tx_bytes: u64,
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
fn get_process_path_from_pid(pid: u32) -> String {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        if let Ok(handle) = handle {
            let mut buffer = [0u16; 1024];
            let mut size = buffer.len() as u32;
            let result = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_FORMAT(0),
                PWSTR(buffer.as_mut_ptr()),
                &mut size,
            );
            let _ = CloseHandle(handle);
            if result.is_ok() && size > 0 {
                return String::from_utf16_lossy(&buffer[..size as usize]);
            }
        }
        String::new()
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
            "Progman"
                | "WorkerW"
                | "Shell_TrayWnd"
                | "Shell_SecondaryTrayWnd"
                | "DV2ControlHost"
                | "Windows.UI.Core.CoreWindow"
        ) {
            return BOOL(1);
        }
    }

    let mut pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    let process_name = get_process_name_from_pid(pid);
    let process_path = get_process_path_from_pid(pid);

    list.push(WindowInfo {
        hwnd: hwnd.0 as usize as i64,
        title,
        process_name,
        process_path,
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
            let process_path = get_process_path_from_pid(pid);

            Some(WindowInfo {
                hwnd: hwnd.0 as usize as i64,
                title,
                process_name,
                process_path,
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
    let mut sys = SYSTEM
        .get_or_init(|| {
            let mut sys = System::new();
            sys.refresh_cpu_all();
            sys.refresh_memory();
            Mutex::new(sys)
        })
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());

    sys.refresh_cpu_all();
    sys.refresh_memory();

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
    throttle_action(action, Duration::from_millis(900))?;
    append_diag_log("INFO", format!("system action requested: {action}"));

    #[cfg(target_os = "windows")]
    match action {
        "open_explorer" => shell_execute("explorer.exe", None)?,
        "open_task_manager" => shell_execute("taskmgr.exe", None)?,
        "open_terminal" => {
            shell_execute("wt.exe", None).or_else(|_| shell_execute("powershell.exe", None))?
        }
        "open_settings" => shell_execute("ms-settings:", None)?,
        "open_browser" => shell_execute("https://www.bing.com", None)?,
        "lock" => {
            let status = command_no_window("rundll32.exe")
                .args(["user32.dll,LockWorkStation"])
                .status()
                .map_err(|e| format!("failed to lock workstation: {e}"))?;
            if !status.success() {
                return Err(format!("lock failed with status: {status}"));
            }
        }
        "sleep" => {
            let status = command_no_window("rundll32.exe")
                .args(["powrprof.dll,SetSuspendState", "0,1,0"])
                .status()
                .map_err(|e| format!("failed to sleep: {e}"))?;
            if !status.success() {
                return Err(format!("sleep failed with status: {status}"));
            }
        }
        "restart" => {
            let status = command_no_window("shutdown")
                .args(["/r", "/t", "0"])
                .status()
                .map_err(|e| format!("failed to restart: {e}"))?;
            if !status.success() {
                return Err(format!("restart failed with status: {status}"));
            }
        }
        "shutdown" => {
            let status = command_no_window("shutdown")
                .args(["/s", "/t", "0"])
                .status()
                .map_err(|e| format!("failed to shutdown: {e}"))?;
            if !status.success() {
                return Err(format!("shutdown failed with status: {status}"));
            }
        }
        "logout" => {
            let status = command_no_window("shutdown")
                .args(["/l"])
                .status()
                .map_err(|e| format!("failed to log out: {e}"))?;
            if !status.success() {
                return Err(format!("logout failed with status: {status}"));
            }
        }
        _ => return Err(format!("unsupported action: {action}")),
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err(format!("unsupported action on this platform: {action}"));
    }

    Ok(format!("{action} executed"))
}

#[tauri::command]
fn open_datetime_settings() -> Result<(), String> {
    throttle_action("datetime:settings", Duration::from_secs(2))?;

    #[cfg(target_os = "windows")]
    shell_execute("ms-settings:dateandtime", None)?;

    #[cfg(not(target_os = "windows"))]
    return Err("Date and time settings are only implemented on Windows".to_string());

    Ok(())
}

#[tauri::command]
fn set_system_datetime(value: String) -> Result<(), String> {
    let trimmed = value.trim();
    if trimmed.len() != 16 || !trimmed.contains('T') {
        return Err("Expected datetime-local value like 2026-05-09T17:30".to_string());
    }

    throttle_action("datetime:set", Duration::from_secs(2))?;
    let safe_value = trimmed.replace('\'', "''");
    let script = format!(
        "$d=[datetime]::ParseExact('{safe_value}','yyyy-MM-ddTHH:mm',[Globalization.CultureInfo]::InvariantCulture); Set-Date -Date $d"
    );
    let output = command_no_window("powershell")
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
        .output()
        .map_err(|e| format!("failed to set date/time: {e}"))?;

    if output.status.success() {
        append_diag_log("INFO", "system date/time update requested");
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        #[cfg(target_os = "windows")]
        {
            let privilege_error =
                stderr.contains("required privilege") || stderr.contains("Access is denied");
            if privilege_error {
                let script_path = std::env::temp_dir().join("lyra-set-date.ps1");
                std::fs::write(&script_path, &script)
                    .map_err(|e| format!("failed to prepare elevated date/time update: {e}"))?;
                let params = format!(
                    "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{}\"",
                    script_path.display()
                );
                shell_execute_elevated("powershell.exe", Some(&params))?;
                append_diag_log("INFO", "elevated system date/time update requested");
                return Err(
                    "Windows needs administrator approval. Accept the UAC prompt, then reopen the calendar."
                        .to_string(),
                );
            }
        }

        Err(if stderr.is_empty() {
            "Windows rejected the date/time change. Administrator rights may be required."
                .to_string()
        } else {
            stderr
        })
    }
}

#[tauri::command]
fn launch_app(path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("empty app path".to_string());
    }
    throttle_action(&format!("launch:{trimmed}"), Duration::from_millis(900))?;
    append_diag_log("INFO", format!("launch requested: {trimmed}"));

    #[cfg(target_os = "windows")]
    shell_execute(trimmed, None).map_err(|e| format!("failed to launch: {e}"))?;

    #[cfg(not(target_os = "windows"))]
    return Err("launch_app is only implemented on Windows".to_string());

    Ok("launched".into())
}

#[tauri::command]
fn get_app_icon(process_path: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if process_path.trim().is_empty() {
            return Err("empty process path".to_string());
        }

        let escaped = process_path.replace('\'', "''");
        let script = format!(
            "Add-Type -AssemblyName System.Drawing; \
            $icon=[System.Drawing.Icon]::ExtractAssociatedIcon('{escaped}'); \
            if($null -eq $icon){{exit 1}}; \
            $bmp=$icon.ToBitmap(); \
            $ms=New-Object System.IO.MemoryStream; \
            $bmp.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png); \
            [Convert]::ToBase64String($ms.ToArray())"
        );

        let output = command_no_window("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .output()
            .map_err(|e| format!("failed to extract icon: {e}"))?;

        if !output.status.success() {
            return Err("icon extraction command failed".to_string());
        }

        let b64 = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if b64.is_empty() {
            return Err("empty icon result".to_string());
        }

        Ok(format!("data:image/png;base64,{b64}"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("not on windows".to_string())
    }
}

// ── WiFi Commands (Real Windows Data) ───────────────────────────

fn get_saved_wifi_profiles() -> Result<HashSet<String>, String> {
    let output = command_output_no_window("netsh", &["wlan", "show", "profiles"])?;
    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut profiles = HashSet::new();

    for line in output_str.lines() {
        let line = line.trim();
        if line.contains("All User Profile") && line.contains(':') {
            if let Some((_, name)) = line.split_once(':') {
                let profile = name.trim();
                if !profile.is_empty() {
                    profiles.insert(profile.to_string());
                }
            }
        }
    }

    Ok(profiles)
}

#[tauri::command]
fn list_wifi_networks() -> Result<Vec<serde_json::Value>, String> {
    let output = command_output_no_window("netsh", &["wlan", "show", "networks", "mode=bssid"])?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut networks_map: HashMap<String, (u32, String, String)> = HashMap::new();
    let saved_profiles = get_saved_wifi_profiles().unwrap_or_default();
    let mut current_ssid = String::new();
    let mut current_auth = String::new();
    let mut current_encryption = String::new();
    let current_wifi = wifi_status()?;
    let connected_ssid = current_wifi["ssid"]
        .as_str()
        .unwrap_or_default()
        .to_string();

    for line in output_str.lines() {
        let line = line.trim();
        if line.starts_with("SSID") && line.contains(":") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() > 1 {
                current_ssid = parts[1].trim().to_string();
                current_auth.clear();
                current_encryption.clear();
            }
        } else if line.starts_with("Authentication") && line.contains(":") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() > 1 {
                current_auth = parts[1].trim().to_string();
            }
        } else if line.starts_with("Encryption") && line.contains(":") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() > 1 {
                current_encryption = parts[1].trim().to_string();
            }
        } else if line.starts_with("Signal") && line.contains(":") {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() > 1 {
                let signal_str = parts[1].trim().replace("%", "");
                let current_signal = signal_str.parse().unwrap_or(0);

                if !current_ssid.is_empty() {
                    let existing = networks_map.entry(current_ssid.clone()).or_insert((
                        0,
                        current_auth.clone(),
                        current_encryption.clone(),
                    ));
                    if current_signal > existing.0 {
                        *existing = (
                            current_signal,
                            current_auth.clone(),
                            current_encryption.clone(),
                        );
                    }
                    current_ssid.clear();
                }
            }
        }
    }

    let mut networks: Vec<serde_json::Value> = networks_map
        .into_iter()
        .map(|(ssid, (signal, auth, encryption))| {
            let auth_lower = auth.to_lowercase();
            let enterprise = auth_lower.contains("enterprise") || auth_lower.contains("802.1x");
            let secure = !auth_lower.contains("open");
            let saved = saved_profiles.contains(&ssid);
            serde_json::json!({
                "ssid": ssid,
                "signal": signal,
                "auth": auth,
                "encryption": encryption,
                "secure": secure,
                "enterprise": enterprise,
                "requiresIdentity": enterprise,
                "requiresPassword": secure,
                "saved": saved,
                "visible": true,
                "connected": !connected_ssid.is_empty() && connected_ssid == ssid
            })
        })
        .collect();

    for profile in saved_profiles {
        let exists = networks
            .iter()
            .any(|network| network["ssid"].as_str() == Some(profile.as_str()));
        if !exists {
            networks.push(serde_json::json!({
                "ssid": profile,
                "signal": 0,
                "auth": "Saved",
                "encryption": "",
                "secure": true,
                "enterprise": false,
                "requiresIdentity": false,
                "requiresPassword": true,
                "saved": true,
                "visible": false,
                "connected": !connected_ssid.is_empty() && connected_ssid == profile
            }));
        }
    }

    networks.sort_by(|a, b| {
        let ac = a["connected"].as_bool().unwrap_or(false);
        let bc = b["connected"].as_bool().unwrap_or(false);
        let av = a["visible"].as_bool().unwrap_or(false);
        let bv = b["visible"].as_bool().unwrap_or(false);
        let asaved = a["saved"].as_bool().unwrap_or(false);
        let bsaved = b["saved"].as_bool().unwrap_or(false);
        let sa = a["signal"].as_u64().unwrap_or(0);
        let sb = b["signal"].as_u64().unwrap_or(0);

        bc.cmp(&ac)
            .then_with(|| bv.cmp(&av))
            .then_with(|| sb.cmp(&sa))
            .then_with(|| bsaved.cmp(&asaved))
            .then_with(|| {
                a["ssid"]
                    .as_str()
                    .unwrap_or_default()
                    .cmp(b["ssid"].as_str().unwrap_or_default())
            })
    });

    Ok(networks)
}

#[tauri::command]
fn connect_wifi(ssid: String) -> Result<(), String> {
    // Connect to WiFi using netsh
    throttle_action(&format!("wifi:connect:{ssid}"), Duration::from_secs(3))?;
    let profile = format!("name={ssid}");
    let output = command_output_no_window("netsh", &["wlan", "connect", &profile])?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn connect_wifi_with_password(
    ssid: String,
    password: String,
    auth: Option<String>,
    encryption: Option<String>,
) -> Result<(), String> {
    let ssid = ssid.trim().to_string();
    let password = password.trim().to_string();
    if ssid.is_empty() {
        return Err("SSID is required".to_string());
    }

    let auth_label = auth.unwrap_or_default();
    let encryption_label = encryption.unwrap_or_default();
    let auth_lower = auth_label.to_lowercase();
    let is_open = auth_lower.contains("open");

    if !is_open && password.len() < 8 {
        return Err("WiFi password must be at least 8 characters".to_string());
    }

    throttle_action(&format!("wifi:join:{ssid}"), Duration::from_secs(3))?;

    let auth_value = if is_open {
        "open"
    } else if auth_lower.contains("wpa3") {
        "WPA3SAE"
    } else if auth_lower.contains("wpa2") {
        "WPA2PSK"
    } else if auth_lower.contains("wpa") {
        "WPAPSK"
    } else {
        "WPA2PSK"
    };

    let encryption_lower = encryption_label.to_lowercase();
    let encryption_value = if is_open {
        "none"
    } else if encryption_lower.contains("tkip") {
        "TKIP"
    } else {
        "AES"
    };

    let escaped_ssid = xml_escape(&ssid);
    let profile = if is_open {
        format!(
            r#"<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>{escaped_ssid}</name>
  <SSIDConfig><SSID><name>{escaped_ssid}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>manual</connectionMode>
  <MSM><security><authEncryption><authentication>open</authentication><encryption>none</encryption><useOneX>false</useOneX></authEncryption></security></MSM>
</WLANProfile>"#
        )
    } else {
        let escaped_password = xml_escape(&password);
        format!(
            r#"<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>{escaped_ssid}</name>
  <SSIDConfig><SSID><name>{escaped_ssid}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>manual</connectionMode>
  <MSM>
    <security>
      <authEncryption><authentication>{auth_value}</authentication><encryption>{encryption_value}</encryption><useOneX>false</useOneX></authEncryption>
      <sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>{escaped_password}</keyMaterial></sharedKey>
    </security>
  </MSM>
</WLANProfile>"#
        )
    };

    let safe_name: String = ssid
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let profile_path = std::env::temp_dir().join(format!("lyra-wifi-{safe_name}.xml"));
    std::fs::write(&profile_path, profile).map_err(|e| format!("failed to write profile: {e}"))?;

    let profile_path_string = profile_path.display().to_string();
    let add_output = command_output_no_window(
        "netsh",
        &[
            "wlan",
            "add",
            "profile",
            &format!("filename={profile_path_string}"),
        ],
    );
    let _ = std::fs::remove_file(&profile_path);
    let add_output = add_output?;

    if !add_output.status.success() {
        return Err(String::from_utf8_lossy(&add_output.stderr).to_string());
    }

    connect_wifi(ssid)
}

#[tauri::command]
fn connect_enterprise_wifi(ssid: String, username: String, password: String) -> Result<(), String> {
    let ssid = ssid.trim().to_string();
    let username = username.trim().to_string();
    let password = password.trim().to_string();
    if ssid.is_empty() {
        return Err("SSID is required".to_string());
    }
    if username.is_empty() {
        return Err("Username is required".to_string());
    }
    if password.is_empty() {
        return Err("Password is required".to_string());
    }

    throttle_action(&format!("wifi:enterprise:{ssid}"), Duration::from_secs(3))?;

    let escaped_ssid = xml_escape(&ssid);
    let profile = format!(
        r#"<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>{escaped_ssid}</name>
  <SSIDConfig><SSID><name>{escaped_ssid}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>manual</connectionMode>
  <MSM>
    <security>
      <authEncryption><authentication>WPA2</authentication><encryption>AES</encryption><useOneX>true</useOneX></authEncryption>
      <OneX xmlns="http://www.microsoft.com/networking/OneX/v1">
        <cacheUserData>true</cacheUserData>
        <authMode>user</authMode>
        <EAPConfig>
          <EapHostConfig xmlns="http://www.microsoft.com/provisioning/EapHostConfig">
            <EapMethod><Type xmlns="http://www.microsoft.com/provisioning/EapCommon">25</Type><VendorId xmlns="http://www.microsoft.com/provisioning/EapCommon">0</VendorId><VendorType xmlns="http://www.microsoft.com/provisioning/EapCommon">0</VendorType><AuthorId xmlns="http://www.microsoft.com/provisioning/EapCommon">0</AuthorId></EapMethod>
            <Config xmlns="http://www.microsoft.com/provisioning/EapHostConfig">
              <Eap xmlns="http://www.microsoft.com/provisioning/BaseEapConnectionPropertiesV1">
                <Type>25</Type>
                <EapType xmlns="http://www.microsoft.com/provisioning/MsPeapConnectionPropertiesV1">
                  <ServerValidation><DisableUserPromptForServerValidation>false</DisableUserPromptForServerValidation></ServerValidation>
                  <FastReconnect>true</FastReconnect>
                  <InnerEapOptional>false</InnerEapOptional>
                  <Eap xmlns="http://www.microsoft.com/provisioning/BaseEapConnectionPropertiesV1">
                    <Type>26</Type>
                    <EapType xmlns="http://www.microsoft.com/provisioning/MsChapV2ConnectionPropertiesV1"><UseWinLogonCredentials>false</UseWinLogonCredentials></EapType>
                  </Eap>
                  <EnableQuarantineChecks>false</EnableQuarantineChecks>
                  <RequireCryptoBinding>false</RequireCryptoBinding>
                </EapType>
              </Eap>
            </Config>
          </EapHostConfig>
        </EAPConfig>
      </OneX>
    </security>
  </MSM>
</WLANProfile>"#
    );

    let safe_name: String = ssid
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let profile_path = std::env::temp_dir().join(format!("lyra-enterprise-wifi-{safe_name}.xml"));
    std::fs::write(&profile_path, profile).map_err(|e| format!("failed to write profile: {e}"))?;

    let profile_path_string = profile_path.display().to_string();
    let add_output = command_output_no_window(
        "netsh",
        &[
            "wlan",
            "add",
            "profile",
            &format!("filename={profile_path_string}"),
        ],
    );
    let _ = std::fs::remove_file(&profile_path);
    let add_output = add_output?;

    if !add_output.status.success() {
        return Err(String::from_utf8_lossy(&add_output.stderr).to_string());
    }

    set_enterprise_eap_credentials(&ssid, &username, &password)?;

    append_diag_log(
        "INFO",
        format!("enterprise WiFi profile prepared for {ssid}"),
    );
    connect_wifi(ssid)
}

#[tauri::command]
fn disconnect_wifi() -> Result<(), String> {
    throttle_action("wifi:disconnect", Duration::from_secs(2))?;
    let output = command_output_no_window("netsh", &["wlan", "disconnect"])?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn forget_wifi(ssid: String) -> Result<(), String> {
    let ssid = ssid.trim().to_string();
    if ssid.is_empty() {
        return Err("SSID is required".to_string());
    }

    throttle_action(&format!("wifi:forget:{ssid}"), Duration::from_secs(2))?;
    let output = command_output_no_window(
        "netsh",
        &["wlan", "delete", "profile", &format!("name={ssid}")],
    )?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn open_wifi_settings() -> Result<(), String> {
    throttle_action("wifi:settings", Duration::from_secs(2))?;

    #[cfg(target_os = "windows")]
    shell_execute("ms-settings:network-wifi", None)?;

    #[cfg(not(target_os = "windows"))]
    return Err("WiFi settings are only implemented on Windows".to_string());

    Ok(())
}

#[tauri::command]
fn wifi_status() -> Result<serde_json::Value, String> {
    // Get current WiFi connection status
    let output = command_output_no_window("netsh", &["wlan", "show", "interfaces"])?;

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

#[tauri::command]
fn get_network_counters() -> Result<NetworkCounters, String> {
    let mut networks = Networks::new_with_refreshed_list();
    networks.refresh();

    let mut rx_bytes: u64 = 0;
    let mut tx_bytes: u64 = 0;

    for (name, data) in &networks {
        let lname = name.to_lowercase();
        if lname.contains("loopback")
            || lname.contains("vethernet")
            || lname.contains("virtual")
            || lname.contains("bluetooth")
            || lname.contains("isatap")
            || lname.contains("teredo")
        {
            continue;
        }

        rx_bytes = rx_bytes.saturating_add(data.total_received());
        tx_bytes = tx_bytes.saturating_add(data.total_transmitted());
    }

    Ok(NetworkCounters { rx_bytes, tx_bytes })
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

#[tauri::command]
fn log_frontend_error(message: String, source: Option<String>) {
    let source = source.unwrap_or_else(|| "frontend".to_string());
    append_diag_log("FRONTEND", format!("{source}: {message}"));
}

#[tauri::command]
fn get_diagnostics_info() -> DiagnosticsInfo {
    DiagnosticsInfo {
        log_path: LOG_PATH
            .get()
            .cloned()
            .unwrap_or_else(|| std::env::temp_dir().join("lyra.log"))
            .display()
            .to_string(),
    }
}

// ── Entry point ──────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_panic_hook();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let log_path = app
                .handle()
                .path()
                .app_log_dir()
                .unwrap_or_else(|_| std::env::temp_dir())
                .join("lyra.log");
            let _ = LOG_PATH.set(log_path);
            append_diag_log("INFO", "Lyra started");

            #[cfg(target_os = "windows")]
            {
                // Disable native Win+L so we can intercept it
                toggle_native_lock(true);
                // Start background thread listening for Win+L
                start_hotkey_listener(app.handle().clone());
            }

            // Prevent closing Lyra while the lock screen is active, and cleanup hooks on destroy.
            if let Some(win) = app.get_webview_window("main") {
                win.on_window_event(move |event| match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        if lockdown::is_locked() {
                            api.prevent_close();
                        }
                    }
                    tauri::WindowEvent::Destroyed => {
                        #[cfg(target_os = "windows")]
                        toggle_native_lock(false);
                    }
                    _ => {}
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            run_system_action,
            open_datetime_settings,
            set_system_datetime,
            get_running_windows,
            get_active_window,
            focus_window,
            minimize_window,
            close_window,
            get_system_info,
            launch_app,
            get_app_icon,
            list_wifi_networks,
            connect_wifi,
            connect_wifi_with_password,
            connect_enterprise_wifi,
            disconnect_wifi,
            forget_wifi,
            open_wifi_settings,
            wifi_status,
            get_network_counters,
            get_volume,
            set_volume,
            get_mute,
            set_mute,
            log_frontend_error,
            get_diagnostics_info,
            auth::get_current_username,
            auth::validate_password,
            auth::check_biometric_available,
            auth::request_biometric_auth,
            lockdown::set_lock_state
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| {
            append_diag_log(
                "FATAL",
                format!("error while running tauri application: {error}"),
            );
        });
}

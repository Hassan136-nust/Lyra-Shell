// ── Authentication module ────────────────────────────────────────
// Handles lock-screen credentials: username, password validation,
// and Windows Hello biometric availability.

#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

#[cfg(target_os = "windows")]
use std::time::Duration;

#[cfg(target_os = "windows")]
use windows::core::HSTRING;
#[cfg(target_os = "windows")]
use windows::Foundation::AsyncStatus;
#[cfg(target_os = "windows")]
use windows::Security::Credentials::UI::{
    UserConsentVerificationResult, UserConsentVerifier,
};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible, SetForegroundWindow,
    SetWindowPos, HWND_TOPMOST, SWP_NOSIZE, SWP_SHOWWINDOW,
    FindWindowW, FindWindowExW, ShowWindow, SW_HIDE, SW_SHOW, MoveWindow, GetWindowRect
};

#[cfg(target_os = "windows")]
fn toggle_taskbar(show: bool) {
    unsafe {
        // Main taskbar
        if let Ok(taskbar) = FindWindowW(
            windows::core::w!("Shell_TrayWnd"),
            windows::core::PCWSTR::null(),
        ) {
            let _ = ShowWindow(taskbar, if show { SW_SHOW } else { SW_HIDE });
        }
        
        // Secondary taskbars
        let mut sec = FindWindowExW(HWND::default(), HWND::default(), windows::core::w!("Shell_SecondaryTrayWnd"), windows::core::PCWSTR::null());
        while let Ok(sec_hwnd) = sec {
            let _ = ShowWindow(sec_hwnd, if show { SW_SHOW } else { SW_HIDE });
            sec = FindWindowExW(HWND::default(), sec_hwnd, windows::core::w!("Shell_SecondaryTrayWnd"), windows::core::PCWSTR::null());
        }
    }
}

#[cfg(target_os = "windows")]
fn bring_windows_security_to_front() -> bool {
    unsafe {
        let hwnd = windows::Win32::UI::WindowsAndMessaging::FindWindowW(
            windows::core::PCWSTR::null(),
            windows::core::w!("Windows Security"),
        );
        if let Ok(h) = hwnd {
            if !h.0.is_null() {
                let mut rect = windows::Win32::Foundation::RECT::default();
                let _ = windows::Win32::UI::WindowsAndMessaging::GetWindowRect(h, &mut rect);
                let w = rect.right - rect.left;
                let h = rect.bottom - rect.top;
                
                let _ = windows::Win32::UI::WindowsAndMessaging::MoveWindow(h, 0, 0, w, h, true);
                let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
                    h,
                    windows::Win32::UI::WindowsAndMessaging::HWND_TOPMOST,
                    0, 0, 0, 0,
                    windows::Win32::UI::WindowsAndMessaging::SWP_NOSIZE | windows::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW,
                );
                let _ = windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow(h);
                return true;
            }
        }
    }
    false
}

/// Return the current Windows username.
#[tauri::command]
pub fn get_current_username() -> String {
    std::env::var("USERNAME").unwrap_or_else(|_| "User".to_string())
}

/// Validate a password against the current Windows user account.
#[tauri::command]
pub async fn validate_password(password: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::*;
        use windows::Win32::Security::*;

        let username = std::env::var("USERNAME").unwrap_or_default();
        let domain = std::env::var("USERDOMAIN").unwrap_or_else(|_| ".".to_string());

        let result = tokio::task::spawn_blocking(move || {
            let user_w: Vec<u16> = std::ffi::OsStr::new(&username)
                .encode_wide()
                .chain(Some(0))
                .collect();
            let domain_w: Vec<u16> = std::ffi::OsStr::new(&domain)
                .encode_wide()
                .chain(Some(0))
                .collect();
            let pass_w: Vec<u16> = std::ffi::OsStr::new(&password)
                .encode_wide()
                .chain(Some(0))
                .collect();

            unsafe {
                let mut token = HANDLE::default();
                let logon_result = LogonUserW(
                    windows::core::PCWSTR(user_w.as_ptr()),
                    windows::core::PCWSTR(domain_w.as_ptr()),
                    windows::core::PCWSTR(pass_w.as_ptr()),
                    LOGON32_LOGON_INTERACTIVE,
                    LOGON32_PROVIDER_DEFAULT,
                    &mut token,
                );

                if logon_result.is_ok() {
                    let _ = CloseHandle(token);
                    true
                } else {
                    false
                }
            }
        }).await.map_err(|e| e.to_string())?;

        Ok(result)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = password;
        Err("password validation only supported on Windows".to_string())
    }
}

/// Check whether Windows Hello (biometric service) is physically available.
/// Fallback to verifying actual PnP Biometric Hardware to avoid false-positives
/// from Windows Hello PIN-only configured devices.
#[tauri::command]
pub async fn check_biometric_available() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        
        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "(@(Get-PnpDevice -Class Biometric -ErrorAction SilentlyContinue | Where-Object Status -eq 'OK')).Count"
            ])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| e.to_string())?;
            
        let stdout = String::from_utf8_lossy(&output.stdout);
        let count: i32 = stdout.trim().parse().unwrap_or(0);
        
        Ok(count > 0)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

/// Request Windows Hello biometric verification.
/// Runs on a background thread and emits a "biometric-result" event
/// with the boolean result to avoid blocking the UI.
#[tauri::command]
pub fn request_biometric_auth(app_handle: tauri::AppHandle) -> Result<(), String> {
    std::thread::spawn(move || {
        let verified: bool;

        #[cfg(target_os = "windows")]
        {
            // Temporarily lower Lyra so the Windows Hello dialog is visible
            use tauri::Manager;
            if let Some(win) = app_handle.get_webview_window("main") {
                let _ = win.set_always_on_top(false);
            }

            toggle_taskbar(false);
            let message = HSTRING::from("Unlock Lyra");
            verified = match UserConsentVerifier::RequestVerificationAsync(&message) {
                Ok(operation) => {
                    loop {
                        let _ = bring_windows_security_to_front();
                        match operation.Status() {
                            Ok(AsyncStatus::Completed)
                            | Ok(AsyncStatus::Canceled)
                            | Ok(AsyncStatus::Error) => break,
                            Ok(_) => std::thread::sleep(Duration::from_millis(80)),
                            Err(_) => break,
                        }
                    }

                    toggle_taskbar(true);

                    operation
                        .GetResults()
                        .map(|result| result == UserConsentVerificationResult::Verified)
                        .unwrap_or(false)
                }
                Err(_) => false,
            };

            // Restore Lyra on top
            if let Some(win) = app_handle.get_webview_window("main") {
                let _ = win.set_always_on_top(true);
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            verified = false;
        }

        // Emit result to frontend
        use tauri::Emitter;
        let _ = app_handle.emit("biometric-result", verified);
    });

    Ok(())
}

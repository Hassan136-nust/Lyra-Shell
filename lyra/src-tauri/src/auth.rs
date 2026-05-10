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
    UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible, SetForegroundWindow,
    SetWindowPos, HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
};

#[cfg(target_os = "windows")]
unsafe extern "system" fn bring_windows_security_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    if !IsWindowVisible(hwnd).as_bool() {
        return BOOL(1);
    }

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
    if title.contains("Windows Security") {
        let found = &mut *(lparam.0 as *mut bool);
        *found = true;
        let _ = SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
        );
        let _ = SetForegroundWindow(hwnd);
        return BOOL(0);
    }

    BOOL(1)
}

#[cfg(target_os = "windows")]
fn bring_windows_security_to_front() -> bool {
    let mut found = false;
    unsafe {
        let _ = EnumWindows(
            Some(bring_windows_security_callback),
            LPARAM(&mut found as *mut bool as isize),
        );
    }
    found
}

/// Return the current Windows username.
#[tauri::command]
pub fn get_current_username() -> String {
    std::env::var("USERNAME").unwrap_or_else(|_| "User".to_string())
}

/// Validate a password against the current Windows user account.
#[tauri::command]
pub fn validate_password(password: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::*;
        use windows::Win32::Security::*;

        let username = std::env::var("USERNAME").unwrap_or_default();
        let domain = std::env::var("USERDOMAIN").unwrap_or_else(|_| ".".to_string());

        let user_w: Vec<u16> = OsStr::new(&username)
            .encode_wide()
            .chain(Some(0))
            .collect();
        let domain_w: Vec<u16> = OsStr::new(&domain)
            .encode_wide()
            .chain(Some(0))
            .collect();
        let pass_w: Vec<u16> = OsStr::new(&password)
            .encode_wide()
            .chain(Some(0))
            .collect();

        unsafe {
            let mut token = HANDLE::default();
            let result = LogonUserW(
                windows::core::PCWSTR(user_w.as_ptr()),
                windows::core::PCWSTR(domain_w.as_ptr()),
                windows::core::PCWSTR(pass_w.as_ptr()),
                LOGON32_LOGON_INTERACTIVE,
                LOGON32_PROVIDER_DEFAULT,
                &mut token,
            );

            if result.is_ok() {
                let _ = CloseHandle(token);
                Ok(true)
            } else {
                Ok(false)
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = password;
        Err("password validation only supported on Windows".to_string())
    }
}

/// Check whether Windows Hello (biometric service) is available.
/// Uses the native Windows Runtime API directly.
#[tauri::command]
pub async fn check_biometric_available() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let available = UserConsentVerifier::CheckAvailabilityAsync()
            .and_then(|operation| operation.get())
            .map(|status| status == UserConsentVerifierAvailability::Available)
            .unwrap_or(false);
        Ok(available)
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

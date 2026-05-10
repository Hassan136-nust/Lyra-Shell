// ── Authentication module ────────────────────────────────────────
// Handles lock-screen credentials: username, password validation,
// and Windows Hello biometric availability.

#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

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
/// Uses `sc query wbiosrvc` — fast and non-blocking (no PowerShell WinRT).
#[tauri::command]
pub fn check_biometric_available() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("sc")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["query", "wbiosrvc"])
            .output()
            .map_err(|e| format!("failed to query biometric service: {e}"))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        // Service is running if output contains "RUNNING"
        Ok(stdout.contains("RUNNING"))
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

            let script = r#"
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    [void][Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
    $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult])
    $op = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync('Unlock Lyra')
    $task = $asTask.Invoke($null, @($op))
    $task.Wait() | Out-Null
    $task.Result.ToString()
} catch {
    'Failed'
}
"#;

            let output = Command::new("powershell")
                .creation_flags(CREATE_NO_WINDOW)
                .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", script])
                .output();

            verified = match output {
                Ok(o) => String::from_utf8_lossy(&o.stdout).trim() == "Verified",
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

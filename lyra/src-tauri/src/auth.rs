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

/// The PowerShell preamble that loads WinRT async helpers.
#[cfg(target_os = "windows")]
const PS_WINRT_PREAMBLE: &str = r#"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
"#;

/// Check whether Windows Hello biometric is available.
#[tauri::command]
pub fn check_biometric_available() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let script = format!(
            r#"
try {{
    {preamble}
    $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])
    $op = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()
    $task = $asTask.Invoke($null, @($op))
    $task.Wait() | Out-Null
    $task.Result.ToString()
}} catch {{
    'NotAvailable'
}}
"#,
            preamble = PS_WINRT_PREAMBLE
        );

        let output = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .output()
            .map_err(|e| format!("failed to check biometric: {e}"))?;

        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(result == "Available")
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

/// Request Windows Hello biometric verification (fingerprint / face / PIN).
#[tauri::command]
pub fn request_biometric_auth(app_handle: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        // Temporarily lower Lyra so the Windows Hello dialog is visible
        use tauri::Manager;
        if let Some(win) = app_handle.get_webview_window("main") {
            let _ = win.set_always_on_top(false);
        }

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let script = format!(
            r#"
try {{
    {preamble}
    $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult])
    $op = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync('Unlock Lyra')
    $task = $asTask.Invoke($null, @($op))
    $task.Wait() | Out-Null
    $task.Result.ToString()
}} catch {{
    'NotConfiguredForUser'
}}
"#,
            preamble = PS_WINRT_PREAMBLE
        );

        let output = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .output()
            .map_err(|e| format!("biometric auth failed: {e}"))?;

        // Restore Lyra on top
        if let Some(win) = app_handle.get_webview_window("main") {
            let _ = win.set_always_on_top(true);
        }

        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(result == "Verified")
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_handle;
        Err("biometric auth only supported on Windows".to_string())
    }
}

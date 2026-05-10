// ── Lockdown module ──────────────────────────────────────────────
// Provides a lock-state flag used to prevent the user from closing
// Lyra while the lock screen is active.

use std::sync::atomic::{AtomicBool, Ordering};

/// True when the lock screen is displayed.
static IS_LOCKED: AtomicBool = AtomicBool::new(false);

pub fn set_locked(locked: bool) {
    IS_LOCKED.store(locked, Ordering::SeqCst);
}

pub fn is_locked() -> bool {
    IS_LOCKED.load(Ordering::SeqCst)
}

/// Called from the frontend when locking / unlocking.
#[tauri::command]
pub fn set_lock_state(app: tauri::AppHandle, locked: bool) {
    set_locked(locked);
    
    // Actively enforce always-on-top and focus to prevent interaction with other apps
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("main") {
        if locked {
            let _ = win.set_always_on_top(true);
            let _ = win.set_fullscreen(true);
            let _ = win.set_focus();
        } else {
            let _ = win.set_always_on_top(false);
            
            // Push Lyra physically to the back of the Z-order so it doesn't block inputs via transparent fullscreen
            #[cfg(target_os = "windows")]
            if let Ok(app_hwnd) = win.hwnd() {
                use windows::Win32::Foundation::HWND;
                use windows::Win32::UI::WindowsAndMessaging::{
                    SetWindowPos, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
                };
                unsafe {
                    let _ = SetWindowPos(
                        HWND(app_hwnd.0 as usize as *mut std::ffi::c_void),
                        HWND_BOTTOM,
                        0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                }
            }
        }
    }
}

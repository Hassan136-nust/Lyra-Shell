// ── Lockdown module ──────────────────────────────────────────────
// Provides a lock-state flag used to prevent the user from closing
// Lyra while the lock screen is active.

use std::sync::atomic::{AtomicBool, Ordering};

/// True when the lock screen is displayed.
static IS_LOCKED: AtomicBool = AtomicBool::new(false);

/// True when biometric auth is in progress.
static IS_BIOMETRIC_ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn set_locked(locked: bool) {
    IS_LOCKED.store(locked, Ordering::SeqCst);
}

pub fn is_locked() -> bool {
    IS_LOCKED.load(Ordering::SeqCst)
}

pub fn set_biometric_active(active: bool) {
    IS_BIOMETRIC_ACTIVE.store(active, Ordering::SeqCst);
}

/// Hide or show the native Windows taskbar.
#[cfg(target_os = "windows")]
pub fn set_taskbar_visible(visible: bool) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowW, FindWindowExW, ShowWindow, SW_HIDE, SW_SHOW,
    };
    unsafe {
        if let Ok(taskbar) = FindWindowW(
            windows::core::w!("Shell_TrayWnd"),
            windows::core::PCWSTR::null(),
        ) {
            let _ = ShowWindow(taskbar, if visible { SW_SHOW } else { SW_HIDE });
        }
        let mut sec = FindWindowExW(
            HWND::default(), HWND::default(),
            windows::core::w!("Shell_SecondaryTrayWnd"),
            windows::core::PCWSTR::null(),
        );
        while let Ok(sec_hwnd) = sec {
            let _ = ShowWindow(sec_hwnd, if visible { SW_SHOW } else { SW_HIDE });
            sec = FindWindowExW(
                HWND::default(), sec_hwnd,
                windows::core::w!("Shell_SecondaryTrayWnd"),
                windows::core::PCWSTR::null(),
            );
        }
    }
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
            // Hide Windows taskbar to prevent any OS shell interaction
            #[cfg(target_os = "windows")]
            set_taskbar_visible(false);
        } else {
            let _ = win.set_always_on_top(false);
            let _ = win.set_focus();
        }
    }
}

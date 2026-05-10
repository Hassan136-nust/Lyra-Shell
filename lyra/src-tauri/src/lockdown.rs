// ── Lockdown module ──────────────────────────────────────────────
// Disables Win+L (via registry), registers a global hotkey to
// capture it, and provides a lock-state flag used to prevent
// the user from closing Lyra while the lock screen is active.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

#[cfg(target_os = "windows")]
use windows::core::PCWSTR;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::*;
#[cfg(target_os = "windows")]
use windows::Win32::System::Registry::*;
#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::*;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::*;

/// True when the lock screen is displayed.
static IS_LOCKED: AtomicBool = AtomicBool::new(false);

/// Tauri app handle, used to emit events from the hotkey thread.
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

const HOTKEY_ID_LOCK: i32 = 9001;

// ── Public helpers ───────────────────────────────────────────────

pub fn set_locked(locked: bool) {
    IS_LOCKED.store(locked, Ordering::SeqCst);
}

pub fn is_locked() -> bool {
    IS_LOCKED.load(Ordering::SeqCst)
}

// ── Tauri command ────────────────────────────────────────────────

#[tauri::command]
pub fn set_lock_state(locked: bool) {
    set_locked(locked);
}

// ── Init / clean-up (Windows) ────────────────────────────────────

#[cfg(target_os = "windows")]
pub fn init_lockdown(app: &tauri::AppHandle) {
    let _ = APP_HANDLE.set(app.clone());

    // 1. Disable Win+L at the OS level via registry
    disable_winl_registry();

    // 2. Spawn a daemon thread that registers Win+L as a global
    //    hotkey and runs a message pump to receive it.
    std::thread::spawn(|| {
        unsafe {
            let _ = RegisterHotKey(
                HWND::default(),
                HOTKEY_ID_LOCK,
                MOD_WIN | MOD_NOREPEAT,
                0x4C, // VK_L
            );

            let mut msg = MSG::default();
            while GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
                if msg.message == WM_HOTKEY && msg.wParam.0 as i32 == HOTKEY_ID_LOCK {
                    if let Some(handle) = APP_HANDLE.get() {
                        use tauri::Emitter;
                        let _ = handle.emit("trigger-lock", ());
                    }
                }
            }
        }
    });
}

#[cfg(target_os = "windows")]
pub fn cleanup_lockdown() {
    enable_winl_registry();
}

#[cfg(not(target_os = "windows"))]
pub fn init_lockdown(_app: &tauri::AppHandle) {}

#[cfg(not(target_os = "windows"))]
pub fn cleanup_lockdown() {}

// ── Registry helpers ─────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn reg_subkey() -> Vec<u16> {
    OsStr::new(r"Software\Microsoft\Windows\CurrentVersion\Policies\System")
        .encode_wide()
        .chain(Some(0))
        .collect()
}

#[cfg(target_os = "windows")]
fn reg_value_name() -> Vec<u16> {
    OsStr::new("DisableLockWorkstation")
        .encode_wide()
        .chain(Some(0))
        .collect()
}

#[cfg(target_os = "windows")]
fn disable_winl_registry() {
    unsafe {
        let subkey = reg_subkey();
        let mut key = HKEY::default();
        let _ = RegCreateKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            0,
            None,
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            None,
            &mut key,
            None,
        );
        let value: u32 = 1;
        let name = reg_value_name();
        let _ = RegSetValueExW(
            key,
            PCWSTR(name.as_ptr()),
            0,
            REG_DWORD,
            Some(std::slice::from_raw_parts(
                &value as *const u32 as *const u8,
                4,
            )),
        );
        let _ = RegCloseKey(key);
    }
}

#[cfg(target_os = "windows")]
fn enable_winl_registry() {
    unsafe {
        let subkey = reg_subkey();
        let mut key = HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            0,
            KEY_WRITE,
            &mut key,
        )
        .is_ok()
        {
            let name = reg_value_name();
            let _ = RegDeleteValueW(key, PCWSTR(name.as_ptr()));
            let _ = RegCloseKey(key);
        }
    }
}

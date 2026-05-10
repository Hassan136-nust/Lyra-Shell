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
pub fn set_lock_state(locked: bool) {
    set_locked(locked);
}

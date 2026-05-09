# Lyra Production Stability Guide

## What Was Hardened

- Release builds already use `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`, so Lyra itself does not allocate a console window.
- Shell launches now use Windows `ShellExecuteW` instead of `cmd /C start`, which removes the most common source of flashing terminal windows and avoids command-line injection.
- Remaining Windows utilities are started with `CREATE_NO_WINDOW`.
- Repeated app/system actions are throttled in Rust to stop accidental double-clicks, frontend loops, or retry storms from spawning process trees.
- Rust panics, fatal Tauri startup errors, frontend uncaught errors, and selected system actions are written to `lyra.log` in the Tauri app log directory.
- Hot frontend polling now avoids overlapping calls and slows down when the webview is hidden.
- Expensive WiFi/network/audio polls run less often, and volume writes are debounced.

## Architecture Rules

- Prefer Rust/Tauri APIs over Node or WebContainer processes in production.
- If a child process is unavoidable, spawn only from Rust, use a strict allowlist, pass arguments as an array, set `CREATE_NO_WINDOW`, throttle calls, and log failures.
- Do not spawn `cmd.exe`, `powershell.exe`, or `node.exe` from React. Treat frontend clicks as requests, not authority.
- Keep one owner for each background loop. Use recursive `setTimeout` or an in-flight guard so a slow call cannot overlap with the next poll.
- Cache expensive native data such as icons, WiFi scans, and process metadata.
- Avoid restart supervisors inside the app unless they have exponential backoff and a hard retry limit.

## Debugging User PCs

Ask users for:

- Windows version and laptop model.
- `lyra.log` from the Tauri app log directory. The frontend can call `get_diagnostics_info` to display this path.
- Whether Windows Defender, SmartScreen, or another AV quarantined or scanned the app.
- Task Manager screenshots showing Lyra CPU, memory, subprocesses, and GPU usage.

Recommended release checklist:

- Build with `npm run build` and `cargo check` before packaging.
- Test the packaged app on a clean non-developer Windows account.
- Sign the installer and executable with a code-signing certificate.
- Use a stable app identifier and publisher metadata so SmartScreen reputation can accumulate.
- Avoid bundling Node/WebContainer unless absolutely necessary. If needed, ship it as an explicit sidecar with one supervised instance and logs.

## Windows-Specific Notes

- Terminal flicker usually comes from `cmd /C start`, `powershell`, `netsh`, or Node subprocesses inheriting a console. Use `ShellExecuteW` or `CREATE_NO_WINDOW`.
- Fullscreen shell overlays can make weak systems feel frozen. Keep polling low, avoid high-frequency blur/animation, and provide a recovery shortcut or tray escape path.
- Defender suspicion is reduced by signing, stable install paths, clear publisher info, no hidden script storms, and no repeated process spawning.

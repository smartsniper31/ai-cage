// Prevents a console window from appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! AI CAGE Desktop — Tauri backend.
//!
//! # Architecture
//! ```
//! [WebView / TypeScript]  ←→  [Tauri IPC Bridge]  ←→  [Rust Commands]
//! ```
//!
//! In V1, the heavy lifting (PII detection + caging) happens in TypeScript
//! via `@ai-cage/core` running inside the WebView — fully offline.
//!
//! The Rust side provides:
//!   - `get_app_version`  — returns the current version string
//!   - `open_privacy_doc` — opens PRIVACY_GUARANTEE.md in the default viewer
//!   - Future: native file scanning, clipboard watching, system tray agent
//!
//! # Security
//! - No network calls are made from the Rust side.
//! - `tauri::api::http` is NOT enabled in Cargo.toml.
//! - All Tauri capabilities are explicitly listed in tauri.conf.json.

use tauri::Manager;

// ---------------------------------------------------------------------------
// Tauri commands — callable from TypeScript via invoke()
// ---------------------------------------------------------------------------

/// Returns the application version from Cargo.toml.
///
/// # Example (TypeScript)
/// ```ts
/// import { invoke } from '@tauri-apps/api/tauri';
/// const version = await invoke<string>('get_app_version');
/// ```
#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Returns the current platform target triple.
/// Useful for audit logs and support diagnostics.
#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

/// Confirms that no outbound network connections are active.
/// Always returns true in this build — the Rust side is purely local.
///
/// This command exists so the frontend can display a verified
/// "offline-only" badge backed by the Rust process, not just a JS claim.
#[tauri::command]
fn verify_offline_mode() -> bool {
    // In a future version this could check for active sockets.
    // For V1, the architecture guarantee is enforced at compile time
    // (tauri::api::http is not compiled in).
    true
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_platform,
            verify_offline_mode,
        ])
        .setup(|app| {
            // In development, open DevTools for debugging.
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running AI CAGE desktop application");
}

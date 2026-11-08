// Prevents a console window from appearing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! AI CAGE Desktop — Tauri backend v0.6.0
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
//!   - `get_app_version`  — returns the current version string from Cargo.toml
//!   - `get_platform`     — returns the OS name (windows/macos/linux)
//!   - `verify_offline_mode` — confirms no network calls from Rust side
//!
//! # Security
//! - No network calls are made from the Rust side.
//! - `tauri::api::http` is NOT enabled in Cargo.toml.
//! - All Tauri capabilities are explicitly listed in tauri.conf.json.

// ---------------------------------------------------------------------------
// Tauri commands — callable from TypeScript via invoke()
// ---------------------------------------------------------------------------

/// Returns the application version from Cargo.toml.
///
/// # Example (TypeScript)
/// ```ts
/// const version = await invoke<string>('get_app_version');
/// ```
#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Returns the current OS name.
/// Useful for audit logs and support diagnostics.
#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

/// Confirms that no outbound network connections are active.
/// Always returns true — the Rust side is purely local.
/// The architecture guarantee is enforced at compile time
/// (tauri::api::http is not compiled in).
#[tauri::command]
fn verify_offline_mode() -> bool {
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
        .setup(|_app| {
            // In development, open DevTools for debugging.
            // tauri::Manager is imported inside the cfg block to avoid
            // unused import warnings in release builds.
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                let window = _app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running AI CAGE desktop application");
}

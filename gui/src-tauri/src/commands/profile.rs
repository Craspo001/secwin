use crate::types::*;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn get_secwin_config_dir() -> PathBuf {
    let app_handle = tauri::AppHandle::try_current().unwrap();
    let home = directories::ProjectDirs::from("com", "secwin", "secwin")
        .unwrap()
        .data_dir()
        .to_path_buf();
    home.join("config.yaml")
}

fn load_config() -> Result<serde_json::Value, String> {
    let config_path = get_secwin_config_dir();
    if !config_path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = std::fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let config: serde_json::Value = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
    Ok(config)
}

fn save_config(config: &serde_json::Value) -> Result<(), String> {
    let config_path = get_secwin_config_dir();
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    std::fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_profiles() -> Result<Vec<Profile>, String> {
    let config = load_config()?;
    let profiles = config.get("profiles").and_then(|p| p.as_object()).cloned().unwrap_or_default();
    let active_profile = config.get("active_profile").and_then(|p| p.as_str()).unwrap_or("");

    let mut result = Vec::new();
    for (name, profile) in profiles {
        let p = Profile {
            name: name.clone(),
            vpn_config: profile.get("vpn_config").and_then(|v| v.as_str()).map(String::from),
            mac_spoof: profile.get("mac_spoof").and_then(|v| v.as_bool()).unwrap_or(false),
            hostname: profile.get("hostname").and_then(|v| v.as_str()).map(String::from),
            timezone: profile.get("timezone").and_then(|v| v.as_str()).map(String::from),
            dns: profile.get("dns").and_then(|v| v.as_str()).map(String::from),
            proxy: profile.get("proxy").and_then(|v| v.as_str()).map(String::from),
            active: name == active_profile,
        };
        result.push(p);
    }
    Ok(result)
}

#[tauri::command]
pub async fn create_profile(request: ProfileCreateRequest) -> Result<Profile, String> {
    let mut config = load_config()?;
    if config.get("profiles").is_none() {
        config["profiles"] = serde_json::json!({});
    }

    let profile_json = serde_json::json!({
        "vpn_config": request.vpn_config,
        "mac_spoof": request.mac_spoof,
        "hostname": request.hostname,
        "timezone": request.timezone,
        "dns": request.dns,
        "proxy": request.proxy,
    });

    config["profiles"][request.name] = profile_json;
    save_config(&config)?;

    Ok(Profile {
        name: request.name,
        vpn_config: request.vpn_config,
        mac_spoof: request.mac_spoof,
        hostname: request.hostname,
        timezone: request.timezone,
        dns: request.dns,
        proxy: request.proxy,
        active: false,
    })
}

#[tauri::command]
pub async fn delete_profile(name: String) -> Result<(), String> {
    let mut config = load_config()?;
    if let Some(profiles) = config.get_mut("profiles").and_then(|p| p.as_object_mut()) {
        profiles.remove(&name);
    }
    if config.get("active_profile").and_then(|v| v.as_str()) == Some(&name) {
        config["active_profile"] = serde_json::Value::Null;
    }
    save_config(&config)?;
    Ok(())
}

#[tauri::command]
pub async fn engage_profile(name: String) -> Result<(), String> {
    let config = load_config()?;
    let profile = config.get("profiles")
        .and_then(|p| p.get(&name))
        .ok_or("Profile not found")?;

    // Execute secwin profile engage command
    let output = tokio::process::Command::new("secwin")
        .args(["profile", "engage", &name])
        .output()
        .await
        .map_err(|e| format!("Failed to execute secwin: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to engage profile: {}", stderr));
    }

    // Update active profile in config
    let mut updated_config = config;
    updated_config["active_profile"] = serde_json::json!(name);
    save_config(&updated_config)?;

    Ok(())
}

#[tauri::command]
pub async fn disengage_profile() -> Result<(), String> {
    let output = tokio::process::Command::new("secwin")
        .args(["profile", "disengage"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute secwin: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to disengage profile: {}", stderr));
    }

    let mut config = load_config()?;
    config["active_profile"] = serde_json::Value::Null;
    save_config(&config)?;

    Ok(())
}

#[tauri::command]
pub async fn get_profile_status() -> Result<HashMap<String, String>, String> {
    let output = tokio::process::Command::new("secwin")
        .args(["profile", "status"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute secwin: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut status = HashMap::new();

    for line in stdout.lines() {
        if let Some((key, value)) = line.split_once(':') {
            status.insert(key.trim().to_string(), value.trim().to_string());
        }
    }

    Ok(status)
}
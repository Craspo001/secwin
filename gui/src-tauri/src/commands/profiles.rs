use crate::models::{Profile, OpSecStatus};
use std::collections::HashMap;

#[tauri::command]
pub async fn get_profiles() -> Result<serde_json::Value, String> {
    let config = load_config().await?;

    let profiles: Vec<Profile> = config.profiles.unwrap_or_default().into_values().collect();
    let active = config.active_profile;

    Ok(serde_json::json!({
        "profiles": profiles,
        "active": active
    }))
}

#[tauri::command]
pub async fn list_profiles() -> Result<Vec<Profile>, String> {
    let config = load_config().await?;
    let profiles: Vec<Profile> = config.profiles.unwrap_or_default().into_values().collect();
    Ok(profiles)
}

#[tauri::command]
pub async fn create_profile(profile: Profile) -> Result<(), String> {
    let mut config = load_config().await?;

    if config.profiles.is_none() {
        config.profiles = Some(std::collections::HashMap::new());
    }

    let profiles = config.profiles.as_mut().unwrap();
    profiles.insert(profile.name.clone(), profile);

    save_config(&config).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_profile(name: String) -> Result<(), String> {
    let mut config = load_config().await?;

    if let Some(profiles) = config.profiles.as_mut() {
        profiles.remove(&name);
    }

    if config.active_profile.as_ref() == Some(&name) {
        config.active_profile = None;
    }

    save_config(&config).await?;
    Ok(())
}

async fn save_config(config: &Config) -> Result<(), String> {
    let config_path = dirs::home_dir()
        .map(|p| p.join(".secwin").join("config.yaml"))
        .ok_or("Could not find home directory")?;

    let content = serde_yaml::to_string(config).map_err(|e| e.to_string())?;
    tokio::fs::write(&config_path, content).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn engage_profile(name: String) -> Result<(), String> {
    let output = tokio::process::Command::new("secwin")
        .args(["profile", "engage", &name])
        .output()
        .await
        .map_err(|e| format!("Failed to execute secwin: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to engage profile: {}", stderr));
    }

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

    Ok(())
}

#[tauri::command]
pub async fn get_opsec_status() -> Result<OpSecStatus, String> {
    let output = tokio::process::Command::new("secwin")
        .args(["profile", "status"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute secwin: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse the status output
    let mut status = OpSecStatus {
        hostname: String::new(),
        timezone: String::new(),
        vpn: String::new(),
        http_proxy: String::new(),
        https_proxy: String::new(),
        dns: String::new(),
        mac_addresses: HashMap::new(),
    };

    for line in stdout.lines() {
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            let value = value.trim();

            match key {
                "hostname" => status.hostname = value.to_string(),
                "timezone" => status.timezone = value.to_string(),
                "vpn" => status.vpn = value.to_string(),
                "http_proxy" => status.http_proxy = value.to_string(),
                "https_proxy" => status.https_proxy = value.to_string(),
                "dns" => status.dns = value.to_string(),
                k if k.starts_with("mac_") => {
                    status.mac_addresses.insert(key.to_string(), value.to_string());
                }
                _ => {}
            }
        }
    }

    // Get hostname from OS if not set
    if status.hostname.is_empty() {
        status.hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());
    }

    Ok(status)
}

async fn load_config() -> Result<Config, String> {
    let config_path = dirs::home_dir()
        .map(|p| p.join(".secwin").join("config.yaml"))
        .ok_or("Could not find home directory")?;

    if !config_path.exists() {
        return Ok(Config::default());
    }

    let content = tokio::fs::read_to_string(&config_path).await.map_err(|e| e.to_string())?;
    serde_yaml::from_str(&content).map_err(|e| e.to_string())
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Default)]
struct Config {
    profiles: Option<std::collections::HashMap<String, Profile>>,
    active_profile: Option<String>,
}
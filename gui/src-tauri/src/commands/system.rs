use crate::models::{SystemInfo, Settings, OllamaModel};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use sysinfo::System;

#[tauri::command]
pub async fn get_secwin_path() -> Result<String, String> {
    // Try to find secwin in PATH
    let secwin_path = which::which("secwin")
        .or_else(|_| {
            // Check common installation paths
            let home = dirs::home_dir().ok_or("Could not find home directory")?;
            let paths = vec![
                home.join(".secwin").join("bin").join("secwin.exe"),
                home.join("scoop").join("apps").join("secwin").join("current").join("secwin.exe"),
                home.join(".cargo").join("bin").join("secwin.exe"),
                PathBuf::from("C:\\Program Files\\secwin\\secwin.exe"),
            ];
            paths.into_iter().find(|p| p.exists()).ok_or("secwin not found")
        })
        .map_err(|e| format!("Failed to find secwin: {}", e))?;

    Ok(secwin_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn run_secwin_command(args: Vec<String>) -> Result<serde_json::Value, String> {
    let secwin_path = get_secwin_path().await?;

    let mut cmd = Command::new(&secwin_path);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn secwin: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);

    let mut stdout_lines = Vec::new();
    let mut stderr_lines = Vec::new();

    let mut stdout_stream = stdout_reader.lines();
    let mut stderr_stream = stderr_reader.lines();

    // Read output concurrently
    let stdout_fut = async {
        while let Ok(Some(line)) = stdout_stream.next_line().await {
            stdout_lines.push(line);
        }
    };

    let stderr_fut = async {
        while let Ok(Some(line)) = stderr_stream.next_line().await {
            stderr_lines.push(line);
        }
    };

    tokio::join!(stdout_fut, stderr_fut);

    let status = child.wait().await.map_err(|e| format!("Failed to wait for process: {}", e))?;
    let exit_code = status.code().unwrap_or(-1);

    Ok(serde_json::json!({
        "stdout": stdout_lines.join("\n"),
        "stderr": stderr_lines.join("\n"),
        "exit_code": exit_code,
    }))
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let secwin_version = get_secwin_version().await.unwrap_or_else(|_| "unknown".to_string());

    let (wsl_available, wsl_distros) = check_wsl().await;

    // Get system info using sysinfo
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_count = sys.cpus().len();
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let available_memory = sys.available_memory();

    Ok(SystemInfo {
        os,
        arch,
        hostname,
        secwin_version,
        wsl_available,
        wsl_distros,
        cpu_count,
        total_memory,
        used_memory,
        available_memory,
    })
}

#[tauri::command]
pub async fn get_settings() -> Result<Settings, String> {
    let config = load_config().await?;

    Ok(Settings {
        tool_dir: config.tool_dir.unwrap_or_else(|| {
            dirs::home_dir()
                .map(|p| p.join(".secwin").join("tools").to_string_lossy().to_string())
                .unwrap_or_default()
        }),
        bin_dir: config.bin_dir.unwrap_or_else(|| {
            dirs::home_dir()
                .map(|p| p.join(".secwin").join("bin").to_string_lossy().to_string())
                .unwrap_or_default()
        }),
        manifest_dirs: config.manifest_dirs.unwrap_or_else(|| vec!["manifests".to_string()]),
        wsl: config.wsl.unwrap_or_default().into(),
        network: config.network.unwrap_or_default().into(),
        reporting: config.reporting.unwrap_or_default().into(),
    })
}

async fn get_secwin_version() -> Result<String, String> {
    let output = tokio::process::Command::new("secwin")
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("Failed to execute secwin: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let version_line = stdout.lines().next().unwrap_or("unknown");

    // Parse version from "secwin X.Y.Z (commit: ..., built: ..., go: ..., ...)"
    if let Some(version_part) = version_line.split_whitespace().nth(1) {
        Ok(version_part.to_string())
    } else {
        Ok("unknown".to_string())
    }
}

async fn check_wsl() -> (bool, Vec<String>) {
    let output = tokio::process::Command::new("wsl")
        .args(["-l", "-v"])
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let distros: Vec<String> = stdout.lines()
                .skip(1) // Skip header
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 1 {
                        Some(parts[0].trim_start_matches('*').trim().to_string())
                    } else {
                        None
                    }
                })
                .collect();
            (true, distros)
        }
        _ => (false, Vec::new()),
    }
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
    tool_dir: Option<String>,
    bin_dir: Option<String>,
    manifest_dirs: Option<Vec<String>>,
    wsl: Option<WSLConfig>,
    network: Option<NetworkConfig>,
    reporting: Option<ReportingConfig>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Default)]
struct WSLConfig {
    default_distro: Option<String>,
    environment: Option<HashMap<String, String>>,
    mount_drives: Option<Vec<String>>,
}

impl From<WSLConfig> for crate::models::WSLConfig {
    fn from(config: WSLConfig) -> Self {
        crate::models::WSLConfig {
            default_distro: config.default_distro.unwrap_or_else(|| "kali-linux".to_string()),
            environment: config.environment.unwrap_or_default(),
            mount_drives: config.mount_drives.unwrap_or_default(),
        }
    }
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Default)]
struct NetworkConfig {
    default_interface: Option<String>,
    proxy_url: Option<String>,
    no_proxy: Option<String>,
}

impl From<NetworkConfig> for crate::models::NetworkConfig {
    fn from(config: NetworkConfig) -> Self {
        crate::models::NetworkConfig {
            default_interface: config.default_interface,
            proxy_url: config.proxy_url,
            no_proxy: config.no_proxy.unwrap_or_else(|| "localhost,127.0.0.1,::1".to_string()),
        }
    }
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Default)]
struct ReportingConfig {
    default_template: Option<String>,
    output_formats: Option<Vec<String>>,
    evidence_retention_days: Option<u32>,
}

impl From<ReportingConfig> for crate::models::ReportingConfig {
    fn from(config: ReportingConfig) -> Self {
        crate::models::ReportingConfig {
            default_template: config.default_template.unwrap_or_else(|| "default".to_string()),
            output_formats: config.output_formats.unwrap_or_else(|| vec!["markdown".to_string(), "html".to_string(), "pdf".to_string()]),
            evidence_retention_days: config.evidence_retention_days.unwrap_or(90),
        }
    }
}

#[tauri::command]
pub async fn get_ollama_models() -> Result<Vec<OllamaModel>, String> {
    let output = tokio::process::Command::new("ollama")
        .arg("list")
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut models = Vec::new();

    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 {
            models.push(OllamaModel {
                name: parts[0].to_string(),
                size: parts[1].to_string(),
                modified: format!("{} {}", parts[2], parts[3]),
                digest: parts.get(4).unwrap_or(&"").to_string(),
            });
        }
    }

    Ok(models)
}
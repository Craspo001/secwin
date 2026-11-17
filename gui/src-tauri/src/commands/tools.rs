use crate::models::Tool;
use std::path::Path;
use walkdir::WalkDir;

#[tauri::command]
pub async fn get_tools() -> Result<Vec<Tool>, String> {
    let mut tools = Vec::new();

    // Get manifest directories
    let manifest_dirs = get_manifest_dirs().await?;

    for manifest_dir in manifest_dirs {
        if let Ok(entries) = WalkDir::new(&manifest_dir).into_iter().filter_map(|e| e.ok()).collect::<Vec<_>>() {
            for entry in entries {
                if entry.file_type().is_file() && entry.path().extension().map_or(false, |ext| ext == "yaml" || ext == "yml") {
                    if let Ok(content) = tokio::fs::read_to_string(entry.path()).await {
                        if let Ok(manifest) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                            if let Some(tools_list) = manifest.get("tools").and_then(|t| t.as_sequence()) {
                                for tool_yaml in tools_list {
                                    if let Ok(tool) = parse_tool_from_yaml(tool_yaml) {
                                        let installed = check_tool_installed(&tool.name).await;
                                        tools.push(Tool {
                                            name: tool.name,
                                            version: tool.version,
                                            description: tool.description,
                                            category: tool.category,
                                            installed,
                                            install_method: tool.install_method,
                                            wsl_preferred: tool.wsl_preferred,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Deduplicate by name (keep first)
    tools.sort_by(|a, b| a.name.cmp(&b.name));
    tools.dedup_by(|a, b| a.name == b.name);

    Ok(tools)
}

#[tauri::command]
pub async fn list_tools() -> Result<Vec<Tool>, String> {
    get_tools().await
}

#[tauri::command]
pub async fn search_tools(query: String) -> Result<Vec<Tool>, String> {
    let tools = get_tools().await?;
    let query_lower = query.to_lowercase();

    let filtered: Vec<Tool> = tools.into_iter()
        .filter(|tool| {
            tool.name.to_lowercase().contains(&query_lower)
                || tool.description.to_lowercase().contains(&query_lower)
                || tool.category.to_lowercase().contains(&query_lower)
                || tool.tags.iter().any(|t| t.to_lowercase().contains(&query_lower))
        })
        .collect();

    Ok(filtered)
}

#[derive(Debug)]
struct ParsedTool {
    name: String,
    version: String,
    description: String,
    category: String,
    install_method: Option<String>,
    wsl_preferred: Option<bool>,
}

fn parse_tool_from_yaml(value: &serde_yaml::Value) -> Result<ParsedTool, String> {
    let name = value.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let version = value.get("version").and_then(|v| v.as_str()).unwrap_or("1.0").to_string();
    let description = value.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let category = value.get("category").and_then(|v| v.as_str()).unwrap_or("General").to_string();

    let install_method = value.get("install_methods")
        .and_then(|v| v.as_sequence())
        .and_then(|seq| seq.first())
        .and_then(|v| v.get("method"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let wsl_preferred = value.get("wsl_preferred").and_then(|v| v.as_bool());

    Ok(ParsedTool {
        name,
        version,
        description,
        category,
        install_method,
        wsl_preferred,
    })
}

async fn check_tool_installed(name: &str) -> bool {
    // Check in bin directory
    let bin_dir = get_bin_dir().await.unwrap_or_default();
    let tool_path = Path::new(&bin_dir).join(name);
    if tool_path.exists() || tool_path.with_extension("exe").exists() {
        return true;
    }

    // Check in PATH
    if let Ok(output) = tokio::process::Command::new("where")
        .arg(name)
        .output()
        .await
    {
        return output.status.success();
    }

    false
}

async fn get_manifest_dirs() -> Result<Vec<String>, String> {
    let config = load_config().await?;
    Ok(config.manifest_dirs.unwrap_or_else(|| vec!["manifests".to_string()]))
}

async fn get_bin_dir() -> Result<String, String> {
    let config = load_config().await?;
    Ok(config.bin_dir.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.join(".secwin").join("bin").to_string_lossy().to_string())
            .unwrap_or_default()
    }))
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
    environment: Option<std::collections::HashMap<String, String>>,
    mount_drives: Option<Vec<String>>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Default)]
struct NetworkConfig {
    default_interface: Option<String>,
    proxy_url: Option<String>,
    no_proxy: Option<String>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Default)]
struct ReportingConfig {
    default_template: Option<String>,
    output_formats: Option<Vec<String>>,
    evidence_retention_days: Option<u32>,
}

#[tauri::command]
pub async fn install_tool(name: String) -> Result<(), String> {
    // This would call the secwin CLI to install the tool
    let output = tokio::process::Command::new("secwin")
        .args(["install", &name])
        .output()
        .await
        .map_err(|e| format!("Failed to execute secwin: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Installation failed: {}", stderr));
    }

    Ok(())
}
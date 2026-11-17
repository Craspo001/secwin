use crate::models::{Playbook, ExecutionResult, StepResult, Finding};
use std::collections::HashMap;
use walkdir::WalkDir;

#[tauri::command]
pub async fn get_playbooks() -> Result<Vec<Playbook>, String> {
    let mut playbooks = Vec::new();

    let playbook_dirs = get_playbook_dirs().await?;

    for playbook_dir in playbook_dirs {
        if let Ok(entries) = WalkDir::new(&playbook_dir).into_iter().filter_map(|e| e.ok()).collect::<Vec<_>>() {
            for entry in entries {
                if entry.file_type().is_file() && entry.path().extension().map_or(false, |ext| ext == "yaml" || ext == "yml") {
                    if let Ok(content) = tokio::fs::read_to_string(entry.path()).await {
                        if let Ok(pb) = serde_yaml::from_str::<Playbook>(&content) {
                            playbooks.push(pb);
                        }
                    }
                }
            }
        }
    }

    Ok(playbooks)
}

#[tauri::command]
pub async fn list_playbooks() -> Result<Vec<Playbook>, String> {
    get_playbooks().await
}

#[tauri::command]
pub async fn get_playbook_detail(name: String) -> Result<Playbook, String> {
    let playbooks = get_playbooks().await?;
    playbooks.into_iter()
        .find(|p| p.metadata.name == name)
        .ok_or_else(|| format!("Playbook not found: {}", name))
}

#[tauri::command]
pub async fn run_playbook(name: String, variables: HashMap<String, serde_json::Value>) -> Result<ExecutionResult, String> {
    // Find the playbook
    let playbooks = get_playbooks().await?;
    let playbook = playbooks.into_iter()
        .find(|p| p.metadata.name == name)
        .ok_or_else(|| format!("Playbook not found: {}", name))?;

    // Execute via secwin CLI
    let vars_json = serde_json::to_string(&variables).map_err(|e| e.to_string())?;

    let output = tokio::process::Command::new("secwin")
        .args(["playbook", "run", &name, "--vars", &vars_json])
        .output()
        .await
        .map_err(|e| format!("Failed to execute secwin: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Ok(ExecutionResult {
            success: false,
            duration: "0s".to_string(),
            step_results: HashMap::new(),
            findings: Vec::new(),
            artifacts: HashMap::new(),
            report_path: None,
            error: Some(stderr.to_string()),
        });
    }

    // Parse the output to extract results
    // For now, return a basic success result
    Ok(ExecutionResult {
        success: true,
        duration: "0s".to_string(),
        step_results: HashMap::new(),
        findings: Vec::new(),
        artifacts: HashMap::new(),
        report_path: None,
        error: None,
    })
}

async fn get_playbook_dirs() -> Result<Vec<String>, String> {
    let config = load_config().await?;
    let mut dirs = vec!["playbooks".to_string()];

    if let Some(custom_dirs) = config.playbook_dirs {
        dirs.extend(custom_dirs);
    }

    Ok(dirs)
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
    playbook_dirs: Option<Vec<String>>,
}
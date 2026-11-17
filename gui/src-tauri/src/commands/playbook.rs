use crate::types::*;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

lazy_static::lazy_static! {
    static ref PLAYBOOK_STATE: Arc<Mutex<Option<PlaybookStatus>>> = Arc::new(Mutex::new(None));
}

fn get_playbooks_dir() -> PathBuf {
    let home = directories::ProjectDirs::from("com", "secwin", "secwin")
        .unwrap()
        .data_dir()
        .to_path_buf();
    home.join("playbooks")
}

fn get_manifests_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_default()
        .join("manifests")
}

#[tauri::command]
pub async fn list_playbooks() -> Result<Vec<Playbook>, String> {
    let mut playbooks = Vec::new();

    // Built-in playbooks from manifests directory
    let manifests_dir = get_manifests_dir();
    if manifests_dir.exists() {
        for entry in walkdir::WalkDir::new(&manifests_dir).into_iter().filter_map(|e| e.ok()) {
            if entry.path().extension().map_or(false, |ext| ext == "yaml") {
                if let Ok(content) = std::fs::read_to_string(entry.path()) {
                    if let Ok(manifest) = serde_yaml::from_str::<serde_json::Value>(&content) {
                        if let Some(name) = manifest.get("name").and_then(|v| v.as_str()) {
                            playbooks.push(Playbook {
                                id: uuid::Uuid::new_v4().to_string(),
                                name: name.to_string(),
                                version: manifest.get("version").and_then(|v| v.as_str()).unwrap_or("1.0.0").to_string(),
                                author: manifest.get("author").and_then(|v| v.as_str()).map(String::from),
                                description: manifest.get("description").and_then(|v| v.as_str()).map(String::from),
                                path: entry.path().to_string_lossy().to_string(),
                                mitre_tactics: manifest.get("mitre_tactics").and_then(|v| v.as_sequence()).map(|seq| {
                                    seq.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                                }).unwrap_or_default(),
                                tags: manifest.get("tags").and_then(|v| v.as_sequence()).map(|seq| {
                                    seq.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                                }).unwrap_or_default(),
                            });
                        }
                    }
                }
            }
        }
    }

    // User playbooks
    let playbooks_dir = get_playbooks_dir();
    if playbooks_dir.exists() {
        for entry in walkdir::WalkDir::new(&playbooks_dir).into_iter().filter_map(|e| e.ok()) {
            if entry.path().extension().map_or(false, |ext| ext == "yaml" || ext == "yml") {
                if let Ok(content) = std::fs::read_to_string(entry.path()) {
                    if let Ok(pb) = serde_yaml::from_str::<serde_json::Value>(&content) {
                        if let Some(name) = pb.get("metadata").and_then(|m| m.get("name")).and_then(|v| v.as_str()) {
                            playbooks.push(Playbook {
                                id: uuid::Uuid::new_v4().to_string(),
                                name: name.to_string(),
                                version: pb.get("metadata").and_then(|m| m.get("version")).and_then(|v| v.as_str()).unwrap_or("1.0.0").to_string(),
                                author: pb.get("metadata").and_then(|m| m.get("author")).and_then(|v| v.as_str()).map(String::from),
                                description: pb.get("metadata").and_then(|m| m.get("description")).and_then(|v| v.as_str()).map(String::from),
                                path: entry.path().to_string_lossy().to_string(),
                                mitre_tactics: pb.get("metadata").and_then(|m| m.get("mitre_tactics")).and_then(|v| v.as_sequence()).map(|seq| {
                                    seq.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                                }).unwrap_or_default(),
                                tags: pb.get("metadata").and_then(|m| m.get("tags")).and_then(|v| v.as_sequence()).map(|seq| {
                                    seq.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                                }).unwrap_or_default(),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(playbooks)
}

#[tauri::command]
pub async fn run_playbook(app_handle: AppHandle, request: PlaybookRunRequest) -> Result<PlaybookRunResult, String> {
    let start_time = std::time::Instant::now();

    // Update status to running
    {
        let mut state = PLAYBOOK_STATE.lock().await;
        *state = Some(PlaybookStatus {
            running: true,
            playbook_id: Some(request.playbook_id.clone()),
            current_step: Some("Starting...".to_string()),
            progress: 0.0,
            started_at: Some(chrono::Utc::now()),
        });
    }

    // Emit progress event
    let _ = app_handle.emit("playbook-progress", serde_json::json!({
        "playbook_id": request.playbook_id,
        "step": "Starting...",
        "progress": 0.0
    }));

    // Build variables string
    let mut vars_args = Vec::new();
    for (k, v) in request.variables {
        vars_args.push(format!("--set={}={}", k, serde_json::to_string(&v).unwrap()));
    }

    // Build formats string
    let formats = if request.formats.is_empty() {
        vec!["markdown".to_string()]
    } else {
        request.formats
    };
    let formats_arg = formats.join(",");

    // Run secwin playbook run command
    let mut cmd = tokio::process::Command::new("secwin");
    cmd.args([
        "playbook",
        "run",
        &request.playbook_id,
        "--formats",
        &formats_arg,
    ]);
    cmd.args(&vars_args);

    let output = cmd.output().await.map_err(|e| format!("Failed to execute secwin: {}", e))?;

    let duration = start_time.elapsed();

    // Update status to completed
    {
        let mut state = PLAYBOOK_STATE.lock().await;
        *state = Some(PlaybookStatus {
            running: false,
            playbook_id: None,
            current_step: None,
            progress: 1.0,
            started_at: None,
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Ok(PlaybookRunResult {
            success: false,
            playbook_id: request.playbook_id,
            duration_ms: duration.as_millis() as u64,
            report_path: None,
            evidence_dir: None,
            findings: Vec::new(),
            artifacts: Vec::new(),
            error: Some(format!("Playbook failed: {}", stderr)),
        });
    }

    // Parse output to find report path and evidence dir
    // This is a simplified version - in production you'd parse the actual output
    let report_path = None; // Would parse from output
    let evidence_dir = None; // Would parse from output

    Ok(PlaybookRunResult {
        success: true,
        playbook_id: request.playbook_id,
        duration_ms: duration.as_millis() as u64,
        report_path,
        evidence_dir,
        findings: Vec::new(), // Would parse from output
        artifacts: Vec::new(), // Would parse from output
        error: None,
    })
}

#[tauri::command]
pub async fn stop_playbook() -> Result<(), String> {
    // Send interrupt to running playbook
    let mut state = PLAYBOOK_STATE.lock().await;
    *state = None;
    Ok(())
}

#[tauri::command]
pub async fn get_playbook_status() -> Result<PlaybookStatus, String> {
    let state = PLAYBOOK_STATE.lock().await;
    Ok(state.clone().unwrap_or(PlaybookStatus {
        running: false,
        playbook_id: None,
        current_step: None,
        progress: 0.0,
        started_at: None,
    }))
}
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{command, Manager, State};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

// Playbook structures
#[derive(Debug, Serialize, Deserialize)]
struct Playbook {
    metadata: PlaybookMetadata,
    variables: HashMap<String, Variable>,
    steps: Vec<Step>,
    outputs: Outputs,
    hooks: Hooks,
}

#[derive(Debug, Serialize, Deserialize)]
struct PlaybookMetadata {
    name: String,
    version: String,
    author: Option<String>,
    description: Option<String>,
    mitre_tactics: Option<Vec<String>>,
    tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Variable {
    #[serde(rename = "type")]
    var_type: String,
    required: Option<bool>,
    default: Option<serde_json::Value>,
    description: Option<String>,
    validation: Option<String>,
    secret: Option<bool>,
    enum: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Step {
    id: String,
    name: String,
    tool: String,
    args: Option<Vec<String>>,
    condition: Option<String>,
    retry: Option<i32>,
    timeout: Option<String>,
    artifacts: Option<Vec<String>>,
    mitre_techniques: Option<Vec<String>>,
    env: Option<HashMap<String, String>>,
    working_dir: Option<String>,
    continue_on_error: Option<bool>,
    parallel: Option<Vec<Step>>,
    foreach: Option<ForeachSpec>,
    if: Option<IfSpec>,
    try: Option<TrySpec>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ForeachSpec {
    variable: String,
    #[serde(rename = "in")]
    in_var: String,
    steps: Vec<Step>,
}

#[derive(Debug, Serialize, Deserialize)]
struct IfSpec {
    condition: String,
    then: Vec<Step>,
    else: Option<Vec<Step>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TrySpec {
    steps: Vec<Step>,
    catch: Option<Vec<Step>>,
    finally: Option<Vec<Step>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Outputs {
    findings: Option<String>,
    report: Option<String>,
    evidence_dir: Option<String>,
    formats: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Hooks {
    pre_step: Option<Vec<HookSpec>>,
    post_step: Option<Vec<HookSpec>>,
    on_failure: Option<Vec<HookSpec>>,
    on_success: Option<Vec<HookSpec>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct HookSpec {
    tool: String,
    args: Option<Vec<String>>,
}

// Result structures
#[derive(Debug, Serialize, Deserialize)]
struct PlaybookResult {
    success: bool,
    error: Option<String>,
    duration: u64,
    step_results: HashMap<String, StepResult>,
    findings: Vec<Finding>,
    artifacts: HashMap<String, String>,
    report_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct StepResult {
    step_id: String,
    success: bool,
    output: String,
    error: String,
    duration: u64,
    artifacts: HashMap<String, String>,
    started_at: String,
    completed_at: String,
    retries: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct Finding {
    id: String,
    title: String,
    description: String,
    severity: String,
    mitre_techniques: Vec<String>,
    evidence: HashMap<String, String>,
    step_id: String,
    created_at: String,
}

// Profile structures
#[derive(Debug, Serialize, Deserialize)]
struct Profile {
    name: String,
    vpn_config: Option<String>,
    mac_spoof: bool,
    hostname: Option<String>,
    timezone: Option<String>,
    dns: Option<String>,
    proxy: Option<String>,
}

// Tool structures
#[derive(Debug, Serialize, Deserialize)]
struct ToolManifest {
    name: String,
    version: String,
    description: String,
    category: String,
    homepage: String,
    repository: String,
    license: String,
    tags: Vec<String>,
    aliases: Vec<String>,
    install_methods: Vec<InstallMethod>,
    wsl_preferred: Option<bool>,
    wsl_distro: Option<String>,
    post_install: Option<PostInstall>,
}

#[derive(Debug, Serialize, Deserialize)]
struct InstallMethod {
    method: String,
    priority: i32,
    platforms: Vec<String>,
    architectures: Vec<String>,
    source: String,
    binary_name: Option<String>,
    checksum: Option<String>,
    version: Option<String>,
    extract_path: Option<String>,
    script: Option<String>,
    pre_commands: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PostInstall {
    commands: Vec<String>,
    verify_command: String,
}

// Evidence structures
#[derive(Debug, Serialize, Deserialize)]
struct EvidenceArtifact {
    name: String,
    path: String,
    sha256: String,
    size: u64,
    step_id: String,
    timestamp: String,
}

// System status
#[derive(Debug, Serialize, Deserialize)]
struct SystemStatus {
    os: String,
    arch: String,
    wsl_available: bool,
    wsl_distros: Vec<String>,
    tools_installed: usize,
    active_profile: Option<String>,
}

// AI Triage structures
#[derive(Debug, Serialize, Deserialize)]
struct AI_TriageResult {
    finding_id: String,
    classification: String,
    confidence: f64,
    reasoning: String,
    suggested_severity: Option<String>,
    remediation: Option<String>,
    mitre_enrichment: Option<Vec<String>>,
}

// State
struct AppState {
    profiles: Mutex<HashMap<String, Profile>>,
    active_profile: Mutex<Option<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            profiles: Mutex::new(HashMap::new()),
            active_profile: Mutex::new(None),
        }
    }
}

// Commands
#[command]
async fn list_playbooks() -> Result<Vec<String>, String> {
    let playbooks_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".secwin")
        .join("playbooks");

    if !playbooks_dir.exists() {
        return Ok(vec![]);
    }

    let mut playbooks = Vec::new();
    for entry in WalkDir::new(&playbooks_dir).max_depth(1) {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().is_file() {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".yaml") || name.ends_with(".yml") {
                    playbooks.push(name.trim_end_matches(".yaml").trim_end_matches(".yml").to_string());
                }
            }
        }
    }
    Ok(playbooks)
}

#[command]
async fn load_playbook(name: String) -> Result<Playbook, String> {
    let paths = [
        format!("{}.yaml", name),
        format!("{}.yml", name),
        format!("playbooks/{}.yaml", name),
        format!("playbooks/{}.yml", name),
    ];

    for path in paths {
        if Path::new(&path).exists() {
            let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let playbook: Playbook = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
            return Ok(playbook);
        }
    }

    Err("Playbook not found".to_string())
}

#[command]
async fn run_playbook(playbook: Playbook, variables: HashMap<String, serde_json::Value>) -> Result<PlaybookResult, String> {
    // This would integrate with the actual Go executor
    // For now, return a mock result
    Ok(PlaybookResult {
        success: true,
        error: None,
        duration: 1000,
        step_results: HashMap::new(),
        findings: vec![],
        artifacts: HashMap::new(),
        report_path: None,
    })
}

#[command]
async fn validate_playbook(playbook: Playbook) -> Result<serde_json::Value, String> {
    let mut errors = Vec::new();

    if playbook.metadata.name.is_empty() {
        errors.push("name is required".to_string());
    }
    if playbook.steps.is_empty() {
        errors.push("at least one step required".to_string());
    }

    let mut seen = std::collections::HashSet::new();
    for (i, step) in playbook.steps.iter().enumerate() {
        if step.id.is_empty() {
            errors.push(format!("step {}: id required", i));
        }
        if seen.contains(&step.id) {
            errors.push(format!("duplicate step id: {}", step.id));
        }
        seen.insert(step.id.clone());
    }

    Ok(serde_json::json!({
        "valid": errors.is_empty(),
        "errors": errors
    }))
}

#[command]
async fn list_profiles(state: State<'_, AppState>) -> Result<Vec<Profile>, String> {
    let profiles = state.profiles.lock().map_err(|e| e.to_string())?;
    Ok(profiles.values().cloned().collect())
}

#[command]
async fn create_profile(profile: Profile, state: State<'_, AppState>) -> Result<(), String> {
    let mut profiles = state.profiles.lock().map_err(|e| e.to_string())?;
    profiles.insert(profile.name.clone(), profile);
    Ok(())
}

#[command]
async fn engage_profile(name: String, state: State<'_, AppState>) -> Result<(), String> {
    let profiles = state.profiles.lock().map_err(|e| e.to_string())?;
    if !profiles.contains_key(&name) {
        return Err("Profile not found".to_string());
    }
    let mut active = state.active_profile.lock().map_err(|e| e.to_string())?;
    *active = Some(name);
    Ok(())
}

#[command]
async fn disengage_profile(state: State<'_, AppState>) -> Result<(), String> {
    let mut active = state.active_profile.lock().map_err(|e| e.to_string())?;
    *active = None;
    Ok(())
}

#[command]
async fn get_profile_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let profiles = state.profiles.lock().map_err(|e| e.to_string())?;
    let active = state.active_profile.lock().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "active": *active,
        "profiles": profiles.values().cloned().collect::<Vec<_>>(),
        "system": get_opsec_status()
    }))
}

#[command]
async fn delete_profile(name: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut profiles = state.profiles.lock().map_err(|e| e.to_string())?;
    profiles.remove(&name);
    let mut active = state.active_profile.lock().map_err(|e| e.to_string())?;
    if *active == Some(name) {
        *active = None;
    }
    Ok(())
}

#[command]
async fn list_tools() -> Result<Vec<ToolManifest>, String> {
    let manifests_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".secwin")
        .join("manifests");

    if !manifests_dir.exists() {
        return Ok(vec![]);
    }

    let mut tools = Vec::new();
    for entry in WalkDir::new(&manifests_dir) {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().is_file() {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".yaml") || name.ends_with(".yml") {
                    let content = std::fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
                    let tool: ToolManifest = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
                    tools.push(tool);
                }
            }
        }
    }
    Ok(tools)
}

#[command]
async fn install_tool(name: String) -> Result<(), String> {
    // Would integrate with actual installer
    Ok(())
}

#[command]
async fn search_tools(query: String) -> Result<Vec<ToolManifest>, String> {
    let tools = list_tools().await?;
    let filtered: Vec<_> = tools.into_iter()
        .filter(|t| t.name.to_lowercase().contains(&query.to_lowercase()) ||
                   t.description.to_lowercase().contains(&query.to_lowercase()) ||
                   t.tags.iter().any(|tag| tag.to_lowercase().contains(&query.to_lowercase())))
        .collect();
    Ok(filtered)
}

#[command]
async fn list_evidence(dir: Option<String>) -> Result<Vec<EvidenceArtifact>, String> {
    let evidence_dir = dir.map(PathBuf::from).unwrap_or_else(|| {
        dirs::home_dir()
            .unwrap()
            .join(".secwin")
            .join("evidence")
    });

    if !evidence_dir.exists() {
        return Ok(vec![]);
    }

    let mut artifacts = Vec::new();
    for entry in WalkDir::new(&evidence_dir).max_depth(1) {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().is_file() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "sha256") ||
               path.extension().map_or(false, |e| e == "manifest") {
                continue;
            }

            let metadata = path.metadata().map_err(|e| e.to_string())?;
            let content = std::fs::read(path).map_err(|e| e.to_string())?;
            let mut hasher = Sha256::new();
            hasher.update(&content);
            let sha256 = format!("{:x}", hasher.finalize());

            artifacts.push(EvidenceArtifact {
                name: path.file_name().unwrap().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                sha256,
                size: metadata.len(),
                step_id: "unknown".to_string(),
                timestamp: metadata.modified().map_err(|e| e.to_string())?
                    .duration_since(std::time::UNIX_EPOCH).unwrap()
                    .as_secs().to_string(),
            });
        }
    }
    Ok(artifacts)
}

#[command]
async fn verify_evidence(dir: Option<String>) -> Result<serde_json::Value, String> {
    let artifacts = list_evidence(dir).await?;
    let mut verified = 0;
    let mut failed = 0;
    let mut details = Vec::new();

    for artifact in artifacts {
        let sha_file = format!("{}.sha256", artifact.path);
        if Path::new(&sha_file).exists() {
            let expected = std::fs::read_to_string(&sha_file).map_err(|e| e.to_string())?
                .trim().to_string();
            let expected = expected.strip_prefix("sha256:").unwrap_or(&expected);
            let match_ = expected.eq_ignore_ascii_case(&artifact.sha256);
            if match_ { verified += 1; } else { failed += 1; }
            details.push(serde_json::json!({
                "name": artifact.name,
                "expected": expected,
                "actual": artifact.sha256,
                "match": match_
            }));
        } else {
            verified += 1;
            details.push(serde_json::json!({
                "name": artifact.name,
                "expected": "none",
                "actual": artifact.sha256,
                "match": true
            }));
        }
    }

    Ok(serde_json::json!({
        "verified": verified,
        "failed": failed,
        "details": details
    }))
}

#[command]
async fn export_evidence_manifest(dir: Option<String>, format: Option<String>) -> Result<String, String> {
    let artifacts = list_evidence(dir).await?;
    let manifest = serde_json::json!({
        "generated_at": chrono::Utc::now().to_rfc3339(),
        "evidence_dir": dir.unwrap_or_else(|| "~/.secwin/evidence".to_string()),
        "artifacts": artifacts
    });

    match format.as_deref() {
        Some("yaml") => serde_yaml::to_string(&manifest).map_err(|e| e.to_string()),
        _ => serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string()),
    }
}

#[command]
async fn get_system_status() -> Result<SystemStatus, String> {
    let wsl_available = Command::new("wsl").arg("--list").arg("--quiet").output().is_ok();
    let wsl_distros = if wsl_available {
        Command::new("wsl")
            .arg("--list")
            .arg("--quiet")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter(|l| !l.trim().is_empty())
                .map(|l| l.trim().to_string())
                .collect())
            .unwrap_or_default()
    } else {
        vec![]
    };

    Ok(SystemStatus {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        wsl_available,
        wsl_distros,
        tools_installed: 0,
        active_profile: None,
    })
}

#[command]
async fn check_wsl() -> Result<serde_json::Value, String> {
    let available = Command::new("wsl").arg("--list").arg("--quiet").output().is_ok();
    let distros = if available {
        Command::new("wsl")
            .arg("--list")
            .arg("--quiet")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter(|l| !l.trim().is_empty())
                .map(|l| l.trim().to_string())
                .collect())
            .unwrap_or_default()
    } else {
        vec![]
    };
    Ok(serde_json::json!({
        "available": available,
        "distros": distros,
        "default": distros.first().cloned().unwrap_or_default()
    }))
}

#[command]
async fn triage_findings(findings: Vec<Finding>, model: Option<String>) -> Result<Vec<AI_TriageResult>, String> {
    // This would call Ollama API
    // For now, return mock results
    let results: Vec<AI_TriageResult> = findings.into_iter().map(|f| AI_TriageResult {
        finding_id: f.id,
        classification: "true_positive".to_string(),
        confidence: 0.85,
        reasoning: "Automated triage based on finding patterns".to_string(),
        suggested_severity: Some(f.severity),
        remediation: Some("Review and apply appropriate mitigations".to_string()),
        mitre_enrichment: None,
    }).collect();
    Ok(results)
}

#[command]
async fn get_ollama_models() -> Result<Vec<String>, String> {
    // Would call Ollama API
    Ok(vec!["llama3.2".to_string(), "mistral".to_string(), "codellama".to_string()])
}

#[command]
async fn check_ollama_connection() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(resp) if resp.status().is_success() => {
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let models = json["models"].as_array()
                .map(|arr| arr.iter().filter_map(|m| m["name"].as_str()).map(String::from).collect())
                .unwrap_or_default();
            Ok(serde_json::json!({
                "connected": true,
                "version": "0.1.0",
                "models": models
            }))
        }
        _ => Ok(serde_json::json!({
            "connected": false,
            "version": null,
            "models": Vec::<String>::new()
        }))
    }
}

fn get_opsec_status() -> serde_json::Value {
    serde_json::json!({
        "vpn": "none",
        "mac_spoof": false,
        "hostname": std::env::var("COMPUTERNAME").unwrap_or_default(),
        "timezone": "UTC",
        "dns": "auto",
        "proxy": "none"
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            list_playbooks,
            load_playbook,
            run_playbook,
            validate_playbook,
            list_profiles,
            create_profile,
            engage_profile,
            disengage_profile,
            get_profile_status,
            delete_profile,
            list_tools,
            install_tool,
            search_tools,
            list_evidence,
            verify_evidence,
            export_evidence_manifest,
            get_system_status,
            check_wsl,
            triage_findings,
            get_ollama_models,
            check_ollama_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
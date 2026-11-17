use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use uuid::Uuid;

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub arch: String,
    pub hostname: String,
    pub username: String,
    pub secwin_version: Option<String>,
    pub secwin_path: Option<String>,
    pub wsl_available: bool,
    pub wsl_distros: Vec<String>,
    pub ollama_available: bool,
    pub ollama_models: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SecwinCommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookInfo {
    pub name: String,
    pub path: String,
    pub version: String,
    pub description: String,
    pub mitre_tactics: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookRunRequest {
    pub playbook: String,
    pub variables: HashMap<String, serde_json::Value>,
    pub output_dir: Option<String>,
    pub dry_run: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookStatus {
    pub id: String,
    pub playbook: String,
    pub status: String, // running, completed, failed, stopped
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub current_step: Option<String>,
    pub progress: f32,
    pub steps_completed: usize,
    pub steps_total: usize,
    pub findings_count: usize,
    pub artifacts_count: usize,
    pub report_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileInfo {
    pub name: String,
    pub vpn_config: Option<String>,
    pub mac_spoof: bool,
    pub hostname: Option<String>,
    pub timezone: Option<String>,
    pub dns: Option<String>,
    pub proxy: Option<String>,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpSecStatus {
    pub mac_addresses: HashMap<String, String>,
    pub hostname: String,
    pub timezone: String,
    pub vpn: String,
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub dns: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EvidenceArtifact {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub sha256: String,
    pub step_id: String,
    pub timestamp: String,
    pub modified: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EvidenceManifest {
    pub generated_at: String,
    pub evidence_dir: String,
    pub artifacts: Vec<EvidenceArtifact>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolInfo {
    pub name: String,
    pub description: String,
    pub category: String,
    pub installed: bool,
    pub version: Option<String>,
    pub install_method: Option<String>,
    pub wsl_preferred: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub size: String,
    pub modified: String,
    pub digest: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TriageRequest {
    pub findings: Vec<FindingInput>,
    pub model: String,
    pub context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FindingInput {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: String,
    pub mitre_techniques: Vec<String>,
    pub evidence: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TriageResult {
    pub findings: Vec<TriageFinding>,
    pub summary: String,
    pub risk_score: f32,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TriageFinding {
    pub original_id: String,
    pub title: String,
    pub severity: String,
    pub confidence: f32,
    pub analysis: String,
    pub remediation: String,
    pub mitre_mapping: Vec<String>,
    pub false_positive_likelihood: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkRequest {
    pub iterations: u32,
    pub playbooks: Vec<String>,
    pub include_install: bool,
    pub include_wsl: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkResult {
    pub id: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub iterations: u32,
    pub playbooks: Vec<PlaybookBenchmark>,
    pub summary: BenchmarkSummary,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookBenchmark {
    pub playbook: String,
    pub runs: Vec<BenchmarkRun>,
    pub avg_duration_ms: u64,
    pub min_duration_ms: u64,
    pub max_duration_ms: u64,
    pub success_rate: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkRun {
    pub iteration: u32,
    pub duration_ms: u64,
    pub success: bool,
    pub error: Option<String>,
    pub steps_duration: HashMap<String, u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkSummary {
    pub total_runs: u32,
    pub successful_runs: u32,
    pub failed_runs: u32,
    pub avg_duration_ms: u64,
    pub total_duration_ms: u64,
}

// ============================================================================
// State Management
// ============================================================================

pub struct AppState {
    pub running_playbooks: Mutex<HashMap<String, PlaybookStatus>>,
    pub benchmarks: Mutex<HashMap<String, BenchmarkResult>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            running_playbooks: Mutex::new(HashMap::new()),
            benchmarks: Mutex::new(HashMap::new()),
        }
    }
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String> {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let hostname = hostname::get().unwrap_or_default().to_string_lossy().to_string();
    let username = whoami::username();

    // Check secwin version
    let secwin_version = Command::new("secwin")
        .arg("--version")
        .output()
        .await
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string());

    // Check secwin path
    let secwin_path = which::which("secwin").ok().map(|p| p.to_string_lossy().to_string());

    // Check WSL
    let wsl_output = Command::new("wsl")
        .args(["-l", "-v"])
        .output()
        .await;
    let wsl_available = wsl_output.is_ok();
    let wsl_distros = if let Ok(output) = wsl_output {
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .skip(1)
            .filter_map(|l| {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 1 {
                    Some(parts[0].trim_start_matches('*').trim().to_string())
                } else {
                    None
                }
            })
            .collect()
    } else {
        Vec::new()
    };

    // Check Ollama
    let ollama_output = Command::new("ollama")
        .arg("list")
        .output()
        .await;
    let ollama_available = ollama_output.is_ok();
    let ollama_models = if let Ok(output) = ollama_output {
        parse_ollama_list(&String::from_utf8_lossy(&output.stdout))
    } else {
        Vec::new()
    };

    // Get OS version on Windows
    let os_version = if cfg!(target_os = "windows") {
        get_windows_version()
    } else {
        std::env::consts::OS.to_string()
    };

    Ok(SystemInfo {
        os,
        os_version,
        arch,
        hostname,
        username,
        secwin_version,
        secwin_path,
        wsl_available,
        wsl_distros,
        ollama_available,
        ollama_models,
    })
}

fn get_windows_version() -> String {
    use std::process::Command;
    if let Ok(output) = Command::new("cmd")
        .args(["/C", "ver"])
        .output()
    {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        "Unknown".to_string()
    }
}

fn parse_ollama_list(output: &str) -> Vec<String> {
    output
        .lines()
        .skip(1)
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if !parts.is_empty() {
                Some(parts[0].to_string())
            } else {
                None
            }
        })
        .collect()
}

#[tauri::command]
async fn run_secwin_command(
    app: AppHandle,
    args: Vec<String>,
    working_dir: Option<String>,
) -> Result<SecwinCommandResult, String> {
    let start = Instant::now();

    let mut cmd = Command::new("secwin");
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

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

    let status = child.wait().await.map_err(|e| format!("Failed to wait: {}", e))?;
    let duration = start.elapsed();

    Ok(SecwinCommandResult {
        success: status.success(),
        stdout: stdout_lines.join("\n"),
        stderr: stderr_lines.join("\n"),
        exit_code: status.code(),
        duration_ms: duration.as_millis() as u64,
    })
}

#[tauri::command]
async fn list_playbooks() -> Result<Vec<PlaybookInfo>, String> {
    let playbooks_dir = PathBuf::from("playbooks");
    let mut playbooks = Vec::new();

    if !playbooks_dir.exists() {
        return Ok(playbooks);
    }

    let entries = std::fs::read_dir(playbooks_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("yaml")
            || path.extension().and_then(|s| s.to_str()) == Some("yml")
        {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(pb) = serde_yaml::from_str::<serde_json::Value>(&content) {
                    playbooks.push(PlaybookInfo {
                        name: pb["metadata"]["name"].as_str().unwrap_or("").to_string(),
                        path: path.to_string_lossy().to_string(),
                        version: pb["metadata"]["version"].as_str().unwrap_or("1.0").to_string(),
                        description: pb["metadata"]["description"].as_str().unwrap_or("").to_string(),
                        mitre_tactics: pb["metadata"]["mitre_tactics"]
                            .as_sequence()
                            .unwrap_or(&Vec::new())
                            .iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect(),
                        tags: pb["metadata"]["tags"]
                            .as_sequence()
                            .unwrap_or(&Vec::new())
                            .iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect(),
                    });
                }
            }
        }
    }

    Ok(playbooks)
}

#[tauri::command]
async fn run_playbook(
    app: AppHandle,
    state: State<'_, AppState>,
    request: PlaybookRunRequest,
) -> Result<String, String> {
    let run_id = Uuid::new_v4().to_string();

    let mut status = PlaybookStatus {
        id: run_id.clone(),
        playbook: request.playbook.clone(),
        status: "running".to_string(),
        started_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
        duration_ms: None,
        current_step: None,
        progress: 0.0,
        steps_completed: 0,
        steps_total: 0,
        findings_count: 0,
        artifacts_count: 0,
        report_path: None,
        error: None,
    };

    state.running_playbooks.lock().unwrap().insert(run_id.clone(), status.clone());
    app.emit("playbook-status", &status).ok();

    let run_id_clone = run_id.clone();
    let app_clone = app.clone();
    let state_clone = state.inner().clone();
    let request_clone = request.clone();

    tokio::spawn(async move {
        let result = execute_playbook_internal(
            app_clone,
            state_clone,
            run_id_clone,
            request_clone,
        ).await;

        let mut status = state_clone.running_playbooks.lock().unwrap().get(&run_id_clone).unwrap().clone();
        status.status = if result.is_ok() { "completed" } else { "failed" };
        status.completed_at = Some(chrono::Utc::now().to_rfc3339());
        status.duration_ms = Some(
            chrono::DateTime::parse_from_rfc3339(&status.started_at)
                .map(|start| chrono::Utc::now().signed_duration_since(start).num_milliseconds() as u64)
                .unwrap_or(0),
        );
        status.error = result.err().map(|e| e.to_string());
        state_clone.running_playbooks.lock().unwrap().insert(run_id_clone.clone(), status.clone());
        app_clone.emit("playbook-status", &status).ok();
    });

    Ok(run_id)
}

async fn execute_playbook_internal(
    app: AppHandle,
    state: Arc<AppState>,
    run_id: String,
    request: PlaybookRunRequest,
) -> Result<(), String> {
    let mut args = vec!["playbook", "run", &request.playbook];

    if request.dry_run {
        args.push("--dry-run");
    }

    if let Some(output_dir) = request.output_dir {
        args.extend(["--output", &output_dir]);
    }

    for (k, v) in request.variables {
        args.extend(["--var", &format!("{}={}", k, v)]);
    }

    let mut cmd = Command::new("secwin");
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);

    let mut stdout_stream = stdout_reader.lines();
    let mut stderr_stream = stderr_reader.lines();

    // Parse output for progress updates
    while let Ok(Some(line)) = stdout_stream.next_line().await {
        println!("secwin: {}", line);

        // Update progress based on output
        if line.contains("Running step") || line.contains("Step:") {
            if let Some(step) = extract_step_name(&line) {
                update_playbook_step(&state, &run_id, &step, &app).await;
            }
        }
    }

    // Wait for completion
    let status = child.wait().await.map_err(|e| format!("Wait failed: {}", e))?;

    // Read stderr
    let mut stderr_output = String::new();
    while let Ok(Some(line)) = stderr_stream.next_line().await {
        stderr_output.push_str(&line);
        stderr_output.push('\n');
    }

    if !status.success() {
        return Err(stderr_output);
    }

    Ok(())
}

fn extract_step_name(line: &str) -> Option<String> {
    if let Some(idx) = line.find("Step:") {
        let rest = &line[idx + 5..];
        return Some(rest.trim().to_string());
    }
    if let Some(idx) = line.find("Running step") {
        let rest = &line[idx + 12..];
        return Some(rest.trim().to_string());
    }
    None
}

async fn update_playbook_step(state: &Arc<AppState>, run_id: &str, step: &str, app: &AppHandle) {
    if let Some(status) = state.running_playbooks.lock().unwrap().get_mut(run_id) {
        status.current_step = Some(step.to_string());
        status.steps_completed += 1;
        app.emit("playbook-status", status).ok();
    }
}

#[tauri::command]
async fn get_playbook_status(
    state: State<'_, AppState>,
    run_id: String,
) -> Result<Option<PlaybookStatus>, String> {
    Ok(state.running_playbooks.lock().unwrap().get(&run_id).cloned())
}

#[tauri::command]
async fn stop_playbook(
    state: State<'_, AppState>,
    run_id: String,
) -> Result<bool, String> {
    // Send Ctrl+C to the process
    let mut playbooks = state.running_playbooks.lock().unwrap();
    if let Some(status) = playbooks.get_mut(&run_id) {
        status.status = "stopped".to_string();
        status.completed_at = Some(chrono::Utc::now().to_rfc3339());
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn list_profiles() -> Result<Vec<ProfileInfo>, String> {
    let output = Command::new("secwin")
        .args(["profile", "list"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut profiles = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.starts_with("  ") && !line.is_empty() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if !parts.is_empty() {
                let name = parts[0].trim_end_matches("(active)");
                let active = line.contains("(active)");

                // Get full profile details
                if let Ok(detail_output) = Command::new("secwin")
                    .args(["profile", "show", name])
                    .output()
                    .await
                {
                    let detail = String::from_utf8_lossy(&detail_output.stdout);
                    profiles.push(parse_profile_yaml(name, &detail, active));
                } else {
                    profiles.push(ProfileInfo {
                        name: name.to_string(),
                        vpn_config: None,
                        mac_spoof: false,
                        hostname: None,
                        timezone: None,
                        dns: None,
                        proxy: None,
                        active,
                    });
                }
            }
        }
    }

    Ok(profiles)
}

fn parse_profile_yaml(name: &str, yaml_str: &str, active: bool) -> ProfileInfo {
    if let Ok(val) = serde_yaml::from_str::<serde_json::Value>(yaml_str) {
        ProfileInfo {
            name: name.to_string(),
            vpn_config: val["vpn_config"].as_str().map(String::from),
            mac_spoof: val["mac_spoof"].as_bool().unwrap_or(false),
            hostname: val["hostname"].as_str().map(String::from),
            timezone: val["timezone"].as_str().map(String::from),
            dns: val["dns"].as_str().map(String::from),
            proxy: val["proxy"].as_str().map(String::from),
            active,
        }
    } else {
        ProfileInfo {
            name: name.to_string(),
            vpn_config: None,
            mac_spoof: false,
            hostname: None,
            timezone: None,
            dns: None,
            proxy: None,
            active,
        }
    }
}

#[tauri::command]
async fn engage_profile(name: String) -> Result<SecwinCommandResult, String> {
    run_secwin_command_no_app(vec!["profile", "engage", &name], None).await
}

#[tauri::command]
async fn disengage_profile() -> Result<SecwinCommandResult, String> {
    run_secwin_command_no_app(vec!["profile", "disengage"], None).await
}

#[tauri::command]
async fn get_opsec_status() -> Result<OpSecStatus, String> {
    let output = Command::new("secwin")
        .args(["profile", "status"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut status = OpSecStatus {
        mac_addresses: HashMap::new(),
        hostname: String::new(),
        timezone: String::new(),
        vpn: String::new(),
        http_proxy: None,
        https_proxy: None,
        dns: String::new(),
    };

    for line in stdout.lines() {
        let line = line.trim();
        if line.starts_with("mac_") {
            if let Some(idx) = line.find(':') {
                let key = line[..idx].trim();
                let val = line[idx + 1..].trim();
                status.mac_addresses.insert(key.to_string(), val.to_string());
            }
        } else if let Some(idx) = line.find(':') {
            let key = line[..idx].trim();
            let val = line[idx + 1..].trim();
            match key {
                "hostname" => status.hostname = val.to_string(),
                "timezone" => status.timezone = val.to_string(),
                "vpn" => status.vpn = val.to_string(),
                "http_proxy" => status.http_proxy = Some(val.to_string()),
                "https_proxy" => status.https_proxy = Some(val.to_string()),
                "dns" => status.dns = val.to_string(),
                _ => {}
            }
        }
    }

    Ok(status)
}

#[tauri::command]
async fn list_evidence(dir: Option<String>) -> Result<Vec<EvidenceArtifact>, String> {
    let evidence_dir = dir.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.join(".secwin").join("evidence").to_string_lossy().to_string())
            .unwrap_or_default()
    });

    let output = Command::new("secwin")
        .args(["evidence", "list", &evidence_dir])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut artifacts = Vec::new();

    for line in stdout.lines().skip(2) {
        let line = line.trim();
        if line.starts_with("  ") && !line.is_empty() {
            // Parse: "  filename.ext (.ext, 123 bytes)"
            if let Some(name_end) = line.find(" (") {
                let name = line[2..name_end].trim();
                let rest = &line[name_end + 2..line.len() - 1];
                let parts: Vec<&str> = rest.split(", ").collect();
                let ext = parts.get(0).unwrap_or(&"").trim();
                let size_str = parts.get(1).unwrap_or(&"0 bytes").replace(" bytes", "");
                let size = size_str.parse().unwrap_or(0);

                // Get SHA256
                let artifact_path = std::path::Path::new(&evidence_dir).join(name);
                let sha256 = compute_sha256(&artifact_path).unwrap_or_default();

                artifacts.push(EvidenceArtifact {
                    name: name.to_string(),
                    path: artifact_path.to_string_lossy().to_string(),
                    size,
                    sha256,
                    step_id: "unknown".to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    modified: chrono::Utc::now().to_rfc3339(),
                });
            }
        }
    }

    Ok(artifacts)
}

fn compute_sha256(path: &std::path::Path) -> Option<String> {
    use sha2::{Digest, Sha256};
    let mut file = std::fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher).ok()?;
    Some(format!("{:x}", hasher.finalize()))
}

#[tauri::command]
async fn verify_evidence(dir: Option<String>, strict: bool) -> Result<SecwinCommandResult, String> {
    let evidence_dir = dir.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.join(".secwin").join("evidence").to_string_lossy().to_string())
            .unwrap_or_default()
    });

    let mut args = vec!["evidence", "verify", &evidence_dir];
    if strict {
        args.push("--strict");
    }

    run_secwin_command_no_app(args, None).await
}

#[tauri::command]
async fn export_evidence(
    dir: Option<String>,
    output: Option<String>,
    format: Option<String>,
) -> Result<SecwinCommandResult, String> {
    let evidence_dir = dir.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.join(".secwin").join("evidence").to_string_lossy().to_string())
            .unwrap_or_default()
    });

    let mut args = vec!["evidence", "export", "--dir", &evidence_dir];
    if let Some(out) = output {
        args.extend(["--output", &out]);
    }
    if let Some(fmt) = format {
        args.extend(["--format", &fmt]);
    }

    run_secwin_command_no_app(args, None).await
}

#[tauri::command]
async fn list_tools() -> Result<Vec<ToolInfo>, String> {
    let output = Command::new("secwin")
        .args(["list", "--json"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let tools: Vec<ToolInfo> = serde_json::from_str(&stdout).unwrap_or_default();
    Ok(tools)
}

#[tauri::command]
async fn install_tool(name: String, method: Option<String>) -> Result<SecwinCommandResult, String> {
    let mut args = vec!["install", &name];
    if let Some(m) = method {
        args.extend(["--method", &m]);
    }
    run_secwin_command_no_app(args, None).await
}

#[tauri::command]
async fn search_tools(query: String) -> Result<Vec<ToolInfo>, String> {
    let output = Command::new("secwin")
        .args(["search", &query, "--json"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let tools: Vec<ToolInfo> = serde_json::from_str(&stdout).unwrap_or_default();
    Ok(tools)
}

async fn run_secwin_command_no_app(args: Vec<String>, working_dir: Option<String>) -> Result<SecwinCommandResult, String> {
    let start = Instant::now();

    let mut cmd = Command::new("secwin");
    cmd.args(&args).stdout(Stdio::piped()).stderr(Stdio::piped());

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    let output = cmd.output().await.map_err(|e| e.to_string())?;
    let duration = start.elapsed();

    Ok(SecwinCommandResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
        duration_ms: duration.as_millis() as u64,
    })
}

#[tauri::command]
pub async fn get_ollama_models() -> Result<Vec<OllamaModel>, String> {
    let output = Command::new("ollama")
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

#[tauri::command]
async fn triage_findings(request: TriageRequest) -> Result<TriageResult, String> {
    // Build prompt for Ollama
    let prompt = build_triage_prompt(&request);

    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:11434/api/generate")
        .json(&serde_json::json!({
            "model": request.model,
            "prompt": prompt,
            "stream": false,
            "format": "json",
            "options": {
                "temperature": 0.3,
                "top_p": 0.9
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let result: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    parse_triage_response(&result["response"].as_str().unwrap_or(""))
}

fn build_triage_prompt(request: &TriageRequest) -> String {
    let mut prompt = String::from(
        "You are a senior security analyst triaging penetration test findings. \
        Analyze each finding and provide: severity assessment, confidence score, \
        detailed analysis, remediation steps, MITRE ATT&CK mapping, and false positive likelihood. \
        Return ONLY valid JSON matching this schema:\n\
        {\n\
          \"findings\": [\n\
            {\n\
              \"original_id\": \"string\",\n\
              \"title\": \"string\",\n\
              \"severity\": \"critical|high|medium|low|info\",\n\
              \"confidence\": 0.0-1.0,\n\
              \"analysis\": \"string\",\n\
              \"remediation\": \"string\",\n\
              \"mitre_mapping\": [\"string\"],\n\
              \"false_positive_likelihood\": 0.0-1.0\n\
            }\n\
          ],\n\
          \"summary\": \"string\",\n\
          \"risk_score\": 0.0-10.0,\n\
          \"recommendations\": [\"string\"]\n\
        }\n\n"
    );

    prompt.push_str("Context: ");
    prompt.push_str(request.context.as_deref().unwrap_or("Standard penetration test engagement"));
    prompt.push_str("\n\nFindings to triage:\n");

    for (i, f) in request.findings.iter().enumerate() {
        prompt.push_str(&format!(
            "\n--- Finding {} ---\nID: {}\nTitle: {}\nDescription: {}\nSeverity: {}\nMITRE: {}\nEvidence: {}\n",
            i + 1,
            f.id,
            f.title,
            f.description,
            f.severity,
            f.mitre_techniques.join(", "),
            serde_json::to_string(&f.evidence).unwrap_or_default()
        ));
    }

    prompt
}

fn parse_triage_response(response: &str) -> Result<TriageResult, String> {
    // Try to extract JSON from response
    let json_start = response.find('{').unwrap_or(0);
    let json_end = response.rfind('}').map(|i| i + 1).unwrap_or(response.len());
    let json_str = &response[json_start..json_end];

    serde_json::from_str(json_str).map_err(|e| format!("Failed to parse triage response: {}", e))
}

#[tauri::command]
async fn benchmark_secwin(
    state: State<'_, AppState>,
    request: BenchmarkRequest,
) -> Result<String, String> {
    let benchmark_id = Uuid::new_v4().to_string();

    let mut result = BenchmarkResult {
        id: benchmark_id.clone(),
        started_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
        duration_ms: None,
        iterations: request.iterations,
        playbooks: Vec::new(),
        summary: BenchmarkSummary {
            total_runs: 0,
            successful_runs: 0,
            failed_runs: 0,
            avg_duration_ms: 0,
            total_duration_ms: 0,
        },
    };

    state.benchmarks.lock().unwrap().insert(benchmark_id.clone(), result.clone());

    let state_clone = state.inner().clone();
    let benchmark_id_clone = benchmark_id.clone();

    tokio::spawn(async move {
        run_benchmarks(state_clone, benchmark_id_clone, request).await;
    });

    Ok(benchmark_id)
}

async fn run_benchmarks(state: Arc<AppState>, benchmark_id: String, request: BenchmarkRequest) {
    let playbooks = if request.playbooks.is_empty() {
        vec!["external-recon".to_string(), "web-app-test".to_string()]
    } else {
        request.playbooks
    };

    let mut all_runs = Vec::new();
    let total_start = Instant::now();

    for playbook in &playbooks {
        let mut playbook_benchmark = PlaybookBenchmark {
            playbook: playbook.clone(),
            runs: Vec::new(),
            avg_duration_ms: 0,
            min_duration_ms: u64::MAX,
            max_duration_ms: 0,
            success_rate: 0.0,
        };

        for i in 0..request.iterations {
            let run_start = Instant::now();

            let mut args = vec!["playbook", "run", playbook];
            if !request.include_install {
                args.push("--skip-install");
            }

            let output = Command::new("secwin")
                .args(&args)
                .output()
                .await;

            let duration = run_start.elapsed().as_millis() as u64;
            let success = output.as_ref().map(|o| o.status.success()).unwrap_or(false);
            let error = if !success {
                output.as_ref().map(|o| String::from_utf8_lossy(&o.stderr).to_string())
            } else {
                None
            };

            let run = BenchmarkRun {
                iteration: i + 1,
                duration_ms: duration,
                success,
                error,
                steps_duration: HashMap::new(),
            };

            playbook_benchmark.runs.push(run);
            all_runs.push((playbook.clone(), duration, success));

            // Update progress
            if let Some(bench) = state.benchmarks.lock().unwrap().get_mut(&benchmark_id) {
                bench.playbooks = vec![playbook_benchmark.clone()];
            }
        }

        // Calculate stats
        let durations: Vec<u64> = playbook_benchmark.runs.iter().map(|r| r.duration_ms).collect();
        let successful: Vec<u64> = playbook_benchmark.runs.iter().filter(|r| r.success).map(|r| r.duration_ms).collect();

        playbook_benchmark.avg_duration_ms = if !durations.is_empty() {
            durations.iter().sum::<u64>() / durations.len() as u64
        } else {
            0
        };
        playbook_benchmark.min_duration_ms = *durations.iter().min().unwrap_or(&0);
        playbook_benchmark.max_duration_ms = *durations.iter().max().unwrap_or(&0);
        playbook_benchmark.success_rate = if !playbook_benchmark.runs.is_empty() {
            successful.len() as f32 / playbook_benchmark.runs.len() as f32
        } else {
            0.0
        };

        if let Some(bench) = state.benchmarks.lock().unwrap().get_mut(&benchmark_id) {
            bench.playbooks.push(playbook_benchmark);
        }
    }

    // Final summary
    let total_duration = total_start.elapsed().as_millis() as u64;
    let successful_runs = all_runs.iter().filter(|(_, _, s)| *s).count() as u32;
    let failed_runs = all_runs.len() as u32 - successful_runs;
    let avg_duration = if !all_runs.is_empty() {
        all_runs.iter().map(|(_, d, _)| *d).sum::<u64>() / all_runs.len() as u64
    } else {
        0
    };

    if let Some(bench) = state.benchmarks.lock().unwrap().get_mut(&benchmark_id) {
        bench.completed_at = Some(chrono::Utc::now().to_rfc3339());
        bench.duration_ms = Some(total_duration);
        bench.summary = BenchmarkSummary {
            total_runs: all_runs.len() as u32,
            successful_runs,
            failed_runs,
            avg_duration_ms: avg_duration,
            total_duration_ms: total_duration,
        };
    }
}

#[tauri::command]
async fn get_benchmark_results(
    state: State<'_, AppState>,
    benchmark_id: String,
) -> Result<Option<BenchmarkResult>, String> {
    Ok(state.benchmarks.lock().unwrap().get(&benchmark_id).cloned())
}

#[tauri::command]
async fn list_benchmarks(
    state: State<'_, AppState>,
) -> Result<Vec<BenchmarkResult>, String> {
    let benchmarks = state.benchmarks.lock().unwrap();
    Ok(benchmarks.values().cloned().collect())
}

#[tauri::command]
async fn compare_benchmarks(
    state: State<'_, AppState>,
    baseline_id: String,
    current_id: String,
) -> Result<BenchmarkComparison, String> {
    let benchmarks = state.benchmarks.lock().unwrap();

    let baseline = benchmarks.get(&baseline_id)
        .ok_or_else(|| format!("Baseline benchmark not found: {}", baseline_id))?;
    let current = benchmarks.get(&current_id)
        .ok_or_else(|| format!("Current benchmark not found: {}", current_id))?;

    Ok(compare_benchmark_results(baseline, current))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkComparison {
    pub baseline_id: String,
    pub current_id: String,
    pub playbooks: Vec<PlaybookBenchmarkComparison>,
    pub summary: BenchmarkComparisonSummary,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookBenchmarkComparison {
    pub playbook: String,
    pub baseline_avg_ms: u64,
    pub current_avg_ms: u64,
    pub diff_ms: i64,
    pub diff_percent: f32,
    pub baseline_success_rate: f32,
    pub current_success_rate: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkComparisonSummary {
    pub total_playbooks: usize,
    pub improved: usize,
    pub regressed: usize,
    pub unchanged: usize,
    pub overall_diff_percent: f32,
}

fn compare_benchmark_results(baseline: &BenchmarkResult, current: &BenchmarkResult) -> BenchmarkComparison {
    let mut playbooks = Vec::new();
    let mut improved = 0;
    let mut regressed = 0;
    let mut unchanged = 0;
    let mut total_diff_percent = 0.0;

    // Create maps for easier lookup
    let mut baseline_map = std::collections::HashMap::new();
    for pb in &baseline.playbooks {
        baseline_map.insert(pb.playbook.clone(), pb);
    }

    for current_pb in &current.playbooks {
        if let Some(baseline_pb) = baseline_map.get(&current_pb.playbook) {
            let diff_ms = current_pb.avg_duration_ms as i64 - baseline_pb.avg_duration_ms as i64;
            let diff_percent = if baseline_pb.avg_duration_ms > 0 {
                (diff_ms as f32 / baseline_pb.avg_duration_ms as f32) * 100.0
            } else {
                0.0
            };
            total_diff_percent += diff_percent;

            let mut status = "unchanged";
            if diff_percent < -5.0 {
                improved += 1;
                status = "improved";
            } else if diff_percent > 5.0 {
                regressed += 1;
                status = "regressed";
            } else {
                unchanged += 1;
            }

            playbooks.push(PlaybookBenchmarkComparison {
                playbook: current_pb.playbook.clone(),
                baseline_avg_ms: baseline_pb.avg_duration_ms,
                current_avg_ms: current_pb.avg_duration_ms,
                diff_ms,
                diff_percent,
                baseline_success_rate: baseline_pb.success_rate,
                current_success_rate: current_pb.success_rate,
            });
        }
    }

    BenchmarkComparison {
        baseline_id: baseline.id.clone(),
        current_id: current.id.clone(),
        playbooks,
        summary: BenchmarkComparisonSummary {
            total_playbooks: playbooks.len(),
            improved,
            regressed,
            unchanged,
            overall_diff_percent: if playbooks.is_empty() { 0.0 } else { total_diff_percent / playbooks.len() as f32 },
        },
    }
}
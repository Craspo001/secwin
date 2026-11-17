use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
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
pub struct ProfileCreateRequest {
    pub name: String,
    pub vpn_config: Option<String>,
    pub mac_spoof: bool,
    pub hostname: Option<String>,
    pub timezone: Option<String>,
    pub dns: Option<String>,
    pub proxy: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playbook {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub path: String,
    pub mitre_tactics: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookRunRequest {
    pub playbook_id: String,
    pub variables: HashMap<String, serde_json::Value>,
    pub formats: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookRunResult {
    pub success: bool,
    pub playbook_id: String,
    pub duration_ms: u64,
    pub report_path: Option<String>,
    pub evidence_dir: Option<String>,
    pub findings: Vec<Finding>,
    pub artifacts: Vec<Artifact>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookStatus {
    pub running: bool,
    pub playbook_id: Option<String>,
    pub current_step: Option<String>,
    pub progress: f32,
    pub started_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EvidenceArtifact {
    pub name: String,
    pub path: String,
    pub sha256: String,
    pub size: u64,
    pub step_id: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Finding {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: String,
    pub mitre_techniques: Vec<String>,
    pub evidence: HashMap<String, String>,
    pub step_id: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Report {
    pub id: String,
    pub playbook_name: String,
    pub format: String,
    pub path: String,
    pub created_at: DateTime<Utc>,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub username: String,
    pub secwin_version: String,
    pub wsl_available: bool,
    pub wsl_distros: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Settings {
    #[default = "http://localhost:11434"]
    pub ollama_url: String,
    #[default = ""]
    pub ollama_model: String,
    #[default = ""]
    pub default_evidence_dir: String,
    #[default = ""]
    pub default_report_dir: String,
    pub auto_engage_profile: Option<String>,
    #[default = "system"]
    pub theme: String,
}

/// Ollama-specific settings (stored separately from main SecWin config)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct OllamaSettings {
    #[default = "http://localhost:11434"]
    pub ollama_url: String,
    #[default = ""]
    pub ollama_model: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaRequest {
    pub model: String,
    pub prompt: String,
    pub stream: bool,
    pub options: Option<OllamaOptions>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaOptions {
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<i32>,
    pub num_predict: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaResponse {
    pub model: String,
    pub created_at: String,
    pub response: String,
    pub done: bool,
    pub context: Option<Vec<i32>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaChatRequest {
    pub model: String,
    pub messages: Vec<OllamaMessage>,
    pub stream: bool,
    pub options: Option<OllamaOptions>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaChatResponse {
    pub model: String,
    pub created_at: String,
    pub message: OllamaMessage,
    pub done: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TriageResult {
    pub finding_id: String,
    pub summary: String,
    pub severity_assessment: String,
    pub recommended_actions: Vec<String>,
    pub mitre_mapping: Vec<MitreMapping>,
    pub confidence: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MitreMapping {
    pub technique_id: String,
    pub technique_name: String,
    pub tactic: String,
    pub confidence: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SummaryResult {
    pub executive_summary: String,
    pub key_findings: Vec<KeyFinding>,
    pub risk_score: f32,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KeyFinding {
    pub title: String,
    pub severity: String,
    pub impact: String,
    pub likelihood: String,
}
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkConfig {
    pub iterations: usize,
    pub playbooks: Vec<String>,
    pub include_install: bool,
    pub include_wsl: bool,
    pub variables: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkResult {
    pub id: String,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub duration_ms: u64,
    pub iterations: usize,
    pub playbooks: Vec<PlaybookBenchmark>,
    pub summary: BenchmarkSummary,
    pub config: BenchmarkConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookBenchmark {
    pub playbook: String,
    pub runs: Vec<BenchmarkRun>,
    pub avg_duration_ms: u64,
    pub min_duration_ms: u64,
    pub max_duration_ms: u64,
    pub success_rate: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkRun {
    pub iteration: usize,
    pub duration_ms: u64,
    pub success: bool,
    pub error: Option<String>,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BenchmarkSummary {
    pub total_runs: usize,
    pub successful_runs: usize,
    pub failed_runs: usize,
    pub avg_duration_ms: u64,
    pub total_duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComparisonResult {
    pub before_id: String,
    pub after_id: String,
    pub before_summary: BenchmarkSummary,
    pub after_summary: BenchmarkSummary,
    pub playbook_comparisons: Vec<PlaybookComparison>,
    pub overall_improvement: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookComparison {
    pub playbook: String,
    pub before_avg_ms: u64,
    pub after_avg_ms: u64,
    pub improvement_pct: f64,
    pub before_success_rate: f64,
    pub after_success_rate: f64,
}

impl ComparisonResult {
    pub fn compare(before: &BenchmarkResult, after: &BenchmarkResult) -> Self {
        let mut playbook_comparisons = Vec::new();

        for before_pb in &before.playbooks {
            if let Some(after_pb) = after.playbooks.iter().find(|p| p.playbook == before_pb.playbook) {
                let improvement_pct = if before_pb.avg_duration_ms > 0 {
                    ((before_pb.avg_duration_ms as f64 - after_pb.avg_duration_ms as f64) / before_pb.avg_duration_ms as f64) * 100.0
                } else {
                    0.0
                };

                playbook_comparisons.push(PlaybookComparison {
                    playbook: before_pb.playbook.clone(),
                    before_avg_ms: before_pb.avg_duration_ms,
                    after_avg_ms: after_pb.avg_duration_ms,
                    improvement_pct,
                    before_success_rate: before_pb.success_rate,
                    after_success_rate: after_pb.success_rate,
                });
            }
        }

        let overall_improvement = if before.summary.avg_duration_ms > 0 {
            ((before.summary.avg_duration_ms as f64 - after.summary.avg_duration_ms as f64) / before.summary.avg_duration_ms as f64) * 100.0
        } else {
            0.0
        };

        ComparisonResult {
            before_id: before.id.clone(),
            after_id: after.id.clone(),
            before_summary: before.summary.clone(),
            after_summary: after.summary.clone(),
            playbook_comparisons,
            overall_improvement,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tool {
    pub name: String,
    pub version: String,
    pub description: String,
    pub category: String,
    pub installed: bool,
    pub install_method: Option<String>,
    pub wsl_preferred: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playbook {
    pub metadata: PlaybookMetadata,
    pub variables: HashMap<String, Variable>,
    pub steps: Vec<Step>,
    pub outputs: Option<Outputs>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaybookMetadata {
    pub name: String,
    pub version: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub mitre_tactics: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Variable {
    pub r#type: String,
    pub required: Option<bool>,
    pub default: Option<serde_json::Value>,
    pub description: Option<String>,
    pub validation: Option<String>,
    pub secret: Option<bool>,
    pub r#enum: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Step {
    pub id: String,
    pub name: String,
    pub tool: String,
    pub args: Option<Vec<String>>,
    pub condition: Option<String>,
    pub retry: Option<i32>,
    pub timeout: Option<String>,
    pub artifacts: Option<Vec<String>>,
    pub mitre_techniques: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    pub working_dir: Option<String>,
    pub continue_on_error: Option<bool>,
    pub parallel: Option<Vec<Step>>,
    pub foreach: Option<ForeachSpec>,
    pub r#if: Option<IfSpec>,
    pub r#try: Option<TrySpec>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ForeachSpec {
    pub variable: String,
    pub r#in: String,
    pub steps: Vec<Step>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IfSpec {
    pub condition: String,
    pub then: Vec<Step>,
    pub r#else: Option<Vec<Step>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrySpec {
    pub steps: Vec<Step>,
    pub r#catch: Option<Vec<Step>>,
    pub r#finally: Option<Vec<Step>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Outputs {
    pub findings: Option<String>,
    pub report: Option<String>,
    pub evidence_dir: Option<String>,
    pub formats: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub name: String,
    pub vpn_config: Option<String>,
    pub mac_spoof: bool,
    pub hostname: Option<String>,
    pub timezone: Option<String>,
    pub dns: Option<String>,
    pub proxy: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EvidenceArtifact {
    pub name: String,
    pub path: String,
    pub sha256: String,
    pub size: u64,
    pub step_id: Option<String>,
    pub timestamp: Option<String>,
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
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExecutionResult {
    pub success: bool,
    pub duration: String,
    pub step_results: HashMap<String, StepResult>,
    pub findings: Vec<Finding>,
    pub artifacts: HashMap<String, String>,
    pub report_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepResult {
    pub step_id: String,
    pub success: bool,
    pub output: String,
    pub error: String,
    pub duration: String,
    pub artifacts: HashMap<String, String>,
    pub started_at: String,
    pub completed_at: String,
    pub retries: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpSecStatus {
    pub hostname: String,
    pub timezone: String,
    pub vpn: String,
    pub http_proxy: String,
    pub https_proxy: String,
    pub dns: String,
    pub mac_addresses: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub secwin_version: String,
    pub wsl_available: bool,
    pub wsl_distros: Vec<String>,
    pub cpu_count: usize,
    pub total_memory: u64,
    pub used_memory: u64,
    pub available_memory: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub tool_dir: String,
    pub bin_dir: String,
    pub manifest_dirs: Vec<String>,
    pub wsl: WSLConfig,
    pub network: NetworkConfig,
    pub reporting: ReportingConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WSLConfig {
    pub default_distro: String,
    pub environment: HashMap<String, String>,
    pub mount_drives: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkConfig {
    pub default_interface: Option<String>,
    pub proxy_url: Option<String>,
    pub no_proxy: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReportingConfig {
    pub default_template: String,
    pub output_formats: Vec<String>,
    pub evidence_retention_days: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TriageResult {
    pub finding_id: String,
    pub original_severity: String,
    pub suggested_severity: String,
    pub confidence: f64,
    pub reasoning: String,
    pub mitre_tags: Vec<String>,
    pub recommended_actions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub size: String,
    pub modified: String,
    pub digest: String,
}
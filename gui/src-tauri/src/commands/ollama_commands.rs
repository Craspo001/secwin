// Re-export Ollama commands from ollama.rs
use crate::ollama::{ollama_triage_findings, ollama_summarize_report, ollama_suggest_mitre, ollama_save_settings, ollama_get_settings};

pub use ollama_triage_findings;
pub use ollama_summarize_report;
pub use ollama_suggest_mitre;
pub use ollama_save_settings;
pub use ollama_get_settings;
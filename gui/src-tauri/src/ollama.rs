use crate::types::*;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

const OLLAMA_TIMEOUT: Duration = Duration::from_secs(120);

pub struct OllamaClient {
    client: Client,
    base_url: String,
    model: String,
}

// Aggregated triage response matching frontend expectations
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AggregatedTriageResult {
    pub findings: Vec<TriageFindingOutput>,
    pub summary: String,
    pub risk_score: f32,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TriageFindingOutput {
    pub original_id: String,
    pub title: String,
    pub severity: String,
    pub confidence: f32,
    pub analysis: String,
    pub remediation: String,
    pub mitre_mapping: Vec<String>,
    pub false_positive_likelihood: f32,
}

impl OllamaClient {
    pub fn new(base_url: String, model: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(OLLAMA_TIMEOUT)
                .build()
                .unwrap(),
            base_url: base_url.trim_end_matches('/').to_string(),
            model,
        }
    }

    pub async fn generate(&self, prompt: String, options: Option<OllamaOptions>) -> Result<String, String> {
        let request = OllamaRequest {
            model: self.model.clone(),
            prompt,
            stream: false,
            options,
        };

        let response = self.client
            .post(&format!("{}/api/generate", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?;

        if !response.status().is_success() {
            let error = response.text().await.unwrap_or_default();
            return Err(format!("Ollama error: {}", error));
        }

        let result: OllamaResponse = response.json().await.map_err(|e| e.to_string())?;
        Ok(result.response)
    }

    pub async fn chat(&self, messages: Vec<OllamaMessage>, options: Option<OllamaOptions>) -> Result<String, String> {
        let request = OllamaChatRequest {
            model: self.model.clone(),
            messages,
            stream: false,
            options,
        };

        let response = self.client
            .post(&format!("{}/api/chat", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?;

        if !response.status().is_success() {
            let error = response.text().await.unwrap_or_default();
            return Err(format!("Ollama error: {}", error));
        }

        let result: OllamaChatResponse = response.json().await.map_err(|e| e.to_string())?;
        Ok(result.message.content)
    }

    pub async fn list_models(&self) -> Result<Vec<String>, String> {
        let response = self.client
            .get(&format!("{}/api/tags", self.base_url))
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?;

        if !response.status().is_success() {
            return Err("Failed to list models".to_string());
        }

        let result: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        let models = result["models"].as_array()
            .unwrap_or(&Vec::new())
            .iter()
            .filter_map(|m| m["name"].as_str().map(String::from))
            .collect();

        Ok(models)
    }

    pub async fn triage_findings(&self, findings: &[Finding], context: Option<&str>) -> Result<AggregatedTriageResult, String> {
        let findings_json = serde_json::to_string_pretty(findings).map_err(|e| e.to_string())?;

        let prompt = format!(
            r#"You are a senior security analyst triaging findings from a penetration test or red team engagement.

Analyze the following findings and provide a structured triage for each:

{}

Context: {}

For each finding, provide:
1. A concise analysis (2-3 sentences)
2. Severity assessment (Critical/High/Medium/Low/Info)
3. Recommended immediate actions (3-5 specific steps)
4. MITRE ATT&CK technique mappings (technique IDs)
5. Confidence in your assessment (0.0-1.0)
6. False positive likelihood (0.0-1.0)

Also provide:
- Overall risk score (0.0-10.0)
- Executive summary (2-3 paragraphs)
- Strategic recommendations (5-7 actionable items)

Return as JSON with fields:
{{
  "findings": [
    {{
      "original_id": "string",
      "title": "string",
      "severity": "critical|high|medium|low|info",
      "confidence": 0.0-1.0,
      "analysis": "string",
      "remediation": "string",
      "mitre_mapping": ["T1059.001", "T1068"],
      "false_positive_likelihood": 0.0-1.0
    }}
  ],
  "summary": "string",
  "risk_score": 0.0-10.0,
  "recommendations": ["string"]
}}"#,
            findings_json,
            context.unwrap_or("No additional context provided")
        );

        let response = self.generate(prompt, Some(OllamaOptions {
            temperature: Some(0.3),
            top_p: Some(0.9),
            num_predict: Some(4096),
            ..Default::default()
        })).await?;

        // Try to parse JSON from response
        let triage_result: AggregatedTriageResult = serde_json::from_str(&response)
            .or_else(|_| {
                // Try to extract JSON from markdown code blocks
                let json_str = extract_json(&response)?;
                serde_json::from_str(&json_str)
            })
            .map_err(|e| format!("Failed to parse triage response: {}", e))?;

        Ok(triage_result)
    }

    pub async fn summarize_report(&self, report_data: &serde_json::Value) -> Result<SummaryResult, String> {
        let report_json = serde_json::to_string_pretty(report_data).map_err(|e| e.to_string())?;

        let prompt = format!(
            r#"You are a senior security analyst writing an executive summary for a penetration test report.

Analyze the following engagement data and provide:

{}

Provide:
1. Executive summary (3-5 paragraphs, business-readable)
2. Key findings (top 5-10 by severity/impact)
3. Overall risk score (0.0-10.0)
4. Strategic recommendations (5-7 actionable items)

Return as JSON with fields: executive_summary, key_findings, risk_score, recommendations"#,
            report_json
        );

        let response = self.generate(prompt, Some(OllamaOptions {
            temperature: Some(0.4),
            top_p: Some(0.9),
            num_predict: Some(4096),
            ..Default::default()
        })).await?;

        let summary: SummaryResult = serde_json::from_str(&response)
            .or_else(|_| {
                let json_str = extract_json(&response)?;
                serde_json::from_str(&json_str)
            })
            .map_err(|e| format!("Failed to parse summary response: {}", e))?;

        Ok(summary)
    }

    pub async fn suggest_mitre(&self, description: &str, evidence: &HashMap<String, String>) -> Result<Vec<MitreMapping>, String> {
        let evidence_json = serde_json::to_string_pretty(evidence).map_err(|e| e.to_string())?;

        let prompt = format!(
            r#"You are a MITRE ATT&CK expert. Analyze the following finding description and evidence to suggest relevant ATT&CK techniques.

Finding Description:
{}

Evidence:
{}

Provide up to 5 MITRE ATT&CK technique mappings with:
- Technique ID (e.g., T1059.001)
- Technique Name
- Tactic (e.g., Execution, Persistence)
- Confidence score (0.0-1.0)

Return as JSON array of objects with fields: technique_id, technique_name, tactic, confidence"#,
            description,
            evidence_json
        );

        let response = self.generate(prompt, Some(OllamaOptions {
            temperature: Some(0.2),
            top_p: Some(0.9),
            num_predict: Some(2048),
            ..Default::default()
        })).await?;

        let mappings: Vec<MitreMapping> = serde_json::from_str(&response)
            .or_else(|_| {
                let json_str = extract_json(&response)?;
                serde_json::from_str(&json_str)
            })
            .map_err(|e| format!("Failed to parse MITRE response: {}", e))?;

        Ok(mappings)
    }
}

fn extract_json(text: &str) -> Option<String> {
    // Try to find JSON in markdown code blocks
    if let Some(start) = text.find("```json") {
        let after_start = &text[start + 7..];
        if let Some(end) = after_start.find("```") {
            return Some(after_start[..end].trim().to_string());
        }
    }
    if let Some(start) = text.find("```") {
        let after_start = &text[start + 3..];
        if let Some(end) = after_start.find("```") {
            let candidate = after_start[..end].trim();
            if candidate.starts_with('[') || candidate.starts_with('{') {
                return Some(candidate.to_string());
            }
        }
    }
    // Try to find first { or [
    let first_brace = text.find('{');
    let first_bracket = text.find('[');
    match (first_brace, first_bracket) {
        (Some(b), Some(br)) if b < br => Some(text[b..].to_string()),
        (Some(b), None) => Some(text[b..].to_string()),
        (None, Some(br)) => Some(text[br..].to_string()),
        _ => None,
    }
}

#[tauri::command]
pub async fn ollama_triage_findings(findings: Vec<Finding>, context: Option<String>) -> Result<AggregatedTriageResult, String> {
    let settings = get_settings_internal().await?;
    let client = OllamaClient::new(settings.ollama_url, settings.ollama_model);
    client.triage_findings(&findings, context.as_deref()).await
}

#[tauri::command]
pub async fn ollama_summarize_report(report_data: serde_json::Value) -> Result<SummaryResult, String> {
    let settings = get_settings_internal().await?;
    let client = OllamaClient::new(settings.ollama_url, settings.ollama_model);
    client.summarize_report(&report_data).await
}

#[tauri::command]
pub async fn ollama_suggest_mitre(description: String, evidence: HashMap<String, String>) -> Result<Vec<MitreMapping>, String> {
    let settings = get_settings_internal().await?;
    let client = OllamaClient::new(settings.ollama_url, settings.ollama_model);
    client.suggest_mitre(&description, &evidence).await
}

async fn get_settings_internal() -> Result<OllamaSettings, String> {
    let config_dir = directories::ProjectDirs::from("com", "secwin", "secwin-gui")
        .unwrap()
        .config_dir()
        .to_path_buf();
    let settings_path = config_dir.join("settings.json");

    if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        let settings: OllamaSettings = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(settings)
    } else {
        Ok(OllamaSettings::default())
    }
}

#[tauri::command]
pub async fn ollama_save_settings(settings: OllamaSettings) -> Result<String, String> {
    let config_dir = directories::ProjectDirs::from("com", "secwin", "secwin-gui")
        .unwrap()
        .config_dir()
        .to_path_buf();
    let settings_path = config_dir.join("settings.json");

    // Create config directory if it doesn't exist
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&settings_path, content).map_err(|e| e.to_string())?;

    Ok("Settings saved successfully".to_string())
}

#[tauri::command]
pub async fn ollama_get_settings() -> Result<OllamaSettings, String> {
    get_settings_internal().await
}

impl Default for OllamaOptions {
    fn default() -> Self {
        Self {
            temperature: Some(0.7),
            top_p: Some(0.9),
            top_k: Some(40),
            num_predict: Some(2048),
        }
    }
}
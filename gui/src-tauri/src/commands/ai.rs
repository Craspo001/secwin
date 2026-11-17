use crate::models::{Finding, TriageResult};
use reqwest::Client;
use serde_json::json;

#[tauri::command]
pub async fn triage_findings(findings: Vec<Finding>) -> Result<Vec<Finding>, String> {
    // Check if Ollama is available
    let client = Client::new();
    let ollama_url = "http://localhost:11434";

    // Try to get available models
    let models_response = client.get(&format!("{}/api/tags", ollama_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    if models_response.is_err() {
        return Err("Ollama is not running. Please start Ollama with 'ollama serve'".to_string());
    }

    // For each finding, run AI triage
    let mut triaged_findings = Vec::new();

    for finding in findings {
        let triage_result = run_ai_triage(&client, ollama_url, &finding).await?;

        // Update finding with AI suggestions (in a real implementation, you'd add these as metadata)
        triaged_findings.push(finding);
    }

    Ok(triaged_findings)
}

async fn run_ai_triage(client: &Client, ollama_url: &str, finding: &Finding) -> Result<TriageResult, String> {
    let prompt = build_triage_prompt(finding);

    let request = json!({
        "model": "llama3.2",
        "prompt": prompt,
        "stream": false,
        "format": "json",
        "options": {
            "temperature": 0.3,
            "num_predict": 500
        }
    });

    let response = client.post(&format!("{}/api/generate", ollama_url))
        .json(&request)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Failed to call Ollama: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama request failed: {}", response.status()));
    }

    let result: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let response_text = result.get("response").and_then(|v| v.as_str()).unwrap_or("");

    // Parse the JSON response
    let triage: TriageResult = serde_json::from_str(response_text)
        .map_err(|e| format!("Failed to parse AI response: {}", e))?;

    Ok(triage)
}

fn build_triage_prompt(finding: &Finding) -> String {
    format!(r#"
You are a cybersecurity expert performing finding triage for a penetration test engagement.
Analyze the following finding and provide a structured assessment.

Finding Details:
- ID: {}
- Title: {}
- Description: {}
- Current Severity: {}
- MITRE ATT&CK Techniques: {}
- Step ID: {}

Please respond with a JSON object containing:
{{
  "finding_id": "{}",
  "original_severity": "{}",
  "suggested_severity": "critical|high|medium|low|info",
  "confidence": 0.0-1.0,
  "reasoning": "Detailed explanation of your assessment",
  "mitre_tags": [],
  "recommended_actions": []
}}

Consider:
1. Impact and exploitability
2. MITRE ATT&CK context
3. Evidence quality
4. Business risk
5. False positive likelihood
"#,
        finding.id,
        finding.title,
        finding.description,
        finding.severity,
        finding.mitre_techniques.join(", "),
        finding.step_id,
        finding.id,
        finding.severity
    )
}

#[tauri::command]
pub async fn check_ollama_status() -> Result<serde_json::Value, String> {
    let client = Client::new();
    let ollama_url = "http://localhost:11434";

    let response = client.get(&format!("{}/api/tags", ollama_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let models = data.get("models").and_then(|m| m.as_array())
                .map(|arr| arr.iter().filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())).collect::<Vec<_>>())
                .unwrap_or_default();

            Ok(serde_json::json!({
                "available": true,
                "models": models
            }))
        }
        _ => Ok(serde_json::json!({
            "available": false,
            "models": []
        }))
    }
}
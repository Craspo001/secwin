use crate::models::EvidenceArtifact;
use sha2::{Sha256, Digest};
use std::path::Path;
use walkdir::WalkDir;

#[tauri::command]
pub async fn list_evidence(dir: Option<String>) -> Result<Vec<EvidenceArtifact>, String> {
    let evidence_dir = get_evidence_dir(dir).await?;

    if !evidence_dir.exists() {
        return Ok(Vec::new());
    }

    let mut artifacts = Vec::new();

    for entry in WalkDir::new(&evidence_dir).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path = entry.path();

            // Skip manifest and checksum files
            if path.extension().map_or(false, |ext| ext == "sha256" || ext == "manifest") {
                continue;
            }

            if let Ok(metadata) = entry.metadata() {
                let sha256 = compute_sha256(path).await?;

                artifacts.push(EvidenceArtifact {
                    name: path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    path: path.to_string_lossy().to_string(),
                    sha256,
                    size: metadata.len(),
                    step_id: None,
                    timestamp: metadata.modified()
                        .ok()
                        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()),
                });
            }
        }
    }

    Ok(artifacts)
}

#[tauri::command]
pub async fn verify_evidence(dir: Option<String>, strict: Option<bool>) -> Result<serde_json::Value, String> {
    let evidence_dir = get_evidence_dir(dir).await?;

    if !evidence_dir.exists() {
        return Err("Evidence directory does not exist".to_string());
    }

    let mut verified = 0;
    let mut failed = 0;

    for entry in WalkDir::new(&evidence_dir).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path = entry.path();

            // Skip manifest and checksum files
            if path.extension().map_or(false, |ext| ext == "sha256" || ext == "manifest") {
                continue;
            }

            let sha256 = compute_sha256(path).await?;
            let sha_file = path.with_extension(format!("{}.sha256", path.extension().unwrap_or_default().to_string_lossy()));

            if sha_file.exists() {
                if let Ok(expected) = tokio::fs::read_to_string(&sha_file).await {
                    let expected = expected.trim().strip_prefix("sha256:").unwrap_or(expected.trim());
                    if sha256.eq_ignore_ascii_case(expected) {
                        verified += 1;
                    } else {
                        failed += 1;
                    }
                } else {
                    failed += 1;
                }
            } else if strict.unwrap_or(false) {
                // In strict mode, missing checksum is a failure
                failed += 1;
            } else {
                // No checksum file - count as verified but warn
                verified += 1;
            }
        }
    }

    Ok(serde_json::json!({
        "verified": verified,
        "failed": failed
    }))
}

#[tauri::command]
pub async fn export_evidence(dir: Option<String>, output: Option<String>, format: Option<String>) -> Result<String, String> {
    let evidence_dir = get_evidence_dir(dir).await?;

    if !evidence_dir.exists() {
        return Err("Evidence directory does not exist".to_string());
    }

    let artifacts = list_evidence(Some(evidence_dir.to_string_lossy().to_string())).await?;

    let manifest = serde_json::json!({
        "generated_at": chrono::Utc::now().to_rfc3339(),
        "evidence_dir": evidence_dir.to_string_lossy().to_string(),
        "artifacts": artifacts
    });

    let fmt = format.unwrap_or_else(|| "json".to_string());
    let output_content = match fmt.as_str() {
        "yaml" | "yml" => serde_yaml::to_string(&manifest).map_err(|e| e.to_string())?,
        _ => serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?,
    };

    let output_path = if let Some(out) = output {
        std::path::PathBuf::from(out)
    } else {
        evidence_dir.join(format!("manifest.{}", if fmt == "yaml" { "yaml" } else { "json" }))
    };

    tokio::fs::write(&output_path, output_content).await.map_err(|e| e.to_string())?;

    Ok(output_path.to_string_lossy().to_string())
}

async fn get_evidence_dir(dir: Option<String>) -> Result<std::path::PathBuf, String> {
    if let Some(d) = dir {
        if d != "default" {
            return Ok(std::path::PathBuf::from(d));
        }
    }

    dirs::home_dir()
        .map(|p| p.join(".secwin").join("evidence"))
        .ok_or("Could not find home directory".to_string())
}

async fn compute_sha256(path: &Path) -> Result<String, String> {
    let mut file = tokio::fs::File::open(path).await.map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 8192];

    loop {
        let n = tokio::io::AsyncReadExt::read(&mut file, &mut buffer).await.map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}
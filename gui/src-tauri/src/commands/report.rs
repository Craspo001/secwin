use crate::types::*;
use std::path::PathBuf;
use walkdir::WalkDir;

fn get_reports_dir() -> PathBuf {
    let home = directories::ProjectDirs::from("com", "secwin", "secwin")
        .unwrap()
        .data_dir()
        .to_path_buf();
    home.join("reports")
}

#[tauri::command]
pub async fn list_reports() -> Result<Vec<Report>, String> {
    let reports_dir = get_reports_dir();

    if !reports_dir.exists() {
        return Ok(Vec::new());
    }

    let mut reports = Vec::new();

    for entry in WalkDir::new(&reports_dir).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if !matches!(ext, "md" | "html" | "pdf") {
                continue;
            }

            let name = path.file_name().unwrap().to_string_lossy().to_string();
            let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;

            // Try to extract playbook name from filename
            let playbook_name = name.split('_').next().unwrap_or("Unknown").to_string();

            reports.push(Report {
                id: uuid::Uuid::new_v4().to_string(),
                playbook_name,
                format: ext.to_string(),
                path: path.to_string_lossy().to_string(),
                created_at: DateTime::from(metadata.modified().map_err(|e| e.to_string())?),
                size: metadata.len(),
            });
        }
    }

    reports.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(reports)
}

#[tauri::command]
pub async fn open_report(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("Report file not found".to_string());
    }

    tauri::plugin_opener::open_path(&path, None::<&str>).map_err(|e| e.to_string())?;

    Ok(())
}
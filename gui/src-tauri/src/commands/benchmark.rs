use crate::models::{BenchmarkConfig, BenchmarkResult, ComparisonResult, BenchmarkRun, PlaybookBenchmark, BenchmarkSummary};
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::Command;
use tokio::io::{BufReader, AsyncBufReadExt};
use tokio::time::{Duration, Instant};

#[tauri::command]
pub async fn run_benchmark(config: BenchmarkConfig) -> Result<BenchmarkResult, String> {
    let benchmark_id = format!("bench-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let started_at = chrono::Utc::now();
    let total_start = std::time::Instant::now();

    let mut playbooks = Vec::new();
    let mut all_runs = Vec::new();

    for playbook_name in &config.playbooks {
        let mut pb_bench = PlaybookBenchmark {
            playbook: playbook_name.clone(),
            runs: Vec::new(),
            avg_duration_ms: 0,
            min_duration_ms: u64::MAX,
            max_duration_ms: 0,
            success_rate: 0.0,
        };

        for i in 1..=config.iterations {
            let run_start = std::time::Instant::now();

            let mut run = BenchmarkRun {
                iteration: i,
                duration_ms: 0,
                success: false,
                error: None,
                started_at: chrono::Utc::now(),
                completed_at: None,
                steps_duration: HashMap::new(),
            };

            // Build secwin command
            let mut args = vec!["benchmark".to_string(), "run".to_string()];

            if config.iterations > 1 {
                // For multi-iteration, we run one at a time
            }
            args.push("--iterations".to_string());
            args.push("1".to_string());
            args.push("--playbook".to_string());
            args.push(playbook_name.clone());

            if config.include_install {
                args.push("--include-install".to_string());
            }
            if config.include_wsl {
                args.push("--include-wsl".to_string());
            }

            // Add variables
            for (k, v) in &config.variables {
                args.push("--var".to_string());
                args.push(format!("{}={}", k, v));
            }

            // Execute secwin command
            let mut cmd = Command::new("secwin");
            cmd.args(&args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn secwin: {}", e))?;

            let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
            let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

            let mut stdout_reader = BufReader::new(stdout).lines();
            let mut stderr_reader = BufReader::new(stderr).lines();

            let mut stdout_lines = Vec::new();
            let mut stderr_lines = Vec::new();

            // Read stdout
            while let Ok(Some(line)) = stdout_reader.next_line().await {
                stdout_lines.push(line.clone());
                // Parse step durations from output
                if line.contains("Step:") && line.contains("completed in") {
                    if let Some(step_info) = parse_step_duration(&line) {
                        run.steps_duration.insert(step_info.0, step_info.1);
                    }
                }
            }

            // Read stderr
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                stderr_lines.push(line);
            }

            let exit_status = child.wait().await.map_err(|e| format!("Failed to wait for process: {}", e))?;
            run.duration_ms = run_start.elapsed().as_millis() as u64;
            run.completed_at = Some(chrono::Utc::now());

            if exit_status.success() {
                run.success = true;
            } else {
                run.success = false;
                run.error = Some(stderr_lines.join("\n"));
            }

            // Update min/max
            if run.duration_ms < pb_bench.min_duration_ms {
                pb_bench.min_duration_ms = run.duration_ms;
            }
            if run.duration_ms > pb_bench.max_duration_ms {
                pb_bench.max_duration_ms = run.duration_ms;
            }

            pb_bench.runs.push(run.clone());
            all_runs.push(run);
        }

        // Calculate playbook stats
        if !pb_bench.runs.is_empty() {
            let total_duration: u64 = pb_bench.runs.iter().map(|r| r.duration_ms).sum();
            pb_bench.avg_duration_ms = total_duration / pb_bench.runs.len() as u64;

            let successful = pb_bench.runs.iter().filter(|r| r.success).count();
            pb_bench.success_rate = successful as f64 / pb_bench.runs.len() as f64;
        }

        if pb_bench.min_duration_ms == u64::MAX {
            pb_bench.min_duration_ms = 0;
        }

        playbooks.push(pb_bench);
    }

    let total_duration_ms = total_start.elapsed().as_millis() as u64;
    let completed_at = chrono::Utc::now();

    // Calculate summary
    let total_runs = all_runs.len();
    let successful_runs = all_runs.iter().filter(|r| r.success).count();
    let failed_runs = total_runs - successful_runs;

    let avg_duration_ms = if total_runs > 0 {
        all_runs.iter().map(|r| r.duration_ms).sum::<u64>() / total_runs as u64
    } else {
        0
    };

    Ok(BenchmarkResult {
        id: benchmark_id,
        started_at,
        completed_at: Some(completed_at),
        duration_ms: total_duration_ms,
        iterations: config.iterations,
        playbooks,
        summary: BenchmarkSummary {
            total_runs,
            successful_runs,
            failed_runs,
            avg_duration_ms,
            total_duration_ms,
        },
        config,
    })
}

fn parse_step_duration(line: &str) -> Option<(String, u64)> {
    // Parse: "Step: enum-smb completed in 2.34s"
    let parts: Vec<&str> = line.split("Step:").collect();
    if parts.len() < 2 {
        return None;
    }
    let step_part = parts[1].trim();
    let completed_idx = step_part.find("completed in")?;
    let step_name = step_part[..completed_idx].trim().to_string();
    let duration_str = step_part[completed_idx + 12..].trim().trim_end_matches('s');

    let duration_secs: f64 = duration_str.parse().ok()?;
    let duration_ms = (duration_secs * 1000.0) as u64;

    Some((step_name, duration_ms))
}

#[tauri::command]
pub async fn list_benchmarks(dir: Option<String>) -> Result<Vec<String>, String> {
    let bench_dir = dir.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.join(".secwin").join("benchmarks").to_string_lossy().to_string())
            .unwrap_or_else(|| "./benchmarks".to_string())
    });

    let path = std::path::Path::new(&bench_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(name) = entry.file_name().into_string() {
                if name.starts_with("benchmark-") && name.ends_with(".json") {
                    results.push(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn load_benchmark_result(path: String) -> Result<BenchmarkResult, String> {
    let content = tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
    let result: BenchmarkResult = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
pub async fn compare_benchmarks(before_path: String, after_path: String) -> Result<ComparisonResult, String> {
    let before = load_benchmark_result(before_path).await?;
    let after = load_benchmark_result(after_path).await?;

    let comparison = ComparisonResult::compare(&before, &after);
    Ok(comparison)
}

#[tauri::command]
pub async fn run_install_benchmark(tools: String, iterations: u32) -> Result<BenchmarkResult, String> {
    let tool_list: Vec<String> = tools.split(',').map(|s| s.trim().to_string()).collect();

    // Call secwin benchmark install directly
    let mut args = vec![
        "benchmark".to_string(),
        "install".to_string(),
        "--tools".to_string(),
        tools,
        "--iterations".to_string(),
        iterations.to_string(),
    ];

    // Execute secwin command
    let mut cmd = Command::new("secwin");
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn secwin: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut stdout_lines = Vec::new();
    let mut stderr_lines = Vec::new();

    // Read output concurrently
    let stdout_fut = async {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            stdout_lines.push(line);
        }
    };

    let stderr_fut = async {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            stderr_lines.push(line);
        }
    };

    tokio::join!(stdout_fut, stderr_fut);

    let status = child.wait().await.map_err(|e| format!("Failed to wait for process: {}", e))?;
    let exit_code = status.code().unwrap_or(-1);

    if !status.success() {
        return Err(stderr_lines.join("\n"));
    }

    // Parse the output to find the result file path
    let output = stdout_lines.join("\n");
    let result_path = extract_result_path(&output)?;

    // Load the result
    load_benchmark_result(result_path).await
}

fn extract_result_path(output: &str) -> Result<String, String> {
    for line in output.lines() {
        if line.contains("Result saved to:") {
            if let Some(path) = line.split("Result saved to:").nth(1) {
                let path = path.trim();
                // Find the actual JSON file
                let bench_dir = std::path::Path::new(path).parent()
                    .ok_or("Invalid result path")?;
                let entries = std::fs::read_dir(bench_dir).map_err(|e| e.to_string())?;
                for entry in entries.flatten() {
                    if let Ok(name) = entry.file_name().into_string() {
                        if name.starts_with("benchmark-") && name.ends_with(".json") && name.contains(path.split('/').last().unwrap_or("")) {
                            return Ok(entry.path().to_string_lossy().to_string());
                        }
                    }
                }
                // Fallback: find any benchmark file in the directory
                for entry in std::fs::read_dir(bench_dir).map_err(|e| e.to_string())?.flatten() {
                    if let Ok(name) = entry.file_name().into_string() {
                        if name.starts_with("benchmark-") && name.ends_with(".json") {
                            return Ok(entry.path().to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    Err("Could not find benchmark result file".to_string())
}

#[tauri::command]
pub async fn run_playbook_benchmark(playbook: String, iterations: u32) -> Result<BenchmarkResult, String> {
    // Call secwin benchmark run directly
    let mut args = vec![
        "benchmark".to_string(),
        "run".to_string(),
        "--playbook".to_string(),
        playbook,
        "--iterations".to_string(),
        iterations.to_string(),
    ];

    // Execute secwin command
    let mut cmd = Command::new("secwin");
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn secwin: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut stdout_lines = Vec::new();
    let mut stderr_lines = Vec::new();

    // Read output concurrently
    let stdout_fut = async {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            stdout_lines.push(line);
        }
    };

    let stderr_fut = async {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            stderr_lines.push(line);
        }
    };

    tokio::join!(stdout_fut, stderr_fut);

    let status = child.wait().await.map_err(|e| format!("Failed to wait for process: {}", e))?;
    let exit_code = status.code().unwrap_or(-1);

    if !status.success() {
        return Err(stderr_lines.join("\n"));
    }

    // Parse the output to find the result file path
    let output = stdout_lines.join("\n");
    let result_path = extract_result_path(&output)?;

    // Load the result
    load_benchmark_result(result_path).await
}

#[tauri::command]
pub async fn run_tool_benchmark(tool: String, args: String, iterations: u32) -> Result<BenchmarkResult, String> {
    // Call secwin benchmark tool directly
    let mut cmd_args = vec![
        "benchmark".to_string(),
        "tool".to_string(),
        "--tool".to_string(),
        tool,
        "--iterations".to_string(),
        iterations.to_string(),
    ];

    if !args.is_empty() {
        cmd_args.push("--args".to_string());
        cmd_args.push(args);
    }

    // Execute secwin command
    let mut cmd = Command::new("secwin");
    cmd.args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn secwin: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut stdout_lines = Vec::new();
    let mut stderr_lines = Vec::new();

    // Read output concurrently
    let stdout_fut = async {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            stdout_lines.push(line);
        }
    };

    let stderr_fut = async {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            stderr_lines.push(line);
        }
    };

    tokio::join!(stdout_fut, stderr_fut);

    let status = child.wait().await.map_err(|e| format!("Failed to wait for process: {}", e))?;
    let exit_code = status.code().unwrap_or(-1);

    if !status.success() {
        return Err(stderr_lines.join("\n"));
    }

    // Parse the output to find the result file path
    let output = stdout_lines.join("\n");
    let result_path = extract_result_path(&output)?;

    // Load the result
    load_benchmark_result(result_path).await
}

// Async benchmark state management (for backward compatibility with Vue store)
use std::sync::{Arc, Mutex};
use uuid::Uuid;

struct BenchmarkState {
    benchmarks: Mutex<HashMap<String, BenchmarkResult>>,
}

impl Default for BenchmarkState {
    fn default() -> Self {
        Self {
            benchmarks: Mutex::new(HashMap::new()),
        }
    }
}

static BENCHMARK_STATE: std::sync::OnceLock<BenchmarkState> = std::sync::OnceLock::new();

fn get_benchmark_state() -> &'static BenchmarkState {
    BENCHMARK_STATE.get_or_init(BenchmarkState::default)
}

#[tauri::command]
pub async fn benchmark_secwin(request: BenchmarkConfig) -> Result<String, String> {
    let benchmark_id = Uuid::new_v4().to_string();
    let started_at = chrono::Utc::now();

    let mut result = BenchmarkResult {
        id: benchmark_id.clone(),
        started_at,
        completed_at: None,
        duration_ms: None,
        iterations: request.iterations as u32,
        playbooks: Vec::new(),
        summary: BenchmarkSummary {
            total_runs: 0,
            successful_runs: 0,
            failed_runs: 0,
            avg_duration_ms: 0,
            total_duration_ms: 0,
        },
        config: request,
    };

    get_benchmark_state().benchmarks.lock().unwrap().insert(benchmark_id.clone(), result.clone());

    // Spawn background task
    let benchmark_id_clone = benchmark_id.clone();
    let request_clone = request.clone();

    tokio::spawn(async move {
        run_benchmark_async(benchmark_id_clone, request_clone).await;
    });

    Ok(benchmark_id)
}

async fn run_benchmark_async(benchmark_id: String, request: BenchmarkConfig) {
    let state = get_benchmark_state();

    // Build secwin command for each playbook
    let playbooks = if request.playbooks.is_empty() {
        vec!["external-recon".to_string(), "web-app-test".to_string()]
    } else {
        request.playbooks
    };

    let mut all_runs = Vec::new();
    let total_start = Instant::now();

    for playbook_name in &playbooks {
        let mut pb_bench = PlaybookBenchmark {
            playbook: playbook_name.clone(),
            runs: Vec::new(),
            avg_duration_ms: 0,
            min_duration_ms: u64::MAX,
            max_duration_ms: 0,
            success_rate: 0.0,
        };

        for i in 1..=request.iterations {
            let run_start = Instant::now();

            let mut run = BenchmarkRun {
                iteration: i as u32,
                duration_ms: 0,
                success: false,
                error: None,
                started_at: chrono::Utc::now(),
                completed_at: None,
                steps_duration: HashMap::new(),
            };

            // Build secwin command
            let mut args = vec!["benchmark".to_string(), "run".to_string()];
            args.push("--iterations".to_string());
            args.push("1".to_string());
            args.push("--playbook".to_string());
            args.push(playbook_name.clone());

            if request.include_install {
                args.push("--include-install".to_string());
            }
            if request.include_wsl {
                args.push("--include-wsl".to_string());
            }

            // Add variables
            for (k, v) in &request.variables {
                args.push("--var".to_string());
                args.push(format!("{}={}", k, v));
            }

            // Execute secwin command
            let mut cmd = Command::new("secwin");
            cmd.args(&args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let mut child = match cmd.spawn() {
                Ok(c) => c,
                Err(e) => {
                    run.error = Some(format!("Failed to spawn secwin: {}", e));
                    run.duration_ms = run_start.elapsed().as_millis() as u64;
                    run.completed_at = Some(chrono::Utc::now());
                    run.success = false;

                    if let Some(bench) = state.benchmarks.lock().unwrap().get_mut(&benchmark_id) {
                        pb_bench.runs.push(run.clone());
                        bench.playbooks = vec![pb_bench.clone()];
                    }
                    continue;
                }
            };

            let stdout = child.stdout.take().ok_or("Failed to capture stdout").unwrap();
            let stderr = child.stderr.take().ok_or("Failed to capture stderr").unwrap();

            let mut stdout_reader = BufReader::new(stdout).lines();
            let mut stderr_reader = BufReader::new(stderr).lines();

            let mut stdout_lines = Vec::new();
            let mut stderr_lines = Vec::new();

            // Read stdout
            while let Ok(Some(line)) = stdout_reader.next_line().await {
                stdout_lines.push(line.clone());
                // Parse step durations from output
                if line.contains("Step:") && line.contains("completed in") {
                    if let Some(step_info) = parse_step_duration(&line) {
                        run.steps_duration.insert(step_info.0, step_info.1);
                    }
                }
            }

            // Read stderr
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                stderr_lines.push(line);
            }

            let exit_status = child.wait().await.map_err(|e| format!("Failed to wait for process: {}", e)).unwrap_or(std::process::ExitStatus::default());
            run.duration_ms = run_start.elapsed().as_millis() as u64;
            run.completed_at = Some(chrono::Utc::now());

            if exit_status.success() {
                run.success = true;
            } else {
                run.success = false;
                run.error = Some(stderr_lines.join("\n"));
            }

            // Update min/max
            if run.duration_ms < pb_bench.min_duration_ms {
                pb_bench.min_duration_ms = run.duration_ms;
            }
            if run.duration_ms > pb_bench.max_duration_ms {
                pb_bench.max_duration_ms = run.duration_ms;
            }

            pb_bench.runs.push(run.clone());
            all_runs.push(run);

            // Update progress in state
            if let Some(bench) = state.benchmarks.lock().unwrap().get_mut(&benchmark_id) {
                bench.playbooks = vec![pb_bench.clone()];
            }
        }

        // Calculate stats
        let durations: Vec<u64> = pb_bench.runs.iter().map(|r| r.duration_ms).collect();
        let successful: Vec<u64> = pb_bench.runs.iter().filter(|r| r.success).map(|r| r.duration_ms).collect();

        pb_bench.avg_duration_ms = if !durations.is_empty() {
            durations.iter().sum::<u64>() / durations.len() as u64
        } else {
            0
        };
        pb_bench.min_duration_ms = *durations.iter().min().unwrap_or(&0);
        pb_bench.max_duration_ms = *durations.iter().max().unwrap_or(&0);
        pb_bench.success_rate = if !pb_bench.runs.is_empty() {
            successful.len() as f64 / pb_bench.runs.len() as f64
        } else {
            0.0
        };

        if let Some(bench) = state.benchmarks.lock().unwrap().get_mut(&benchmark_id) {
            bench.playbooks.push(pb_bench);
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
        bench.completed_at = Some(chrono::Utc::now());
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
pub async fn get_benchmark_results(benchmark_id: String) -> Result<Option<BenchmarkResult>, String> {
    Ok(get_benchmark_state().benchmarks.lock().unwrap().get(&benchmark_id).cloned())
}
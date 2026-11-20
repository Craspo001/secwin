# Benchmark Guide

Comprehensive performance testing and regression detection for SecWin playbooks, tools, and system resources.

## Overview

The benchmark framework provides:

- **Tool Installation Benchmarks** - Measure installer performance across backends
- **Playbook Execution Benchmarks** - End-to-end playbook timing with step-level granularity
- **Tool Execution Benchmarks** - Individual tool performance with custom arguments
- **System Benchmarks** - CPU, memory, disk, and network baseline measurements
- **Comparison Engine** - Statistical comparison between baseline and current runs
- **GUI Integration** - Visual benchmark runner with real-time progress

## Quick Start

```bash
# Tool installation benchmark
secwin benchmark install nmap nuclei subfinder --iterations 10

# Playbook benchmark
secwin benchmark playbook external-recon --iterations 5

# Tool execution benchmark
secwin benchmark tool nmap -sS 192.168.1.0/24 --iterations 20

# System benchmark
secwin benchmark system --duration 10s

# Compare two runs
secwin benchmark compare baseline.json current.json
```

## Benchmark Types

### 1. Install Benchmarks

Measures tool installation time across different backends (Scoop, Chocolatey, WSL, Binary, GitHub, Script).

```bash
# Basic install benchmark
secwin benchmark install nmap nuclei --iterations 5

# With specific backend
secwin benchmark install bloodhound --method wsl --iterations 3

# Include WSL installation time
secwin benchmark install nuclei subfinder --include-wsl --iterations 3

# Output directory
secwin benchmark install nmap --output ./bench-results --iterations 5
```

**Metrics Collected:**
| Metric | Description |
|--------|-------------|
| `install_time_ms` | Time from command start to tool availability |
| `download_size_mb` | Bytes downloaded |
| `success` | Installation succeeded |
| `backend_used` | Which installer backend was selected |

### 2. Playbook Benchmarks

Runs complete playbooks multiple times with statistical analysis.

```bash
# Run playbook benchmark
secwin benchmark playbook external-recon --iterations 5

# Include tool installation in timing
secwin benchmark playbook web-app-test --include-install --iterations 3

# Test WSL execution paths
secwin benchmark playbook internal-ad-enum --include-wsl --iterations 3

# Custom variables
secwin benchmark playbook external-recon --var target=example.com --var rate=100 --iterations 3
```

**Metrics Collected:**
| Metric | Description |
|--------|-------------|
| `total_duration_ms` | Full playbook execution time |
| `step_durations` | Per-step timing breakdown |
| `success_rate` | Percentage of successful iterations |
| `findings_count` | Number of findings per run |
| `artifacts_count` | Artifacts collected per run |
| `memory_peak_mb` | Peak memory usage |

### 3. Tool Benchmarks

Benchmarks individual tool execution with custom arguments.

```bash
# Network scan benchmark
secwin benchmark tool nmap -sS -T4 192.168.1.0/24 --iterations 10

# Vulnerability scan benchmark
secwin benchmark tool nuclei -t cves/ -u https://example.com --iterations 5

# Subdomain enumeration
secwin benchmark tool subfinder -d example.com --iterations 10

# Custom arguments with quotes
secwin benchmark tool ffuf -u "https://example.com/FUZZ" -w wordlist.txt --iterations 20
```

### 4. System Benchmarks

Measures system resource utilization during idle and load.

```bash
# Quick system check (5 seconds)
secwin benchmark system --duration 5s

# Extended system benchmark (30 seconds)
secwin benchmark system --duration 30s --output ./system-bench

# Include disk I/O
secwin benchmark system --duration 10s --include-disk
```

**Metrics Collected:**
| Metric | Description |
|--------|-------------|
| `cpu_percent_avg` | Average CPU utilization |
| `cpu_percent_max` | Peak CPU utilization |
| `memory_percent_avg` | Average memory usage |
| `memory_available_mb` | Available memory |
| `disk_read_mbps` | Disk read throughput |
| `disk_write_mbps` | Disk write throughput |
| `network_rx_mbps` | Network receive rate |
| `network_tx_mbps` | Network transmit rate |

## Comparison Engine

Detects performance regressions between benchmark runs.

```bash
# Compare two benchmark results
secwin benchmark compare baseline.json current.json

# With custom threshold (default: 20% regression)
secwin benchmark compare baseline.json current.json --threshold 15

# Output comparison to file
secwin benchmark compare baseline.json current.json --output comparison.json
```

**Output Example:**
```
Benchmark Comparison
====================

external-recon:
  Duration: 45230ms -> 48921ms (+8.2%)
  Success Rate: 100.0% -> 100.0% (+0.0%)

web-app-test:
  Duration: 67842ms -> 89234ms (+31.5%)
  Success Rate: 100.0% -> 80.0% (-20.0%)

⚠️  REGRESSION DETECTED: Performance degradation detected
```

**Exit Codes:**
- `0` - No significant regressions
- `1` - Regression detected (CI-friendly)

## Result Storage

All benchmarks save results to JSON files:

```
~/.secwin/benchmarks/
├── benchmark-1704067200000000000.json
├── benchmark-1704067200000000001.json
└── ...
```

**Result Schema:**
```json
{
  "id": "bench-1704067200000000000",
  "started_at": "2024-01-01T00:00:00Z",
  "completed_at": "2024-01-01T00:05:00Z",
  "duration_ms": 300000,
  "iterations": 5,
  "playbooks": [
    {
      "playbook": "external-recon",
      "runs": [
        {
          "iteration": 1,
          "duration_ms": 45230,
          "success": true,
          "error": null,
          "steps_duration": {
            "subdomain-enum": 12340,
            "port-scan": 23450,
            "service-detect": 9440
          }
        }
      ],
      "avg_duration_ms": 45230,
      "min_duration_ms": 44100,
      "max_duration_ms": 46800,
      "success_rate": 1.0
    }
  ],
  "summary": {
    "total_runs": 5,
    "successful_runs": 5,
    "failed_runs": 0,
    "avg_duration_ms": 45230,
    "total_duration_ms": 226150
  }
}
```

## GUI Benchmarks Page

The SecWin GUI provides a visual benchmark interface:

1. Launch GUI: `secwin gui`
2. Navigate to **Benchmarks** (chart icon)
3. Configure:
   - **Iterations**: Number of runs per playbook
   - **Playbooks**: Select one or more playbooks (Ctrl+click)
   - **Include Install**: Time tool installation
   - **Include WSL**: Test WSL execution paths
4. Click **Start Benchmark**
5. Monitor real-time progress
6. View results table with sorting/filtering
7. Export as JSON or CSV

### GUI Features

- **Real-time progress** - Live iteration counter and duration
- **Results table** - Sortable by playbook, duration, success rate
- **Playbook breakdown** - Per-playbook statistics with run details
- **History** - Previous benchmark runs with quick load
- **Comparison** - Side-by-side baseline vs current
- **Export** - JSON/CSV for external analysis

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Benchmark Regression Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      
      - name: Install SecWin
        run: go install github.com/secwin/secwin@latest
      
      - name: Install Core Tools
        run: secwin install @core
      
      - name: Run Baseline Benchmark
        id: baseline
        run: |
          secwin benchmark playbook external-recon --iterations 3 --output ./bench
          echo "result=$(ls ./bench/benchmark-*.json | tail -1)" >> $GITHUB_OUTPUT
      
      - name: Upload Baseline
        uses: actions/upload-artifact@v4
        with:
          name: baseline-benchmark
          path: ${{ steps.baseline.outputs.result }}
      
      - name: Download Previous Baseline
        uses: actions/download-artifact@v4
        with:
          name: baseline-benchmark
          path: ./previous
        if: github.event_name == 'pull_request'
      
      - name: Compare Benchmarks
        if: github.event_name == 'pull_request'
        run: |
          CURRENT=$(ls ./bench/benchmark-*.json | tail -1)
          PREVIOUS=$(ls ./previous/benchmark-*.json | tail -1)
          secwin benchmark compare $PREVIOUS $CURRENT --threshold 20
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash
# Quick benchmark on staged playbook changes
if git diff --cached --name-only | grep -q "playbooks/"; then
    echo "Playbook changes detected - running quick benchmark..."
    secwin benchmark playbook external-recon --iterations 1 --output /tmp/bench
    # Compare with stored baseline
    if [ -f ~/.secwin/benchmarks/baseline.json ]; then
        secwin benchmark compare ~/.secwin/benchmarks/baseline.json /tmp/bench/benchmark-*.json --threshold 25
    fi
fi
```

## Performance Targets

| Operation | Target | Typical |
|-----------|--------|---------|
| Tool Install (cached) | < 5s | ~2.3s |
| Tool Install (uncached) | < 30s | ~15s |
| Playbook Execution | < 60s | ~45s |
| Evidence Verification | < 10s | ~3.2s |
| Report Generation | < 5s | ~1.8s |
| GUI Startup | < 2s | ~1.2s |
| AI Triage (single) | < 10s | ~5s |
| AI Triage (batch 10) | < 30s | ~18s |

## Statistical Analysis

For rigorous performance analysis, export results and use external tools:

```bash
# Export all benchmarks for analysis
secwin benchmark list --dir ~/.secwin/benchmarks --json > all-benchmarks.json

# Python analysis example
python3 << 'EOF'
import json, statistics

with open('all-benchmarks.json') as f:
    data = json.load(f)

durations = [b['summary']['avg_duration_ms'] for b in data]
print(f"Mean: {statistics.mean(durations):.0f}ms")
print(f"Stdev: {statistics.stdev(durations):.0f}ms")
print(f"Min: {min(durations)}ms")
print(f"Max: {max(durations)}ms")
EOF
```

## Troubleshooting

### Benchmark Fails Immediately

```bash
# Check secwin is in PATH
which secwin

# Verify playbook exists
secwin playbook list

# Run with verbose output
secwin benchmark playbook external-recon --iterations 1 2>&1 | head -50
```

### High Variance in Results

```bash
# Increase iterations for statistical significance
secwin benchmark playbook external-recon --iterations 20

# Disable background processes
# Close browsers, IDEs, other heavy applications

# Run on dedicated hardware for consistent results
```

### WSL Benchmarks Slow

```bash
# Pre-warm WSL
wsl -d kali-linux -- true

# Use --include-wsl flag explicitly
secwin benchmark playbook external-recon --include-wsl --iterations 5
```

### Comparison False Positives

```bash
# Use higher threshold for noisy environments
secwin benchmark compare baseline.json current.json --threshold 30

# Compare specific playbooks only
# Edit JSON to remove irrelevant playbooks before comparing
```

## Best Practices

1. **Establish Baselines** - Run benchmarks on clean system before changes
2. **Consistent Environment** - Same hardware, OS version, background load
3. **Sufficient Iterations** - Minimum 5, preferably 10+ for statistical validity
4. **Isolate Runs** - Don't run other heavy workloads during benchmarks
5. **Track Over Time** - Store historical results for trend analysis
6. **Automate in CI** - Catch regressions before merge
7. **Profile Bottlenecks** - Use `--include-install` to identify install overhead

## Advanced Usage

### Custom Benchmark Scripts

```bash
#!/bin/bash
# benchmark-suite.sh - Run full benchmark suite

set -e

RESULTS_DIR="./benchmarks/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "=== System Baseline ==="
secwin benchmark system --duration 10s --output "$RESULTS_DIR/system"

echo "=== Tool Installs ==="
for tool in nmap nuclei subfinder httpx naabu; do
    secwin benchmark install "$tool" --iterations 5 --output "$RESULTS_DIR/install-$tool"
done

echo "=== Playbooks ==="
for pb in external-recon web-app-test internal-ad-enum; do
    secwin benchmark playbook "$pb" --iterations 3 --output "$RESULTS_DIR/playbook-$pb"
done

echo "=== Tool Execution ==="
secwin benchmark tool nmap -sS 192.168.1.0/24 --iterations 10 --output "$RESULTS_DIR/tool-nmap"
secwin benchmark tool nuclei -t cves/ -u https://example.com --iterations 5 --output "$RESULTS_DIR/tool-nuclei"

echo "Results saved to $RESULTS_DIR"
```

### Benchmark as Code

```go
// Internal benchmarking in Go tests
func BenchmarkPlaybookExecution(b *testing.B) {
    runner := benchmark.NewBenchmarkRunner(benchmark.BenchmarkConfig{
        Iterations:     b.N,
        Playbooks:      []string{"external-recon"},
        IncludeInstall: false,
        IncludeWSL:     false,
    }, loader, reg, wslMgr)
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        runner.Run()
    }
}
```

---

*Benchmark Guide v1.0 - SecWin Phase 4*
*Compatible with SecWin CLI v1.0.0+*
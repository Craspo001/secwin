package benchmark

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/secwin/secwin/internal/manifest"
	"github.com/secwin/secwin/internal/installer"
	"github.com/secwin/secwin/internal/wsl"
)

type BenchmarkConfig struct {
	Iterations      int               `json:"iterations"`
	Playbooks       []string          `json:"playbooks"`
	IncludeInstall  bool              `json:"include_install"`
	IncludeWSL      bool              `json:"include_wsl"`
	OutputDir       string            `json:"output_dir"`
	Parallel        int               `json:"parallel"`
	Variables       map[string]string `json:"variables,omitempty"`
}

type BenchmarkResult struct {
	ID              string                 `json:"id"`
	StartedAt       time.Time              `json:"started_at"`
	CompletedAt     *time.Time             `json:"completed_at,omitempty"`
	DurationMs      int64                  `json:"duration_ms,omitempty"`
	Iterations      int                    `json:"iterations"`
	Playbooks       []PlaybookBenchmark    `json:"playbooks"`
	Summary         BenchmarkSummary       `json:"summary"`
	Config          BenchmarkConfig        `json:"config"`
}

type PlaybookBenchmark struct {
	Playbook        string         `json:"playbook"`
	Runs            []BenchmarkRun `json:"runs"`
	AvgDurationMs   int64          `json:"avg_duration_ms"`
	MinDurationMs   int64          `json:"min_duration_ms"`
	MaxDurationMs   int64          `json:"max_duration_ms"`
	SuccessRate     float64        `json:"success_rate"`
	TotalRuns       int            `json:"total_runs"`
	SuccessfulRuns  int            `json:"successful_runs"`
	FailedRuns      int            `json:"failed_runs"`
}

type BenchmarkRun struct {
	Iteration     int                    `json:"iteration"`
	DurationMs    int64                  `json:"duration_ms"`
	Success       bool                   `json:"success"`
	Error         string                 `json:"error,omitempty"`
	StepsDuration map[string]int64       `json:"steps_duration,omitempty"`
	Artifacts     map[string]string      `json:"artifacts,omitempty"`
	Findings      int                    `json:"findings_count,omitempty"`
}

type BenchmarkSummary struct {
	TotalRuns        int     `json:"total_runs"`
	SuccessfulRuns   int     `json:"successful_runs"`
	FailedRuns       int     `json:"failed_runs"`
	AvgDurationMs    int64   `json:"avg_duration_ms"`
	TotalDurationMs  int64   `json:"total_duration_ms"`
	OverallSuccessRate float64 `json:"overall_success_rate"`
}

type BenchmarkRunner struct {
	config       BenchmarkConfig
	manifestLoader *manifest.Loader
	installerReg   *installer.Registry
	wslManager     *wsl.Manager
	results      *BenchmarkResult
	mu           sync.Mutex
	ctx          context.Context
	cancel       context.CancelFunc
}

func NewBenchmarkRunner(config BenchmarkConfig, ml *manifest.Loader, ir *installer.Registry, wm *wsl.Manager) *BenchmarkRunner {
	ctx, cancel := context.WithCancel(context.Background())

	// Generate default playbooks if none specified
	if len(config.Playbooks) == 0 {
		config.Playbooks = []string{"external-recon", "web-app-test", "internal-ad-enum"}
	}

	// Set default output dir
	if config.OutputDir == "" {
		home, _ := os.UserHomeDir()
		config.OutputDir = filepath.Join(home, ".secwin", "benchmarks")
	}

	// Set default parallel
	if config.Parallel <= 0 {
		config.Parallel = 1
	}

	// Set default iterations
	if config.Iterations <= 0 {
		config.Iterations = 3
	}

	return &BenchmarkRunner{
		config:         config,
		manifestLoader: ml,
		installerReg:   ir,
		wslManager:     wm,
		ctx:            ctx,
		cancel:         cancel,
		results: &BenchmarkResult{
			ID:         generateID(),
			StartedAt:  time.Now(),
			Iterations: config.Iterations,
			Playbooks:  []PlaybookBenchmark{},
			Config:     config,
		},
	}
}

func (br *BenchmarkRunner) Run() (*BenchmarkResult, error) {
	// Ensure output directory exists
	if err := os.MkdirAll(br.config.OutputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output dir: %w", err)
	}

	// Run benchmarks for each playbook
	for _, playbookName := range br.config.Playbooks {
		pbBench := br.runPlaybookBenchmark(playbookName)
		br.mu.Lock()
		br.results.Playbooks = append(br.results.Playbooks, pbBench)
		br.mu.Unlock()
	}

	// Calculate summary
	br.calculateSummary()

	// Set completion time
	now := time.Now()
	br.results.CompletedAt = &now
	br.results.DurationMs = now.Sub(br.results.StartedAt).Milliseconds()

	// Save results
	if err := br.saveResults(); err != nil {
		return nil, fmt.Errorf("failed to save results: %w", err)
	}

	return br.results, nil
}

func (br *BenchmarkRunner) runPlaybookBenchmark(playbookName string) PlaybookBenchmark {
	pbBench := PlaybookBenchmark{
		Playbook: playbookName,
		Runs:     []BenchmarkRun{},
	}

	for i := 1; i <= br.config.Iterations; i++ {
		select {
		case <-br.ctx.Done():
			return pbBench
		default:
		}

		run := br.runSingleIteration(playbookName, i)
		pbBench.Runs = append(pbBench.Runs, run)
	}

	// Calculate statistics
	br.calculatePlaybookStats(&pbBench)
	return pbBench
}

func (br *BenchmarkRunner) runSingleIteration(playbookName string, iteration int) BenchmarkRun {
	start := time.Now()

	run := BenchmarkRun{
		Iteration:     iteration,
		DurationMs:    0,
		Success:       false,
		StepsDuration: make(map[string]int64),
		Artifacts:     make(map[string]string),
	}

	// Build command args
	args := []string{"playbook", "run", playbookName}
	// Add variables
	for k, v := range br.config.Variables {
		args = append(args, "--var", fmt.Sprintf("%s=%s", k, v))
	}
	// Note: playbook run doesn't support --skip-install or --wsl flags
	// Those are handled by the playbook's own tool configuration

	// Create unique output directory for this run
	runOutputDir := filepath.Join(br.config.OutputDir, playbookName, fmt.Sprintf("run-%d", iteration))
	args = append(args, "--output", runOutputDir)

	// Execute secwin command from project root (where playbooks are)
	cmd := exec.CommandContext(br.ctx, "secwin", args...)

	// Capture output
	output, err := cmd.CombinedOutput()
	duration := time.Since(start)
	run.DurationMs = duration.Milliseconds()

	if err != nil {
		run.Error = err.Error()
		run.Success = false
		// Try to extract error from output
		if len(output) > 0 {
			run.Error = string(output)
		}
	} else {
		run.Success = true
		// Parse output for step durations, artifacts, findings
		br.parseExecutionOutput(string(output), &run)
	}

	return run
}

func (br *BenchmarkRunner) parseExecutionOutput(output string, run *BenchmarkRun) {
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Look for step timing patterns
		if strings.Contains(line, "Step:") && strings.Contains(line, "completed in") {
			// Parse: "Step: enum-smb completed in 2.34s"
			parts := strings.Split(line, "Step:")
			if len(parts) > 1 {
				stepPart := strings.TrimSpace(parts[1])
				if idx := strings.Index(stepPart, "completed in"); idx > 0 {
					stepName := strings.TrimSpace(stepPart[:idx])
					durationStr := strings.TrimSpace(stepPart[idx+12:])
					durationStr = strings.TrimSuffix(durationStr, "s")
					if d, err := parseDuration(durationStr); err == nil {
						run.StepsDuration[stepName] = d.Milliseconds()
					}
				}
			}
		}

		// Count findings
		if strings.Contains(line, "finding") || strings.Contains(line, "Finding") {
			run.Findings++
		}
	}
}

func parseDuration(s string) (time.Duration, error) {
	s = strings.TrimSpace(s)
	if strings.HasSuffix(s, "ms") {
		return time.ParseDuration(s)
	}
	if strings.HasSuffix(s, "s") {
		return time.ParseDuration(s)
	}
	// Assume seconds if no unit
	return time.ParseDuration(s + "s")
}

func (br *BenchmarkRunner) calculatePlaybookStats(pbBench *PlaybookBenchmark) {
	if len(pbBench.Runs) == 0 {
		return
	}

	var totalDuration int64
	minDuration := int64(^uint64(0) >> 1) // Max int64
	maxDuration := int64(0)
	successCount := 0

	for _, run := range pbBench.Runs {
		totalDuration += run.DurationMs
		if run.DurationMs < minDuration {
			minDuration = run.DurationMs
		}
		if run.DurationMs > maxDuration {
			maxDuration = run.DurationMs
		}
		if run.Success {
			successCount++
		}
	}

	pbBench.TotalRuns = len(pbBench.Runs)
	pbBench.SuccessfulRuns = successCount
	pbBench.FailedRuns = len(pbBench.Runs) - successCount
	pbBench.AvgDurationMs = totalDuration / int64(len(pbBench.Runs))
	pbBench.MinDurationMs = minDuration
	pbBench.MaxDurationMs = maxDuration
	pbBench.SuccessRate = float64(successCount) / float64(len(pbBench.Runs))
}

func (br *BenchmarkRunner) calculateSummary() {
	var allRuns []BenchmarkRun
	for _, pbBench := range br.results.Playbooks {
		allRuns = append(allRuns, pbBench.Runs...)
	}

	if len(allRuns) == 0 {
		return
	}

	var totalDuration int64
	successCount := 0
	for _, run := range allRuns {
		totalDuration += run.DurationMs
		if run.Success {
			successCount++
		}
	}

	br.results.Summary = BenchmarkSummary{
		TotalRuns:            len(allRuns),
		SuccessfulRuns:       successCount,
		FailedRuns:           len(allRuns) - successCount,
		AvgDurationMs:        totalDuration / int64(len(allRuns)),
		TotalDurationMs:      totalDuration,
		OverallSuccessRate:   float64(successCount) / float64(len(allRuns)),
	}
}

func (br *BenchmarkRunner) saveResults() error {
	resultsPath := filepath.Join(br.config.OutputDir, fmt.Sprintf("benchmark-%s.json", br.results.ID))
	data, err := json.MarshalIndent(br.results, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(resultsPath, data, 0644)
}

func (br *BenchmarkRunner) Cancel() {
	br.cancel()
}

func (br *BenchmarkRunner) GetResults() *BenchmarkResult {
	br.mu.Lock()
	defer br.mu.Unlock()
	return br.results
}

func LoadBenchmarkResult(path string) (*BenchmarkResult, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var result BenchmarkResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func ListBenchmarkResults(dir string) ([]string, error) {
	files, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var results []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".json") && strings.HasPrefix(f.Name(), "benchmark-") {
			results = append(results, filepath.Join(dir, f.Name()))
		}
	}
	return results, nil
}

func SaveResult(result *BenchmarkResult, path string) error {
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// Benchmark comparison utilities
type ComparisonResult struct {
	Baseline  *BenchmarkResult `json:"baseline"`
	Current   *BenchmarkResult `json:"current"`
	Playbooks []PlaybookComparison `json:"playbooks"`
	Summary   ComparisonSummary    `json:"summary"`
}

type PlaybookComparison struct {
	Playbook         string  `json:"playbook"`
	BaselineAvgMs    int64   `json:"baseline_avg_ms"`
	CurrentAvgMs     int64   `json:"current_avg_ms"`
	DiffMs           int64   `json:"diff_ms"`
	DiffPercent      float64 `json:"diff_percent"`
	BaselineSuccess  float64 `json:"baseline_success_rate"`
	CurrentSuccess   float64 `json:"current_success_rate"`
}

type ComparisonSummary struct {
	TotalPlaybooks      int     `json:"total_playbooks"`
	Improved            int     `json:"improved"`
	Regressed           int     `json:"regressed"`
	Unchanged           int     `json:"unchanged"`
	OverallDiffPercent  float64 `json:"overall_diff_percent"`
}

func CompareBenchmarks(baseline, current *BenchmarkResult) *ComparisonResult {
	comp := &ComparisonResult{
		Baseline:  baseline,
		Current:   current,
		Playbooks: []PlaybookComparison{},
	}

	// Create maps for easier lookup
	baselineMap := make(map[string]PlaybookBenchmark)
	for _, pb := range baseline.Playbooks {
		baselineMap[pb.Playbook] = pb
	}

	currentMap := make(map[string]PlaybookBenchmark)
	for _, pb := range current.Playbooks {
		currentMap[pb.Playbook] = pb
	}

	improved, regressed, unchanged := 0, 0, 0
	var totalDiffPercent float64

	// Compare each playbook in current
	for name, currentPB := range currentMap {
		baselinePB, hasBaseline := baselineMap[name]

		pc := PlaybookComparison{
			Playbook:        name,
			CurrentAvgMs:    currentPB.AvgDurationMs,
			CurrentSuccess:  currentPB.SuccessRate,
		}

		if hasBaseline {
			pc.BaselineAvgMs = baselinePB.AvgDurationMs
			pc.BaselineSuccess = baselinePB.SuccessRate
			pc.DiffMs = currentPB.AvgDurationMs - baselinePB.AvgDurationMs

			if baselinePB.AvgDurationMs > 0 {
				pc.DiffPercent = float64(pc.DiffMs) / float64(baselinePB.AvgDurationMs) * 100
				totalDiffPercent += pc.DiffPercent
			}

			if pc.DiffPercent < -5 { // 5% threshold for improvement
				improved++
			} else if pc.DiffPercent > 5 {
				regressed++
			} else {
				unchanged++
			}
		}

		comp.Playbooks = append(comp.Playbooks, pc)
	}

	comp.Summary = ComparisonSummary{
		TotalPlaybooks:     len(comp.Playbooks),
		Improved:           improved,
		Regressed:          regressed,
		Unchanged:          unchanged,
		OverallDiffPercent: totalDiffPercent / float64(max(1, len(comp.Playbooks))),
	}

	return comp
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
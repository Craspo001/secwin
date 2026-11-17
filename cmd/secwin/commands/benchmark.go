package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/secwin/secwin/internal/benchmark"
	"github.com/secwin/secwin/internal/installer"
	"github.com/secwin/secwin/internal/manifest"
	"github.com/secwin/secwin/internal/wsl"
	"github.com/spf13/cobra"
)

func NewBenchmarkCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "benchmark",
		Short: "Run performance benchmarks",
		Long:  `Run benchmarks on playbooks to measure performance and detect regressions.`,
	}

	cmd.AddCommand(
		newBenchmarkRunCommand(),
		newBenchmarkCompareCommand(),
		newBenchmarkListCommand(),
	)

	return cmd
}

func newBenchmarkRunCommand() *cobra.Command {
	var (
		iterations     int
		playbooks      []string
		includeInstall bool
		includeWSL     bool
		outputDir      string
	)

	cmd := &cobra.Command{
		Use:   "run",
		Short: "Run benchmarks",
		RunE: func(cmd *cobra.Command, args []string) error {
			if outputDir == "" {
				outputDir = filepath.Join(".", "benchmarks")
			}
			if err := os.MkdirAll(outputDir, 0755); err != nil {
				return err
			}

			loader := manifest.NewLoader("manifests", "manifests/custom")

			reg := installer.NewRegistry()
			reg.Register(installer.NewScoopInstaller())
			reg.Register(installer.NewChocolateyInstaller())
			reg.Register(installer.NewBinaryInstaller())
			reg.Register(installer.NewGitHubInstaller())
			reg.Register(installer.NewScriptInstaller())

			wslManager := wsl.NewManager(nil)

			runner := benchmark.NewBenchmarkRunner(benchmark.BenchmarkConfig{
				Iterations:      iterations,
				Playbooks:       playbooks,
				IncludeInstall:  includeInstall,
				IncludeWSL:      includeWSL,
				OutputDir:       outputDir,
			}, loader, reg, wslManager)

			if len(runner.GetResults().Config.Playbooks) == 0 {
				// Auto-discover playbooks
				entries, err := os.ReadDir("playbooks")
				if err == nil {
					for _, entry := range entries {
						if !entry.IsDir() && (strings.HasSuffix(entry.Name(), ".yaml") || strings.HasSuffix(entry.Name(), ".yml")) {
							name := strings.TrimSuffix(entry.Name(), ".yaml")
							name = strings.TrimSuffix(name, ".yml")
							// Need to update the runner's config
							// For now, just print warning
						}
					}
				}
			}

			fmt.Printf("Starting benchmark: %d iterations, %d playbooks\n", iterations, len(playbooks))
			for _, pb := range playbooks {
				fmt.Printf("  - %s\n", pb)
			}

			result, err := runner.Run()
			if err != nil {
				return fmt.Errorf("benchmark failed: %w", err)
			}

			printBenchmarkSummary(result)

			fmt.Printf("\nResult saved to: %s\n", result.ID)
			return nil
		},
	}

	cmd.Flags().IntVarP(&iterations, "iterations", "i", 3, "Number of iterations per playbook")
	cmd.Flags().StringSliceVarP(&playbooks, "playbook", "p", nil, "Playbooks to benchmark (default: all)")
	cmd.Flags().BoolVar(&includeInstall, "include-install", false, "Include tool installation time")
	cmd.Flags().BoolVar(&includeWSL, "include-wsl", true, "Test WSL execution paths")
	cmd.Flags().StringVarP(&outputDir, "output", "o", "", "Output directory")

	return cmd
}

func newBenchmarkCompareCommand() *cobra.Command {
	var (
		beforePath string
		afterPath  string
		threshold  float64
	)

	cmd := &cobra.Command{
		Use:   "compare <before.json> <after.json>",
		Short: "Compare two benchmark results",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			beforePath = args[0]
			afterPath = args[1]

			before, err := benchmark.LoadBenchmarkResult(beforePath)
			if err != nil {
				return fmt.Errorf("load before: %w", err)
			}

			after, err := benchmark.LoadBenchmarkResult(afterPath)
			if err != nil {
				return fmt.Errorf("load after: %w", err)
			}

			comparison := benchmark.CompareBenchmarks(before, after)
			fmt.Println(comparisonSummary(comparison))

			if comparison.Summary.Regressed > 0 {
				fmt.Println("\n⚠️  REGRESSION DETECTED!")
				os.Exit(1)
			}

			return nil
		},
	}

	cmd.Flags().Float64Var(&threshold, "threshold", 20.0, "Regression threshold percentage")

	return cmd
}

func newBenchmarkListCommand() *cobra.Command {
	var benchmarkDir string

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List benchmark results",
		RunE: func(cmd *cobra.Command, args []string) error {
			if benchmarkDir == "" {
				benchmarkDir = "benchmarks"
			}

			files, err := benchmark.ListBenchmarkResults(benchmarkDir)
			if err != nil {
				return err
			}

			fmt.Println("Benchmark Results:")
			found := false
			for _, path := range files {
				found = true
				result, err := benchmark.LoadBenchmarkResult(path)
				if err != nil {
					fmt.Printf("  %s (error: %v)\n", filepath.Base(path), err)
					continue
				}

				status := "✅"
				if result.Summary.FailedRuns > 0 {
					status = "⚠️"
				}

				fmt.Printf("  %s %s\n", status, filepath.Base(path))
				fmt.Printf("    Date: %s\n", result.StartedAt.Format("2006-01-02 15:04:05"))
				fmt.Printf("    Duration: %s\n", formatDuration(result.DurationMs))
				fmt.Printf("    Runs: %d/%d passed\n", result.Summary.SuccessfulRuns, result.Summary.TotalRuns)
				fmt.Printf("    Avg: %s\n", formatDuration(result.Summary.AvgDurationMs))
				fmt.Println()
			}

			if !found {
				fmt.Println("  No benchmark results found")
			}

			return nil
		},
	}

	cmd.Flags().StringVarP(&benchmarkDir, "dir", "d", "", "Benchmark directory")

	return cmd
}

func comparisonSummary(c *benchmark.ComparisonResult) string {
	var sb strings.Builder
	sb.WriteString("Benchmark Comparison\n")
	sb.WriteString("====================\n\n")

	for _, pb := range c.Playbooks {
		sb.WriteString(fmt.Sprintf("%s:\n", pb.Playbook))
		sb.WriteString(fmt.Sprintf("  Duration: %dms -> %dms (%.1f%%)\n", pb.BaselineAvgMs, pb.CurrentAvgMs, pb.DiffPercent))
		sb.WriteString(fmt.Sprintf("  Success Rate: %.1f%% -> %.1f%% (%.1f%%)\n",
			pb.BaselineSuccess*100, pb.CurrentSuccess*100, (pb.CurrentSuccess-pb.BaselineSuccess)*100))
		sb.WriteString("\n")
	}

	if c.Summary.Regressed > 0 {
		sb.WriteString("⚠️  REGRESSION DETECTED: Performance degradation detected\n")
	} else {
		sb.WriteString("✅ No significant regressions detected\n")
	}

	return sb.String()
}

func printBenchmarkSummary(result *benchmark.BenchmarkResult) {
	fmt.Println("\n=== Benchmark Summary ===")
	fmt.Printf("ID: %s\n", result.ID)
	fmt.Printf("Started: %s\n", result.StartedAt.Format("2006-01-02 15:04:05"))
	if result.CompletedAt != nil {
		fmt.Printf("Completed: %s\n", result.CompletedAt.Format("2006-01-02 15:04:05"))
	}
	fmt.Printf("Total Duration: %s\n", formatDuration(result.DurationMs))
	fmt.Printf("Iterations: %d\n", result.Iterations)
	fmt.Printf("Total Runs: %d\n", result.Summary.TotalRuns)
	fmt.Printf("Passed: %d\n", result.Summary.SuccessfulRuns)
	fmt.Printf("Failed: %d\n", result.Summary.FailedRuns)
	fmt.Printf("Avg Duration: %s\n", formatDuration(result.Summary.AvgDurationMs))

	fmt.Println("\nPer-Playbook Results:")
	for _, pb := range result.Playbooks {
		status := "✅"
		if pb.SuccessRate < 1.0 {
			status = "⚠️"
		}
		fmt.Printf("  %s %s\n", status, pb.Playbook)
		fmt.Printf("    Runs: %d, Success: %.1f%%\n", len(pb.Runs), pb.SuccessRate*100)
		fmt.Printf("    Avg: %s, Min: %s, Max: %s\n",
			formatDuration(pb.AvgDurationMs),
			formatDuration(pb.MinDurationMs),
			formatDuration(pb.MaxDurationMs))
		for _, run := range pb.Runs {
			runStatus := "✓"
			if !run.Success {
				runStatus = "✗"
			}
			fmt.Printf("      %s Iteration %d: %s", runStatus, run.Iteration, formatDuration(run.DurationMs))
			if run.Error != "" {
				fmt.Printf(" (ERROR: %s)", run.Error)
			}
			fmt.Println()
		}
	}
}

func formatDuration(ms int64) string {
	if ms < 1000 {
		return fmt.Sprintf("%dms", ms)
	}
	if ms < 60000 {
		return fmt.Sprintf("%.1fs", float64(ms)/1000)
	}
	return fmt.Sprintf("%dm %ds", ms/60000, (ms%60000)/1000)
}
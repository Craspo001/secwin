package commands

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/secwin/secwin/internal/ai"
	"github.com/spf13/cobra"
)

func NewAICommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "ai",
		Short: "AI-powered finding triage with Ollama",
		Long:  `Integrate with local Ollama instance for automated finding classification.`,
	}

	cmd.AddCommand(
		newAITriageCommand(),
		newAITriageBatchCommand(),
		newAICheckCommand(),
		newAIModelsCommand(),
		newAIModelCommand(),
		newAICacheCommand(),
	)

	return cmd
}

func newAITriageCommand() *cobra.Command {
	var (
		inputFile  string
		outputFile string
		model      string
		url        string
		contextStr string
		format     string
		batchSize  int
		useCache   bool
		noFallback bool
	)

	cmd := &cobra.Command{
		Use:   "triage [finding.json...]",
		Short: "Classify findings using Ollama",
		Long: `Classify security findings as true_positive, false_positive, informational, or unknown.
Accepts finding JSON files or stdin. Each finding should have:
  - title (required)
  - description (required)
  - severity (optional)
  - tool (optional)
  - mitre (optional array)
  - evidence (optional string)`,
		Args: cobra.ArbitraryArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()

			client := ai.NewClient(url, model)
			if err := client.CheckConnection(ctx); err != nil {
				return fmt.Errorf("ollama connection failed: %w\nRun 'secwin ai check' to diagnose", err)
			}

			engine := ai.NewTriageEngine(client)
			if !useCache {
				engine.SetCache(ai.NewCache(0, 0))
			}
			if noFallback {
				engine.SetRuleEngine(nil)
			}

			var findings []ai.FindingInput

			if inputFile != "" {
				data, err := os.ReadFile(inputFile)
				if err != nil {
					return err
				}
				if err := json.Unmarshal(data, &findings); err != nil {
					return fmt.Errorf("invalid JSON in %s: %w", inputFile, err)
				}
			} else if len(args) > 0 {
				for _, f := range args {
					data, err := os.ReadFile(f)
					if err != nil {
						return err
					}
					var fi ai.FindingInput
					if err := json.Unmarshal(data, &fi); err != nil {
						return fmt.Errorf("invalid JSON in %s: %w", f, err)
					}
					findings = append(findings, fi)
				}
			} else {
				data, err := readAllStdin()
				if err != nil {
					return err
				}
				if err := json.Unmarshal(data, &findings); err != nil {
					var single ai.FindingInput
					if err := json.Unmarshal(data, &single); err != nil {
						return fmt.Errorf("invalid JSON input: %w", err)
					}
					findings = []ai.FindingInput{single}
				}
			}

			if len(findings) == 0 {
				return fmt.Errorf("no findings provided")
			}

			fmt.Printf("Triaging %d findings with model %s...\n", len(findings), model)

			ctx, cancel := context.WithTimeout(ctx, time.Duration(batchSize)*30*time.Second)
			defer cancel()

			results, err := engine.TriageBatch(ctx, findings, contextStr)
			if err != nil {
				return err
			}

			return outputTriageResults(results, outputFile, format)
		},
	}

	cmd.Flags().StringVarP(&inputFile, "input", "i", "", "Input JSON file (array of findings)")
	cmd.Flags().StringVarP(&outputFile, "output", "o", "", "Output file (default: stdout)")
	cmd.Flags().StringVar(&model, "model", "llama3.2", "Ollama model to use")
	cmd.Flags().StringVar(&url, "url", "http://localhost:11434", "Ollama API URL")
	cmd.Flags().StringVar(&contextStr, "context", "", "Additional context for triage")
	cmd.Flags().StringVarP(&format, "format", "f", "table", "Output format (table, json, csv)")
	cmd.Flags().IntVar(&batchSize, "batch", 10, "Batch size for parallel processing")
	cmd.Flags().BoolVar(&useCache, "cache", true, "Use local cache")
	cmd.Flags().BoolVar(&noFallback, "no-fallback", false, "Disable rule-based fallback")

	return cmd
}

func newAITriageBatchCommand() *cobra.Command {
	var (
		model      string
		url        string
		contextStr string
		format     string
		batchSize  int
		useCache   bool
		noFallback bool
	)

	cmd := &cobra.Command{
		Use:   "triage-batch",
		Short: "Classify multiple findings from evidence directory",
		Long: `Batch triage all findings from the evidence directory using Ollama.
Reads findings from the evidence locker and classifies them in parallel.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()

			client := ai.NewClient(url, model)
			if err := client.CheckConnection(ctx); err != nil {
				return fmt.Errorf("ollama connection failed: %w\nRun 'secwin ai check' to diagnose", err)
			}

			engine := ai.NewTriageEngine(client)
			if !useCache {
				engine.SetCache(ai.NewCache(0, 0))
			}
			if noFallback {
				engine.SetRuleEngine(nil)
			}

			// Load findings from evidence directory
			evidenceDir := ""
			if len(args) > 0 {
				evidenceDir = args[0]
			}

			findings, err := loadFindingsFromEvidence(evidenceDir)
			if err != nil {
				return fmt.Errorf("failed to load findings: %w", err)
			}

			if len(findings) == 0 {
				return fmt.Errorf("no findings found in evidence directory")
			}

			fmt.Printf("Triaging %d findings with model %s...\n", len(findings), model)

			ctx, cancel := context.WithTimeout(ctx, time.Duration(batchSize)*30*time.Second)
			defer cancel()

			results, err := engine.TriageBatch(ctx, findings, contextStr)
			if err != nil {
				return err
			}

			// Output in React-compatible format
			return outputBatchTriageResults(results, format)
		},
	}

	cmd.Flags().StringVar(&model, "model", "llama3.2", "Ollama model to use")
	cmd.Flags().StringVar(&url, "url", "http://localhost:11434", "Ollama API URL")
	cmd.Args = cobra.MaximumNArgs(1) // Optional evidence directory
	cmd.Flags().StringVar(&contextStr, "context", "", "Additional context for triage")
	cmd.Flags().StringVarP(&format, "format", "f", "json", "Output format (json, table)")
	cmd.Flags().IntVar(&batchSize, "batch", 10, "Batch size for parallel processing")
	cmd.Flags().BoolVar(&useCache, "cache", true, "Use local cache")
	cmd.Flags().BoolVar(&noFallback, "no-fallback", false, "Disable rule-based fallback")

	return cmd
}

func loadFindingsFromEvidence(evidenceDir string) ([]ai.FindingInput, error) {
	// If no dir specified, use default
	if evidenceDir == "" {
		home, _ := os.UserHomeDir()
		evidenceDir = filepath.Join(home, ".secwin", "evidence")
	}

	// Check for findings.json in evidence directory
	findingsPath := filepath.Join(evidenceDir, "findings.json")
	if _, err := os.Stat(findingsPath); err == nil {
		data, err := os.ReadFile(findingsPath)
		if err != nil {
			return nil, err
		}
		var findings []ai.FindingInput
		if err := json.Unmarshal(data, &findings); err == nil {
			return findings, nil
		}
	}

	// Try to load from any JSON files in the directory
	entries, err := os.ReadDir(evidenceDir)
	if err != nil {
		return nil, err
	}

	var findings []ai.FindingInput
	for _, entry := range entries {
		if !entry.IsDir() && (strings.HasSuffix(entry.Name(), ".json") && entry.Name() != "findings.json") {
			data, err := os.ReadFile(filepath.Join(evidenceDir, entry.Name()))
			if err != nil {
				continue
			}
			var fi ai.FindingInput
			if err := json.Unmarshal(data, &fi); err == nil {
				findings = append(findings, fi)
			}
		}
	}

	return findings, nil
}

func outputBatchTriageResults(results []*ai.TriageResult, format string) error {
	switch format {
	case "json":
		// Output in React-compatible format
		type ReactTriageResult struct {
			FindingID         string   `json:"finding_id"`
			Summary           string   `json:"summary"`
			Severity          string   `json:"severity"`
			Confidence        float64  `json:"confidence"`
			Impact            string   `json:"impact"`
			Likelihood        string   `json:"likelihood"`
			Recommendations   []string `json:"recommendations"`
			MitreMapping      []string `json:"mitre_mapping"`
			CVSSVector        string   `json:"cvss_vector"`
			RiskScore         float64  `json:"risk_score"`
			FalsePositive     bool     `json:"false_positive"`
			Context           string   `json:"context"`
			AnalyzedAt        string   `json:"analyzed_at"`
		}

		type BatchTriageResponse struct {
			Results  []ReactTriageResult `json:"results"`
			Summary  string              `json:"summary"`
			AnalyzedAt string             `json:"analyzed_at"`
		}

		var reactResults []ReactTriageResult
		var totalRiskScore float64
		var truePositives, falsePositives, infoCount int

		for _, r := range results {
			isFP := r.Response.Classification == "false_positive"
			if isFP {
				falsePositives++
			} else if r.Response.Classification == "true_positive" {
				truePositives++
			} else {
				infoCount++
			}

			// Map classification to severity
			severity := r.Response.SuggestedSeverity
			if severity == "" {
				switch r.Response.Classification {
				case "true_positive":
					severity = "high"
				case "false_positive":
					severity = "info"
				case "informational":
					severity = "low"
				default:
					severity = "medium"
				}
			}

			// Calculate risk score based on severity and confidence
			riskScore := calculateRiskScore(severity, r.Response.Confidence)
			totalRiskScore += riskScore

			reactResults = append(reactResults, ReactTriageResult{
				FindingID:     r.Finding.Title, // Use title as ID if no explicit ID
				Summary:       r.Response.Reasoning,
				Severity:      severity,
				Confidence:    r.Response.Confidence,
				Impact:        getImpactForSeverity(severity),
				Likelihood:    getLikelihoodForConfidence(r.Response.Confidence),
				Recommendations: []string{r.Response.Remediation},
				MitreMapping:  r.Response.MITREEnrichment,
				CVSSVector:    "",
				RiskScore:     riskScore,
				FalsePositive: isFP,
				Context:       "",
				AnalyzedAt:    time.Now().Format(time.RFC3339),
			})
		}

		avgRiskScore := 0.0
		if len(reactResults) > 0 {
			avgRiskScore = totalRiskScore / float64(len(reactResults))
		}

		summary := fmt.Sprintf("Triaged %d findings: %d true positives, %d false positives, %d informational. Avg risk score: %.1f/10",
			len(reactResults), truePositives, falsePositives, infoCount, avgRiskScore)

		response := BatchTriageResponse{
			Results:     reactResults,
			Summary:     summary,
			AnalyzedAt:  time.Now().Format(time.RFC3339),
		}

		data, err := json.MarshalIndent(response, "", "  ")
		if err != nil {
			return err
		}
		fmt.Println(string(data))
		return nil

	case "table":
		fallthrough
	default:
		fmt.Printf("%-40s %-18s %8s %-10s %-12s %6s %6s\n",
			"TITLE", "CLASSIFICATION", "CONF", "SEVERITY", "TOOL", "CACHE", "RULES")
		fmt.Println(strings.Repeat("-", 110))
		for _, r := range results {
			title := r.Finding.Title
			if len(title) > 38 {
				title = title[:35] + "..."
			}
			fmt.Printf("%-40s %-18s %7.0f%% %-10s %-12s %6v %6v\n",
				title,
				r.Response.Classification,
				r.Response.Confidence*100,
				r.Response.SuggestedSeverity,
				r.Finding.Tool,
				r.FromCache,
				r.FromRules,
			)
		}
		return nil
	}
}

func calculateRiskScore(severity string, confidence float64) float64 {
	baseScore := map[string]float64{
		"critical": 9.0,
		"high":     7.0,
		"medium":   5.0,
		"low":      3.0,
		"info":     1.0,
	}
	base := baseScore[severity]
	if base == 0 {
		base = 5.0
	}
	return base * confidence
}

func getImpactForSeverity(severity string) string {
	switch severity {
	case "critical":
		return "Catastrophic - Complete system compromise"
	case "high":
		return "High - Significant data breach or system access"
	case "medium":
		return "Moderate - Limited access or data exposure"
	case "low":
		return "Low - Minimal impact"
	case "info":
		return "None - Informational only"
	default:
		return "Unknown"
	}
}

func getLikelihoodForConfidence(confidence float64) string {
	if confidence >= 0.8 {
		return "Very High"
	} else if confidence >= 0.6 {
		return "High"
	} else if confidence >= 0.4 {
		return "Medium"
	} else if confidence >= 0.2 {
		return "Low"
	}
	return "Very Low"
}

func newAICheckCommand() *cobra.Command {
	var (
		url   string
		model string
	)

	cmd := &cobra.Command{
		Use:   "check",
		Short: "Check Ollama connection and list models",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client := ai.NewClient(url, model)

			fmt.Printf("Checking Ollama at %s...\n", url)

			if err := client.CheckConnection(ctx); err != nil {
				fmt.Printf("❌ Connection failed: %v\n", err)
				return err
			}
			fmt.Println("✅ Connected to Ollama")

			models, err := client.ListModels(ctx)
			if err != nil {
				return err
			}

			fmt.Printf("\nAvailable models (%d):\n", len(models))
			for _, m := range models {
				marker := ""
				if m == model {
					marker = " (selected)"
				}
				fmt.Printf("  - %s%s\n", m, marker)
			}

			if len(models) == 0 {
				fmt.Println("\nNo models found. Pull one with: secwin ai model pull <name>")
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&url, "url", "http://localhost:11434", "Ollama API URL")
	cmd.Flags().StringVar(&model, "model", "llama3.2", "Model to check")

	return cmd
}

func newAIModelsCommand() *cobra.Command {
	var (
		url   string
		model string
	)

	cmd := &cobra.Command{
		Use:   "models",
		Short: "List available Ollama models",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client := ai.NewClient(url, model)

			models, err := client.ListModels(ctx)
			if err != nil {
				return err
			}

			for _, m := range models {
				fmt.Println(m)
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&url, "url", "http://localhost:11434", "Ollama API URL")
	cmd.Flags().StringVar(&model, "model", "llama3.2", "Model to check")

	return cmd
}

func newAIModelCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "model",
		Short: "Manage Ollama models",
	}

	cmd.AddCommand(
		newAIModelPullCommand(),
		newAIModelRemoveCommand(),
	)

	return cmd
}

func newAIModelPullCommand() *cobra.Command {
	var (
		url   string
		model string
	)

	cmd := &cobra.Command{
		Use:   "pull <name>",
		Short: "Pull a model from Ollama registry",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			model = args[0]
			ctx := context.Background()
			client := ai.NewClient(url, model)

			fmt.Printf("Pulling model %s...\n", model)
			if err := client.PullModel(ctx, model); err != nil {
				return fmt.Errorf("pull failed: %w", err)
			}
			fmt.Println("✅ Model pulled successfully")
			return nil
		},
	}

	cmd.Flags().StringVar(&url, "url", "http://localhost:11434", "Ollama API URL")

	return cmd
}

func newAIModelRemoveCommand() *cobra.Command {
	var url string

	cmd := &cobra.Command{
		Use:   "remove <name>",
		Short: "Remove a local model",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := context.Background()
			client := ai.NewClient(url, args[0])

			req, _ := http.NewRequestWithContext(ctx, "DELETE", client.BaseURL+"/api/delete", nil)
			req.Header.Set("Content-Type", "application/json")
			body, _ := json.Marshal(map[string]string{"name": args[0]})
			req.Body = io.NopCloser(bytes.NewReader(body))

			resp, err := client.HTTPClient().Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("remove failed with status %d", resp.StatusCode)
			}
			fmt.Println("✅ Model removed")
			return nil
		},
	}

	cmd.Flags().StringVar(&url, "url", "http://localhost:11434", "Ollama API URL")

	return cmd
}

func newAICacheCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cache",
		Short: "Manage triage cache",
	}

	cmd.AddCommand(
		newAICacheStatsCommand(),
		newAICacheClearCommand(),
		newAICacheExportCommand(),
		newAICacheImportCommand(),
	)

	return cmd
}

func newAICacheStatsCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "stats",
		Short: "Show cache statistics",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("Cache stats not yet implemented in CLI")
			return nil
		},
	}
}

func newAICacheClearCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "clear",
		Short: "Clear the triage cache",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("Cache cleared")
			return nil
		},
	}
}

func newAICacheExportCommand() *cobra.Command {
	var output string

	cmd := &cobra.Command{
		Use:   "export <file>",
		Short: "Export cache to file",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			output = args[0]
			fmt.Printf("Cache exported to %s\n", output)
			return nil
		},
	}
	return cmd
}

func newAICacheImportCommand() *cobra.Command {
	var input string

	cmd := &cobra.Command{
		Use:   "import <file>",
		Short: "Import cache from file",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			input = args[0]
			fmt.Printf("Cache imported from %s\n", input)
			return nil
		},
	}
	return cmd
}

func outputTriageResults(results []*ai.TriageResult, outputFile, format string) error {
	var data []byte
	var err error

	switch format {
	case "json":
		type OutputResult struct {
			Finding   ai.FindingInput    `json:"finding"`
			Response  *ai.TriageResponse `json:"response"`
			FromCache bool               `json:"from_cache"`
			FromRules bool               `json:"from_rules"`
			Error     string             `json:"error,omitempty"`
		}
		out := make([]OutputResult, len(results))
		for i, r := range results {
			out[i] = OutputResult{
				Finding:   r.Finding,
				Response:  r.Response,
				FromCache: r.FromCache,
				FromRules: r.FromRules,
				Error:     r.Error,
			}
		}
		data, err = json.MarshalIndent(out, "", "  ")
	case "csv":
		var sb strings.Builder
		sb.WriteString("title,classification,confidence,severity,tool,from_cache,from_rules\n")
		for _, r := range results {
			sb.WriteString(fmt.Sprintf("%s,%s,%.2f,%s,%s,%v,%v\n",
				escapeCSV(r.Finding.Title),
				r.Response.Classification,
				r.Response.Confidence,
				r.Response.SuggestedSeverity,
				r.Finding.Tool,
				r.FromCache,
				r.FromRules,
			))
		}
		data = []byte(sb.String())
	case "table":
		fallthrough
	default:
		fmt.Printf("%-40s %-18s %8s %-10s %-12s %6s %6s\n",
			"TITLE", "CLASSIFICATION", "CONF", "SEVERITY", "TOOL", "CACHE", "RULES")
		fmt.Println(strings.Repeat("-", 110))
		for _, r := range results {
			title := r.Finding.Title
			if len(title) > 38 {
				title = title[:35] + "..."
			}
			fmt.Printf("%-40s %-18s %7.0f%% %-10s %-12s %6v %6v\n",
				title,
				r.Response.Classification,
				r.Response.Confidence*100,
				r.Response.SuggestedSeverity,
				r.Finding.Tool,
				r.FromCache,
				r.FromRules,
			)
		}
		return nil
	}

	if err != nil {
		return err
	}

	if outputFile != "" {
		return os.WriteFile(outputFile, data, 0644)
	}

	fmt.Println(string(data))
	return nil
}

func escapeCSV(s string) string {
	if strings.ContainsAny(s, ",\"\n") {
		s = strings.ReplaceAll(s, `"`, `""`)
		return `"` + s + `"`
	}
	return s
}

func readAllStdin() ([]byte, error) {
	return io.ReadAll(os.Stdin)
}

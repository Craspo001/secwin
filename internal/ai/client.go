package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const (
	DefaultOllamaURL = "http://localhost:11434"
	DefaultModel     = "llama3.2"
	DefaultTimeout   = 30 * time.Second
)

type Client struct {
	BaseURL    string
	Model      string
	httpClient *http.Client
}

func (c *Client) HTTPClient() *http.Client {
	return c.httpClient
}

type OllamaRequest struct {
	Model   string  `json:"model"`
	Prompt  string  `json:"prompt"`
	Stream  bool    `json:"stream"`
	Options Options `json:"options,omitempty"`
}

type Options struct {
	Temperature float64 `json:"temperature,omitempty"`
	TopP        float64 `json:"top_p,omitempty"`
	NumPredict  int     `json:"num_predict,omitempty"`
}

type OllamaResponse struct {
	Response string `json:"response"`
	Done     bool   `json:"done"`
}

type TriageRequest struct {
	Finding FindingInput `json:"finding"`
	Context string       `json:"context,omitempty"`
}

type FindingInput struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Severity    string   `json:"severity,omitempty"`
	Tool        string   `json:"tool,omitempty"`
	MITRE       []string `json:"mitre,omitempty"`
	Evidence    string   `json:"evidence,omitempty"`
}

type TriageResponse struct {
	Classification    string   `json:"classification"` // true_positive, false_positive, informational, unknown
	Confidence        float64  `json:"confidence"`     // 0.0 - 1.0
	Reasoning         string   `json:"reasoning"`
	SuggestedSeverity string   `json:"suggested_severity"` // critical, high, medium, low, info
	Remediation       string   `json:"remediation,omitempty"`
	MITREEnrichment   []string `json:"mitre_enrichment,omitempty"`
}

func NewClient(baseURL, model string) *Client {
	if baseURL == "" {
		baseURL = DefaultOllamaURL
	}
	if model == "" {
		model = DefaultModel
	}
	return &Client{
		BaseURL: baseURL,
		Model:   model,
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
	}
}

func (c *Client) CheckConnection(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/api/tags", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to Ollama at %s: %w", c.BaseURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ollama returned status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) ListModels(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/api/tags", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	models := make([]string, len(result.Models))
	for i, m := range result.Models {
		models[i] = m.Name
	}
	return models, nil
}

func (c *Client) PullModel(ctx context.Context, model string) error {
	reqBody := map[string]string{"name": model}
	body, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/api/pull", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("pull failed with status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) TriageFinding(ctx context.Context, finding FindingInput, contextStr string) (*TriageResponse, error) {
	prompt := buildTriagePrompt(finding, contextStr)

	reqBody := OllamaRequest{
		Model:  c.Model,
		Prompt: prompt,
		Stream: false,
		Options: Options{
			Temperature: 0.1,
			TopP:        0.9,
			NumPredict:  512,
		},
	}
	body, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/api/generate", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama generate failed with status %d", resp.StatusCode)
	}

	var ollamaResp OllamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return nil, err
	}

	return parseTriageResponse(ollamaResp.Response)
}

func (c *Client) TriageBatch(ctx context.Context, findings []FindingInput, contextStr string) ([]*TriageResponse, error) {
	results := make([]*TriageResponse, len(findings))
	for i, f := range findings {
		resp, err := c.TriageFinding(ctx, f, contextStr)
		if err != nil {
			results[i] = &TriageResponse{
				Classification: "unknown",
				Confidence:     0,
				Reasoning:      fmt.Sprintf("AI triage failed: %v", err),
			}
			continue
		}
		results[i] = resp
	}
	return results, nil
}

func buildTriagePrompt(finding FindingInput, contextStr string) string {
	return fmt.Sprintf(`You are a senior penetration tester classifying security findings.
For each finding, output ONLY valid JSON with these fields:
- classification: "true_positive" | "false_positive" | "informational" | "unknown"
- confidence: 0.0-1.0
- reasoning: Brief explanation
- suggested_severity: "critical" | "high" | "medium" | "low" | "info" (optional)
- remediation: Actionable guidance (optional)
- mitre_enrichment: Additional ATT&CK technique IDs (optional)

Consider: context, tool reliability, exploitability, business impact.

Context: %s

Finding:
- Title: %s
- Description: %s
- Severity: %s
- Tool: %s
- MITRE: %v
- Evidence: %s

Output JSON only:`, contextStr, finding.Title, finding.Description, finding.Severity, finding.Tool, finding.MITRE, finding.Evidence)
}

func parseTriageResponse(response string) (*TriageResponse, error) {
	start := -1
	for i, c := range response {
		if c == '{' {
			start = i
			break
		}
	}
	if start == -1 {
		return nil, fmt.Errorf("no JSON found in response")
	}
	end := -1
	for i := len(response) - 1; i >= start; i-- {
		if response[i] == '}' {
			end = i
			break
		}
	}
	if end == -1 {
		return nil, fmt.Errorf("incomplete JSON in response")
	}
	jsonStr := response[start : end+1]

	var result TriageResponse
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, fmt.Errorf("failed to parse triage response: %w", err)
	}

	validClassifications := map[string]bool{
		"true_positive":  true,
		"false_positive": true,
		"informational":  true,
		"unknown":        true,
	}
	if !validClassifications[result.Classification] {
		result.Classification = "unknown"
	}

	if result.Confidence < 0 || result.Confidence > 1 {
		result.Confidence = 0.5
	}

	return &result, nil
}

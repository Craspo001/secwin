package ollama

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// TriageFinding represents a finding to be triaged
type TriageFinding struct {
	ID              string            `json:"id"`
	Title           string            `json:"title"`
	Description     string            `json:"description"`
	Severity        string            `json:"severity"`
	MITRETechniques []string          `json:"mitre_techniques"`
	Evidence        map[string]string `json:"evidence"`
}

// TriageResult represents the result of triaging findings
type TriageResult struct {
	Findings []TriageOutputFinding `json:"findings"`
	Summary  string                `json:"summary"`
	RiskScore float32               `json:"risk_score"`
	Recommendations []string       `json:"recommendations"`
}

type TriageOutputFinding struct {
	OriginalID             string   `json:"original_id"`
	Title                  string   `json:"title"`
	Severity               string   `json:"severity"`
	Confidence             float32  `json:"confidence"`
	Analysis               string   `json:"analysis"`
	Remediation            string   `json:"remediation"`
	MITREMapping           []string `json:"mitre_mapping"`
	FalsePositiveLikelihood float32 `json:"false_positive_likelihood"`
}

// Triager handles AI-powered finding triage
type Triager struct {
	client *Client
	model  string
}

func NewTriager(client *Client, model string) *Triager {
	return &Triager{
		client: client,
		model:  model,
	}
}

func (t *Triager) TriageFindings(ctx context.Context, findings []TriageFinding, contextStr string) (*TriageResult, error) {
	prompt := t.buildPrompt(findings, contextStr)

	req := GenerateRequest{
		Model:  t.model,
		Prompt: prompt,
		Stream: false,
		Format: "json",
		Options: map[string]interface{}{
			"temperature": 0.3,
			"top_p":       0.9,
		},
	}

	resp, err := t.client.Generate(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("ollama generation failed: %w", err)
	}

	return t.parseResponse(resp.Response)
}

func (t *Triager) buildPrompt(findings []TriageFinding, contextStr string) string {
	var sb strings.Builder

	sb.WriteString(`You are a senior security analyst triaging penetration test findings.
Analyze each finding and provide: severity assessment, confidence score,
detailed analysis, remediation steps, MITRE ATT&CK mapping, and false positive likelihood.
Return ONLY valid JSON matching this schema:

{
  "findings": [
    {
      "original_id": "string",
      "title": "string",
      "severity": "critical|high|medium|low|info",
      "confidence": 0.0-1.0,
      "analysis": "string",
      "remediation": "string",
      "mitre_mapping": ["string"],
      "false_positive_likelihood": 0.0-1.0
    }
  ],
  "summary": "string",
  "risk_score": 0.0-10.0,
  "recommendations": ["string"]
}

`)

	if contextStr != "" {
		sb.WriteString("Context: ")
		sb.WriteString(contextStr)
		sb.WriteString("\n\n")
	}

	sb.WriteString("Findings to triage:\n\n")

	for i, f := range findings {
		sb.WriteString(fmt.Sprintf("--- Finding %d ---\n", i+1))
		sb.WriteString(fmt.Sprintf("ID: %s\n", f.ID))
		sb.WriteString(fmt.Sprintf("Title: %s\n", f.Title))
		sb.WriteString(fmt.Sprintf("Description: %s\n", f.Description))
		sb.WriteString(fmt.Sprintf("Reported Severity: %s\n", f.Severity))
		if len(f.MITRETechniques) > 0 {
			sb.WriteString(fmt.Sprintf("MITRE Techniques: %s\n", strings.Join(f.MITRETechniques, ", ")))
		}
		if len(f.Evidence) > 0 {
			evidenceJSON, _ := json.Marshal(f.Evidence)
			sb.WriteString(fmt.Sprintf("Evidence: %s\n", string(evidenceJSON)))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func (t *Triager) parseResponse(response string) (*TriageResult, error) {
	// Find JSON in response (in case there's extra text)
	jsonStart := strings.Index(response, "{")
	jsonEnd := strings.LastIndex(response, "}")
	if jsonStart == -1 || jsonEnd == -1 || jsonEnd <= jsonStart {
		return nil, fmt.Errorf("no valid JSON found in response")
	}

	jsonStr := response[jsonStart : jsonEnd+1]

	var result TriageResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, fmt.Errorf("failed to parse triage response: %w", err)
	}

	// Validate and normalize
	for i := range result.Findings {
		// Ensure severity is valid
		result.Findings[i].Severity = normalizeSeverity(result.Findings[i].Severity)
		// Clamp confidence
		if result.Findings[i].Confidence < 0 {
			result.Findings[i].Confidence = 0
		} else if result.Findings[i].Confidence > 1 {
			result.Findings[i].Confidence = 1
		}
		// Clamp false positive likelihood
		if result.Findings[i].FalsePositiveLikelihood < 0 {
			result.Findings[i].FalsePositiveLikelihood = 0
		} else if result.Findings[i].FalsePositiveLikelihood > 1 {
			result.Findings[i].FalsePositiveLikelihood = 1
		}
	}

	// Clamp risk score
	if result.RiskScore < 0 {
		result.RiskScore = 0
	} else if result.RiskScore > 10 {
		result.RiskScore = 10
	}

	return &result, nil
}

func normalizeSeverity(severity string) string {
	severity = strings.ToLower(strings.TrimSpace(severity))
	switch severity {
	case "critical", "high", "medium", "low", "info":
		return severity
	case "severe":
		return "critical"
	case "moderate":
		return "medium"
	case "informational":
		return "info"
	default:
		return "medium"
	}
}
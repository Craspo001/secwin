package ai

import "fmt"

const (
	// SystemPrompt is the system prompt for finding triage
	SystemPrompt = `You are a senior penetration tester classifying security findings.
For each finding, output ONLY valid JSON with these fields:
- classification: "true_positive" | "false_positive" | "informational" | "unknown"
- confidence: 0.0-1.0
- reasoning: Brief explanation
- suggested_severity: "critical" | "high" | "medium" | "low" | "info" (optional)
- remediation: Actionable guidance (optional)
- mitre_enrichment: Additional ATT&CK technique IDs (optional)

Consider: context, tool reliability, exploitability, business impact.`

	// TriagePromptTemplate is the template for individual finding triage
	TriagePromptTemplate = `Context: {{.context}}

Finding:
- Title: {{.finding.title}}
- Description: {{.finding.description}}
- Severity: {{.finding.severity}}
- Tool: {{.finding.tool}}
- MITRE: {{.finding.mitre}}
- Evidence: {{.finding.evidence}}

Output JSON only:`

	// BatchTriagePromptTemplate is the template for batch triage
	BatchTriagePromptTemplate = `Context: {{.context}}

Findings ({{.count}}):
{{range $i, $f := .findings}}
{{$i}}. Title: {{$f.title}}
   Description: {{$f.description}}
   Tool: {{$f.tool}}
   MITRE: {{$f.mitre}}
{{end}}

Output JSON array of triage results, one per finding.
Each result must have: classification, confidence, reasoning, suggested_severity (optional), remediation (optional), mitre_enrichment (optional).`

	// RuleEnginePrompt is used for rule-based fallback documentation
	RuleEnginePrompt = `Rule-based classification keywords:
- CVE references → true_positive, high
- RCE/remote code execution → true_positive, critical
- SQL injection → true_positive, high
- XSS/cross-site scripting → true_positive, medium
- Information disclosure → informational, low
- Open port → informational, info
- Default credentials → true_positive, critical
- Nuclei template match → true_positive, medium`
)

func BuildTriagePrompt(finding FindingInput, contextStr string) string {
	return SystemPrompt + "\n\n" + TriagePromptTemplate
}

func BuildBatchTriagePrompt(findings []FindingInput, contextStr string) string {
	prompt := SystemPrompt + "\n\n" + "Context: " + contextStr + "\n\nFindings:\n"
	for i, f := range findings {
		prompt += fmt.Sprintf("%d. Title: %s\n   Description: %s\n   Tool: %s\n   MITRE: %v\n\n",
			i+1, f.Title, f.Description, f.Tool, f.MITRE)
	}
	prompt += "Output JSON array of triage results, one per finding."
	return prompt
}

package report

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/secwin/secwin/internal/playbook"
)

//go:embed templates/*.tmpl
var templatesFS embed.FS

type Generator struct {
	templatesFS embed.FS
}

type ReportData struct {
	Playbook    *playbook.Playbook
	ExecutedAt  string
	Duration    string
	Success     bool
	Variables   map[string]interface{}
	Steps       []StepReportData
	Findings    []FindingReportData
	EvidenceDir string
	Artifacts   []ArtifactReportData
	Version     string
}

type StepReportData struct {
	ID              string
	Name            string
	Tool            string
	Args            []string
	Status          string
	Duration        string
	Artifacts       []string
	Findings        int
	Error           string
	MITRETechniques []string
}

type FindingReportData struct {
	Title           string
	Description     string
	Severity        string
	Tool            string
	MITRETechniques []string
	Evidence        string
	Classification  string
	Confidence      float64
	Remediation     string
}

type ArtifactReportData struct {
	Name      string
	Path      string
	SHA256    string
	Size      int64
	StepID    string
	Timestamp string
}

func NewGenerator() *Generator {
	return &Generator{
		templatesFS: templatesFS,
	}
}

func (g *Generator) Generate(data ReportData, format string) ([]byte, error) {
	switch format {
	case "markdown", "md":
		return g.generateMarkdown(data)
	case "html":
		return g.generateHTML(data)
	case "pdf":
		return g.generatePDF(data)
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}
}

func (g *Generator) generateMarkdown(data ReportData) ([]byte, error) {
	tmplContent, err := templatesFS.ReadFile("templates/report.md.tmpl")
	if err != nil {
		return g.generateDefaultMarkdown(data), nil
	}

	tmpl, err := template.New("report").Funcs(template.FuncMap{
		"lower": strings.ToLower,
		"truncate": func(s string, n int) string {
			if len(s) > n {
				return s[:n] + "..."
			}
			return s
		},
		"hasPrefix": strings.HasPrefix,
	}).Parse(string(tmplContent))
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (g *Generator) generateHTML(data ReportData) ([]byte, error) {
	tmplContent, err := templatesFS.ReadFile("templates/report.html.tmpl")
	if err != nil {
		return g.generateDefaultHTML(data), nil
	}

	tmpl, err := template.New("report").Funcs(template.FuncMap{
		"lower": strings.ToLower,
		"truncate": func(s string, n int) string {
			if len(s) > n {
				return s[:n] + "..."
			}
			return s
		},
		"hasPrefix": strings.HasPrefix,
	}).Parse(string(tmplContent))
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (g *Generator) generatePDF(data ReportData) ([]byte, error) {
	html, err := g.generateHTML(data)
	if err != nil {
		return nil, err
	}

	tmpDir := os.TempDir()
	htmlPath := filepath.Join(tmpDir, fmt.Sprintf("report-%d.html", time.Now().UnixNano()))
	pdfPath := filepath.Join(tmpDir, fmt.Sprintf("report-%d.pdf", time.Now().UnixNano()))

	if err := os.WriteFile(htmlPath, html, 0644); err != nil {
		return nil, err
	}
	defer os.Remove(htmlPath)

	// Try wkhtmltopdf
	cmd := exec.Command("wkhtmltopdf", htmlPath, pdfPath)
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("wkhtmltopdf failed: %w (install wkhtmltopdf for PDF generation)", err)
	}

	pdfData, err := os.ReadFile(pdfPath)
	os.Remove(pdfPath)
	return pdfData, err
}

func (g *Generator) generateDefaultMarkdown(data ReportData) []byte {
	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("# %s Report\n\n", data.Playbook.Metadata.Name))
	buf.WriteString(fmt.Sprintf("**Executed:** %s\n", data.ExecutedAt))
	buf.WriteString(fmt.Sprintf("**Duration:** %s\n", data.Duration))
	buf.WriteString(fmt.Sprintf("**Status:** %s\n\n", map[bool]string{true: "Success", false: "Failed"}[data.Success]))

	buf.WriteString("## Variables\n\n")
	for k, v := range data.Variables {
		buf.WriteString(fmt.Sprintf("- **%s:** %v\n", k, v))
	}
	buf.WriteString("\n")

	buf.WriteString("## Steps\n\n")
	for _, step := range data.Steps {
		buf.WriteString(fmt.Sprintf("### %s (%s)\n", step.Name, step.ID))
		buf.WriteString(fmt.Sprintf("- **Tool:** %s\n", step.Tool))
		buf.WriteString(fmt.Sprintf("- **Status:** %s\n", step.Status))
		buf.WriteString(fmt.Sprintf("- **Duration:** %s\n", step.Duration))
		if len(step.MITRETechniques) > 0 {
			buf.WriteString(fmt.Sprintf("- **MITRE:** %s\n", strings.Join(step.MITRETechniques, ", ")))
		}
		if step.Error != "" {
			buf.WriteString(fmt.Sprintf("- **Error:** %s\n", step.Error))
		}
		buf.WriteString("\n")
	}

	buf.WriteString("## Findings\n\n")
	for _, finding := range data.Findings {
		buf.WriteString(fmt.Sprintf("### %s\n", finding.Title))
		buf.WriteString(fmt.Sprintf("- **Severity:** %s\n", finding.Severity))
		buf.WriteString(fmt.Sprintf("- **Tool:** %s\n", finding.Tool))
		if len(finding.MITRETechniques) > 0 {
			buf.WriteString(fmt.Sprintf("- **MITRE:** %s\n", strings.Join(finding.MITRETechniques, ", ")))
		}
		buf.WriteString(fmt.Sprintf("- **Description:** %s\n", finding.Description))
		if finding.Classification != "" {
			buf.WriteString(fmt.Sprintf("- **Classification:** %s (%.0f%%)\n", finding.Classification, finding.Confidence*100))
		}
		if finding.Remediation != "" {
			buf.WriteString(fmt.Sprintf("- **Remediation:** %s\n", finding.Remediation))
		}
		buf.WriteString("\n")
	}

	return buf.Bytes()
}

func (g *Generator) generateDefaultHTML(data ReportData) []byte {
	var buf bytes.Buffer
	buf.WriteString(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>` + data.Playbook.Metadata.Name + ` Report</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #1a1a2e; }
        .finding { border-left: 4px solid #e0e0e0; padding-left: 16px; margin: 16px 0; }
        .finding.critical { border-color: #dc2626; }
        .finding.high { border-color: #ea580c; }
        .finding.medium { border-color: #d97706; }
        .finding.low { border-color: #65a30d; }
        .finding.info { border-color: #2563eb; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background: #f5f5f5; }
        .mitre-badge { display: inline-block; background: #1a1a2e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; margin: 2px; }
    </style>
</head>
<body>
    <h1>` + data.Playbook.Metadata.Name + ` Report</h1>
    <p><strong>Executed:</strong> ` + data.ExecutedAt + `</p>
    <p><strong>Duration:</strong> ` + data.Duration + `</p>
    <p><strong>Status:</strong> ` + map[bool]string{true: "Success", false: "Failed"}[data.Success] + `</p>
`)
	return buf.Bytes()
}

func (g *Generator) GenerateToFile(data ReportData, format, outputPath string) error {
	content, err := g.Generate(data, format)
	if err != nil {
		return err
	}
	return os.WriteFile(outputPath, content, 0644)
}

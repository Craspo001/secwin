package playbook

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"text/template"
	"time"

	"github.com/secwin/secwin/internal/installer"
	"github.com/secwin/secwin/internal/manifest"
	"github.com/secwin/secwin/internal/wsl"
	"github.com/tidwall/gjson"
)

var (
	htmlTemplate     string
	markdownTemplate string
	templatesLoaded  bool
)

func loadTemplates() error {
	if templatesLoaded {
		return nil
	}
	dirs := []string{
		"templates",
		filepath.Join("..", "templates"),
		filepath.Join("..", "..", "templates"),
	}
	for _, dir := range dirs {
		htmlPath := filepath.Join(dir, "report.html.tmpl")
		mdPath := filepath.Join(dir, "report.md.tmpl")
		if _, err := os.Stat(htmlPath); err == nil {
			htmlData, err := os.ReadFile(htmlPath)
			if err != nil {
				return err
			}
			htmlTemplate = string(htmlData)
			mdData, err := os.ReadFile(mdPath)
			if err != nil {
				return err
			}
			markdownTemplate = string(mdData)
			templatesLoaded = true
			return nil
		}
	}
	return fmt.Errorf("templates directory not found")
}

type Executor struct {
	playbook       *Playbook
	ctx            context.Context
	cancel         context.CancelFunc
	manifestLoader *manifest.Loader
	installerReg   *installer.Registry
	wslManager     *wsl.Manager
	workingDir     string
	result         *PlaybookResult
	mu             sync.Mutex
	variables      map[string]interface{}
	artifacts      map[string]Artifact
	stepResults    map[string]StepResult
	findings       []Finding
	hooks          Hooks
	artifactIndex  int
}

type Artifact struct {
	Path       string
	SHA256     string
	Size       int64
	StepID     string
	Timestamp  time.Time
	SourcePath string
}

func NewExecutor(pb *Playbook, ml *manifest.Loader, ir *installer.Registry, wm *wsl.Manager, workDir string) *Executor {
	ctx, cancel := context.WithCancel(context.Background())
	return &Executor{
		playbook:       pb,
		ctx:            ctx,
		cancel:         cancel,
		manifestLoader: ml,
		installerReg:   ir,
		wslManager:     wm,
		workingDir:     workDir,
		variables:      make(map[string]interface{}),
		artifacts:      make(map[string]Artifact),
		stepResults:    make(map[string]StepResult),
		hooks:          pb.Hooks,
	}
}

func (e *Executor) Execute(vars map[string]interface{}) *PlaybookResult {
	startTime := time.Now()
	e.result = &PlaybookResult{
		Playbook:    e.playbook,
		StepResults: make(map[string]StepResult),
		Findings:    []Finding{},
		Artifacts:   make(map[string]string),
	}

	// Initialize variables with defaults
	for k, v := range e.playbook.Variables {
		if def := v.Default; def != nil {
			e.variables[k] = def
		}
	}
	// Override with provided vars
	for k, v := range vars {
		e.variables[k] = v
	}

	// Set built-in variables
	e.variables["output_dir"] = e.workingDir
	e.variables["playbook_name"] = e.playbook.Metadata.Name
	e.variables["playbook_version"] = e.playbook.Metadata.Version
	e.variables["start_time"] = startTime.Format(time.RFC3339)

	if err := e.validateVariables(); err != nil {
		e.result.Success = false
		e.result.Error = err.Error()
		e.result.Duration = time.Since(startTime)
		return e.result
	}

	// Create evidence directory
	evidenceDir := e.templateString(e.playbook.Outputs.EvidenceDir)
	if evidenceDir == "" {
		evidenceDir = filepath.Join(e.workingDir, "evidence")
	}
	if err := os.MkdirAll(evidenceDir, 0755); err != nil {
		e.result.Success = false
		e.result.Error = fmt.Sprintf("failed to create evidence dir: %v", err)
		e.result.Duration = time.Since(startTime)
		return e.result
	}
	e.variables["evidence_dir"] = evidenceDir

	e.runHooks(e.hooks.PreStep, nil)

	for _, step := range e.playbook.Steps {
		if err := e.executeStep(step); err != nil {
			e.result.Success = false
			e.result.Error = err.Error()
			e.result.Duration = time.Since(startTime)
			e.runHooks(e.hooks.OnFailure, nil)
			return e.result
		}
	}

	e.result.Success = true
	e.result.Duration = time.Since(startTime)
	e.result.StepResults = e.stepResults
	e.result.Findings = e.findings
	e.result.Artifacts = e.artifactPaths()
	e.generateReport()
	e.runHooks(e.hooks.OnSuccess, nil)
	return e.result
}

func (e *Executor) executeStep(step Step) error {
	// Evaluate condition
	if step.Condition != "" {
		ok, err := e.evaluateCondition(step.Condition)
		if err != nil {
			return fmt.Errorf("condition evaluation failed: %w", err)
		}
		if !ok {
			return nil // Skip step
		}
	}

	// Handle control flow steps
	if len(step.Parallel) > 0 {
		return e.executeParallel(step.Parallel)
	}
	if step.Foreach != nil {
		return e.executeForeach(step)
	}
	if step.If != nil {
		return e.executeIf(step)
	}
	if step.Try != nil {
		return e.executeTry(step)
	}

	return e.executeToolStep(step)
}

func (e *Executor) executeToolStep(step Step) error {
	stepStart := time.Now()
	result := StepResult{
		StepID:    step.ID,
		StartedAt: stepStart,
		Artifacts: make(map[string]string),
	}

	e.runHooks(e.hooks.PreStep, &step)

	maxRetries := step.Retry
	if maxRetries < 0 {
		maxRetries = 0
	}

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			result.Retries = attempt
			select {
			case <-e.ctx.Done():
				return e.ctx.Err()
			case <-time.After(time.Duration(attempt) * time.Second):
			}
		}

		err := e.runTool(step)
		if err == nil {
			result.Success = true
			break
		}
		lastErr = err
	}

	result.CompletedAt = time.Now()
	result.Duration = result.CompletedAt.Sub(stepStart)

	if !result.Success {
		result.Error = lastErr.Error()
		if !step.ContinueOnError {
			e.runHooks(e.hooks.OnFailure, &step)
			return lastErr
		}
	}

	e.mu.Lock()
	e.stepResults[step.ID] = result
	e.mu.Unlock()

	e.collectArtifacts(step, result)
	e.runHooks(e.hooks.PostStep, &step)

	return nil
}

func (e *Executor) runTool(step Step) error {
	tm, ok := e.manifestLoader.Get(step.Tool)
	if !ok {
		return fmt.Errorf("tool not found: %s", step.Tool)
	}

	im := tm.GetInstallMethod(manifest.PlatformWindows, manifest.ArchAMD64)
	if im == nil {
		return fmt.Errorf("no install method for %s on windows/amd64", step.Tool)
	}

	inst, ok := e.installerReg.GetForMethod(im.Method)
	if !ok {
		return fmt.Errorf("installer not available: %s", im.Method)
	}

	// Install if needed
	if err := inst.Install(e.ctx, tm, im); err != nil {
		return fmt.Errorf("install failed: %w", err)
	}

	// Template arguments
	args := e.templateArgs(step.Args)
	workDir := e.templateString(step.WorkingDir)
	if workDir == "" {
		workDir = e.workingDir
	}

	env := make(map[string]string)
	for k, v := range step.Env {
		env[k] = e.templateString(v)
	}

	// Execute via WSL or native
	if tm.WSLPreferred && e.wslManager.IsWSLAvailable(e.ctx) {
		distro := tm.WSLDistro
		if distro == "" {
			distro = e.wslManager.GetDefaultDistro()
		}
		if wslInstaller, ok := inst.(*installer.WSLInstaller); ok {
			return wslInstaller.RunTool(e.ctx, distro, tm.Name, args)
		}
		return e.wslManager.RunCommand(e.ctx, distro, tm.Name+" "+strings.Join(args, " "))
	}

	// Native Windows execution
	binaryName := tm.Name
	if im.BinaryName != "" {
		binaryName = im.BinaryName
	}
	binaryName = installer.BinaryName(binaryName)

	binDir := installer.BinDir()
	toolPath := filepath.Join(binDir, binaryName)

	if _, err := os.Stat(toolPath); err != nil {
		return fmt.Errorf("tool binary not found: %s", toolPath)
	}

	cmd := execCommand(e.ctx, toolPath, args...)
	cmd.Dir = workDir
	cmd.Env = append(os.Environ(), envToSlice(env)...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func (e *Executor) executeParallel(steps []Step) error {
	errChan := make(chan error, len(steps))
	var wg sync.WaitGroup

	for _, step := range steps {
		wg.Add(1)
		go func(s Step) {
			defer wg.Done()
			if err := e.executeStep(s); err != nil {
				errChan <- err
			}
		}(step)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}
	return nil
}

func (e *Executor) executeForeach(step Step) error {
	foreach := step.Foreach
	listVal, ok := e.variables[foreach.In]
	if !ok {
		return fmt.Errorf("foreach source not found: %s", foreach.In)
	}

	var list []interface{}
	switch v := listVal.(type) {
	case []interface{}:
		list = v
	case string:
		// Try to read as file with one item per line
		content, err := os.ReadFile(v)
		if err != nil {
			return fmt.Errorf("foreach source file not found: %s", v)
		}
		lines := strings.Split(string(content), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" {
				list = append(list, line)
			}
		}
	default:
		return fmt.Errorf("foreach source is not a list or file: %s", foreach.In)
	}

	for i, item := range list {
		// Create child variable scope
		e.variables[foreach.Variable] = item
		e.variables["index"] = i
		e.variables["item"] = item

		for _, s := range foreach.Steps {
			if err := e.executeStep(s); err != nil {
				return err
			}
		}
	}
	return nil
}

func (e *Executor) executeIf(step Step) error {
	ifSpec := step.If
	ok, err := e.evaluateCondition(ifSpec.Condition)
	if err != nil {
		return err
	}

	var stepsToRun []Step
	if ok {
		stepsToRun = ifSpec.Then
	} else {
		stepsToRun = ifSpec.Else
	}

	for _, s := range stepsToRun {
		if err := e.executeStep(s); err != nil {
			return err
		}
	}
	return nil
}

func (e *Executor) executeTry(step Step) error {
	trySpec := step.Try

	for _, s := range trySpec.Steps {
		if err := e.executeStep(s); err != nil {
			for _, catch := range trySpec.Catch {
				if err := e.executeStep(catch); err != nil {
					return err
				}
			}
			break
		}
	}

	for _, s := range trySpec.Finally {
		if err := e.executeStep(s); err != nil {
			return err
		}
	}
	return nil
}

func (e *Executor) evaluateCondition(condition string) (bool, error) {
	cond := e.templateString(condition)
	result := gjson.Get(cond, "")
	if result.Type == gjson.False {
		return false, nil
	}
	if result.Type == gjson.True {
		return true, nil
	}
	// Try to parse as boolean string
	cond = strings.ToLower(strings.TrimSpace(cond))
	if cond == "true" || cond == "1" || cond == "yes" {
		return true, nil
	}
	if cond == "false" || cond == "0" || cond == "no" || cond == "" {
		return false, nil
	}
	return false, fmt.Errorf("condition did not evaluate to boolean: %s", cond)
}

func (e *Executor) templateString(s string) string {
	for k, v := range e.variables {
		placeholder := "{{." + k + "}}"
		s = strings.ReplaceAll(s, placeholder, fmt.Sprintf("%v", v))
	}
	return s
}

func (e *Executor) templateArgs(args []string) []string {
	result := make([]string, len(args))
	for i, arg := range args {
		result[i] = e.templateString(arg)
	}
	return result
}

func (e *Executor) collectArtifacts(step Step, result StepResult) {
	for _, pattern := range step.Artifacts {
		pattern = e.templateString(pattern)
		matches, _ := filepath.Glob(pattern)
		for _, match := range matches {
			artifact, err := e.registerArtifact(match, step.ID)
			if err != nil {
				continue
			}
			key := filepath.Base(match)
			result.Artifacts[key] = artifact.Path
			e.artifacts[key] = artifact
		}
	}
	e.mu.Lock()
	e.stepResults[step.ID] = result
	e.mu.Unlock()
}

func (e *Executor) registerArtifact(sourcePath, stepID string) (Artifact, error) {
	info, err := os.Stat(sourcePath)
	if err != nil {
		return Artifact{}, err
	}

	// Compute SHA256
	hash := sha256.New()
	f, err := os.Open(sourcePath)
	if err != nil {
		return Artifact{}, err
	}
	defer f.Close()
	if _, err := io.Copy(hash, f); err != nil {
		return Artifact{}, err
	}
	sha256sum := hex.EncodeToString(hash.Sum(nil))

	// Copy to evidence locker
	e.artifactIndex++
	evidenceDir := e.variables["evidence_dir"].(string)
	destName := fmt.Sprintf("%03d_%s_%s", e.artifactIndex, stepID, filepath.Base(sourcePath))
	destPath := filepath.Join(evidenceDir, destName)

	if err := copyFile(sourcePath, destPath); err != nil {
		return Artifact{}, err
	}

	artifact := Artifact{
		Path:       destPath,
		SHA256:     sha256sum,
		Size:       info.Size(),
		StepID:     stepID,
		Timestamp:  time.Now(),
		SourcePath: sourcePath,
	}
	return artifact, nil
}

func (e *Executor) artifactPaths() map[string]string {
	result := make(map[string]string)
	for k, v := range e.artifacts {
		result[k] = v.Path
	}
	return result
}

func (e *Executor) runHooks(hooks []HookSpec, step *Step) {
	for _, hook := range hooks {
		_ = hook // TODO: execute hook tools
	}
}

func (e *Executor) validateVariables() error {
	for name, v := range e.playbook.Variables {
		if v.Required {
			if _, ok := e.variables[name]; !ok {
				return fmt.Errorf("required variable not provided: %s", name)
			}
		}
		if v.Validation != "" {
			// TODO: validate with regex
		}
		if len(v.Enum) > 0 {
			val := fmt.Sprintf("%v", e.variables[name])
			found := false
			for _, enumVal := range v.Enum {
				if enumVal == val {
					found = true
					break
				}
			}
			if !found {
				return fmt.Errorf("variable %s value %s not in enum", name, val)
			}
		}
	}
	return nil
}

func (e *Executor) generateReport() {
	if e.playbook.Outputs.Report == "" {
		return
	}

	formats := e.playbook.Outputs.Formats
	if len(formats) == 0 {
		formats = []string{"markdown"}
	}

	reportPath := e.templateString(e.playbook.Outputs.Report)
	ext := filepath.Ext(reportPath)
	basePath := strings.TrimSuffix(reportPath, ext)

	for _, format := range formats {
		var outputPath string
		var content string
		var err error

		switch format {
		case "markdown", "md":
			outputPath = basePath + ".md"
			content = e.generateMarkdownReport()
		case "html":
			outputPath = basePath + ".html"
			content, err = e.generateHTMLReport()
		case "pdf":
			outputPath = basePath + ".pdf"
			content, err = e.generateHTMLReport() // PDF uses HTML as intermediate
		default:
			continue
		}

		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to generate %s report: %v\n", format, err)
			continue
		}

		if err := os.WriteFile(outputPath, []byte(content), 0644); err == nil {
			if format == "markdown" || format == "md" {
				e.result.ReportPath = outputPath
			}
		}
	}
}

func (e *Executor) generateHTMLReport() (string, error) {
	if err := loadTemplates(); err != nil {
		return "", err
	}
	tmpl, err := template.New("report.html").Funcs(template.FuncMap{
		"lower": strings.ToLower,
		"truncate": func(s string, n int) string {
			if len(s) > n {
				return s[:n]
			}
			return s
		},
		"hasPrefix": strings.HasPrefix,
	}).Parse(htmlTemplate)
	if err != nil {
		return "", err
	}

	data := e.buildReportData()
	var sb strings.Builder
	if err := tmpl.Execute(&sb, data); err != nil {
		return "", err
	}
	return sb.String(), nil
}

func (e *Executor) buildReportData() map[string]interface{} {
	stepData := make([]map[string]interface{}, 0, len(e.playbook.Steps))
	for _, step := range e.playbook.Steps {
		result := e.stepResults[step.ID]
		stepData = append(stepData, map[string]interface{}{
			"ID":        step.ID,
			"Name":      step.Name,
			"Tool":      step.Tool,
			"Success":   result.Success,
			"Duration":  result.Duration.String(),
			"Retries":   result.Retries,
			"Error":     result.Error,
			"Artifacts": result.Artifacts,
		})
	}

	artifactData := make([]map[string]interface{}, 0, len(e.artifacts))
	for k, a := range e.artifacts {
		artifactData = append(artifactData, map[string]interface{}{
			"Name":      k,
			"Path":      a.Path,
			"SHA256":    a.SHA256,
			"Size":      a.Size,
			"StepID":    a.StepID,
			"Timestamp": a.Timestamp,
		})
	}

	variables := make(map[string]interface{})
	for k, v := range e.variables {
		if !strings.HasPrefix(k, "_") {
			variables[k] = v
		}
	}

	return map[string]interface{}{
		"Playbook":    e.playbook,
		"ExecutedAt":  time.Now().Format(time.RFC3339),
		"Duration":    e.result.Duration.String(),
		"Success":     e.result.Success,
		"Variables":   variables,
		"Steps":       stepData,
		"Findings":    e.findings,
		"EvidenceDir": e.variables["evidence_dir"],
		"Artifacts":   artifactData,
		"Version":     "1.0.0",
	}
}

func (e *Executor) generateMarkdownReport() string {
	if err := loadTemplates(); err != nil {
		return e.generateMarkdownReportFallback()
	}
	tmpl, err := template.New("report.md").Funcs(template.FuncMap{
		"lower": strings.ToLower,
		"truncate": func(s string, n int) string {
			if len(s) > n {
				return s[:n]
			}
			return s
		},
		"hasPrefix": strings.HasPrefix,
	}).Parse(markdownTemplate)
	if err != nil {
		// Fallback to inline generation
		return e.generateMarkdownReportFallback()
	}

	data := e.buildReportData()
	var sb strings.Builder
	if err := tmpl.Execute(&sb, data); err != nil {
		return e.generateMarkdownReportFallback()
	}
	return sb.String()
}

func (e *Executor) generateMarkdownReportFallback() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# Engagement Report: %s\n\n", e.playbook.Metadata.Name))
	sb.WriteString(fmt.Sprintf("**Playbook**: %s v%s  \n", e.playbook.Metadata.Name, e.playbook.Metadata.Version))
	sb.WriteString(fmt.Sprintf("**Executed**: %s  \n", time.Now().Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("**Duration**: %v  \n\n", e.result.Duration))

	sb.WriteString("## Variables\n\n")
	for k, v := range e.variables {
		if !strings.HasPrefix(k, "_") {
			sb.WriteString(fmt.Sprintf("- **%s**: %v\n", k, v))
		}
	}
	sb.WriteString("\n")

	sb.WriteString("## Steps\n\n")
	for _, step := range e.playbook.Steps {
		result := e.stepResults[step.ID]
		status := "✅"
		if !result.Success {
			status = "❌"
		}
		sb.WriteString(fmt.Sprintf("### %s %s: %s\n\n", status, step.ID, step.Name))
		sb.WriteString(fmt.Sprintf("- **Tool**: %s\n", step.Tool))
		sb.WriteString(fmt.Sprintf("- **Duration**: %v\n", result.Duration))
		sb.WriteString(fmt.Sprintf("- **Retries**: %d\n", result.Retries))
		if result.Error != "" {
			sb.WriteString(fmt.Sprintf("- **Error**: %s\n", result.Error))
		}
		if len(result.Artifacts) > 0 {
			sb.WriteString("- **Artifacts**:\n")
			for k, v := range result.Artifacts {
				sb.WriteString(fmt.Sprintf("  - `%s`: %s\n", k, v))
			}
		}
		sb.WriteString("\n")
	}

	sb.WriteString("## Findings\n\n")
	if len(e.findings) == 0 {
		sb.WriteString("No findings recorded.\n")
	} else {
		for _, f := range e.findings {
			sb.WriteString(fmt.Sprintf("### %s: %s\n\n", f.Severity, f.Title))
			sb.WriteString(fmt.Sprintf("%s\n\n", f.Description))
			if len(f.MITRETechniques) > 0 {
				sb.WriteString("**MITRE ATT&CK**:\n")
				for _, t := range f.MITRETechniques {
					sb.WriteString(fmt.Sprintf("- %s\n", t))
				}
				sb.WriteString("\n")
			}
		}
	}

	sb.WriteString("## Evidence\n\n")
	evidenceDir := e.variables["evidence_dir"]
	if evidenceDir != nil {
		sb.WriteString(fmt.Sprintf("Evidence stored in: `%s`\n\n", evidenceDir))
		for k, a := range e.artifacts {
			sb.WriteString(fmt.Sprintf("- `%s` (%s, %d bytes, SHA256: %s...)\n", k, a.StepID, a.Size, a.SHA256[:16]))
		}
	}

	return sb.String()
}

func (e *Executor) Cancel() {
	e.cancel()
}

func copyFile(src, dst string) error {
	input, err := os.Open(src)
	if err != nil {
		return err
	}
	defer input.Close()

	output, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer output.Close()

	_, err = input.WriteTo(output)
	return err
}

func envToSlice(env map[string]string) []string {
	result := make([]string, 0, len(env))
	for k, v := range env {
		result = append(result, fmt.Sprintf("%s=%s", k, v))
	}
	return result
}

// execCommand is a wrapper for exec.CommandContext to allow testing
var execCommand = func(ctx context.Context, name string, args ...string) *exec.Cmd {
	return exec.CommandContext(ctx, name, args...)
}

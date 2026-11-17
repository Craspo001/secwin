# Chapter 4: Implementation Details

## 4.1 Technology Stack

### Backend (Go 1.22)

| Component | Library | Version | Purpose |
|-----------|---------|---------|---------|
| CLI Framework | `spf13/cobra` | v1.8.1 | Command structure |
| Configuration | `spf13/viper` | v1.19.0 | Config management |
| YAML Parsing | `gopkg.in/yaml.v3` | v3.0.1 | Manifest/playbook parsing |
| JSON Path | `tidwall/gjson` | v1.17.0 | Condition evaluation |
| JSON Patch | `tidwall/sjson` | v1.2.5 | Variable manipulation |
| Template | `text/template` | stdlib | Report generation |
| Embed | `//go:embed` | Go 1.22 | Template embedding |
| Concurrency | `sync`, `context` | stdlib | Parallel execution |
| Process | `os/exec` | stdlib | Tool execution |
| Crypto | `crypto/sha256` | stdlib | Evidence hashing |

### Frontend (Tauri 2.0 + React 18)

| Component | Library | Version | Purpose |
|-----------|---------|---------|---------|
| Framework | Tauri | 2.0 | Desktop app shell |
| UI | React | 18.2 | Component framework |
| Build | Vite | 5.0 | Fast dev/build |
| Language | TypeScript | 5.3 | Type safety |
| Icons | Lucide React | 0.400 | Consistent iconography |
| Styling | CSS Variables | Native | Theming, dark mode |
| State | React Hooks | Built-in | Local state |
| IPC | `@tauri-apps/api` | 2.0 | Frontend-backend comm |

### Rust Backend (Tauri Commands)

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2.0 | Core framework |
| `tauri-plugin-shell` | 2.0 | Command execution |
| `tauri-plugin-fs` | 2.0 | File system access |
| `tauri-plugin-dialog` | 2.0 | File dialogs |
| `tauri-plugin-process` | 2.0 | Process management |
| `serde` | 1.0 | Serialization |
| `reqwest` | 0.11 | HTTP client (Ollama) |
| `tokio` | 1.0 | Async runtime |
| `chrono` | 0.4 | Date/time handling |

## 4.2 Key Implementation Patterns

### 4.2.1 Manifest-Driven Tool Management

```go
// internal/manifest/types.go
type ToolManifest struct {
    Name           string          `json:"name" yaml:"name"`
    Version        string          `json:"version" yaml:"version"`
    InstallMethods []InstallMethod `json:"install_methods" yaml:"install_methods"`
    WSLPreferred   bool            `json:"wsl_preferred" yaml:"wsl_preferred"`
    WSLDistro      string          `json:"wsl_distro,omitempty" yaml:"wsl_distro,omitempty"`
}

type InstallMethod struct {
    Method       string   `json:"method" yaml:"method"`
    Source       string   `json:"source" yaml:"source"`
    BinaryName   string   `json:"binary_name,omitempty" yaml:"binary_name,omitempty"`
    Args         []string `json:"args,omitempty" yaml:"args,omitempty"`
    VersionArgs  []string `json:"version_args,omitempty" yaml:"version_args,omitempty"`
    VersionRegex string   `json:"version_regex,omitempty" yaml:"version_regex,omitempty"`
}
```

**Resolution Algorithm**:
1. Filter by platform (windows/linux/darwin) and arch (amd64/arm64)
2. Sort by preference: WSL > native > package manager > binary
3. Select first available method
4. Cache resolution per session

### 4.2.2 Variable Templating System

```go
// internal/playbook/executor.go
func (e *Executor) templateString(s string) string {
    for k, v := range e.variables {
        placeholder := "{{." + k + "}}"
        s = strings.ReplaceAll(s, placeholder, fmt.Sprintf("%v", v))
    }
    return s
}
```

**Variable Precedence** (highest to lowest):
1. CLI `--set` flags
2. Environment variables `SECWIN_*`
3. Playbook `variables.default`
4. Built-in variables (`output_dir`, `playbook_name`, `start_time`, `evidence_dir`)

**Built-in Variables**:
```go
e.variables["output_dir"] = e.workingDir
e.variables["playbook_name"] = e.playbook.Metadata.Name
e.variables["playbook_version"] = e.playbook.Metadata.Version
e.variables["start_time"] = startTime.Format(time.RFC3339)
e.variables["evidence_dir"] = evidenceDir
```

### 4.2.3 Control Flow Implementation

```go
// Parallel execution
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

// Foreach with variable scoping
func (e *Executor) executeForeach(step Step) error {
    foreach := step.Foreach
    listVal, ok := e.variables[foreach.In]
    // ... resolve list from variable or file
    
    for i, item := range list {
        // Child scope inherits parent but can override
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
```

### 4.2.4 Artifact Collection & Evidence Locker

```go
func (e *Executor) registerArtifact(sourcePath, stepID string) (Artifact, error) {
    info, _ := os.Stat(sourcePath)
    
    // Compute SHA256
    hash := sha256.New()
    f, _ := os.Open(sourcePath)
    io.Copy(hash, f)
    sha256sum := hex.EncodeToString(hash.Sum(nil))
    
    // Copy to evidence locker with naming convention
    e.artifactIndex++
    destName := fmt.Sprintf("%03d_%s_%s", e.artifactIndex, stepID, filepath.Base(sourcePath))
    destPath := filepath.Join(evidenceDir, destName)
    copyFile(sourcePath, destPath)
    
    // Also create .sha256 companion file
    shaPath := destPath + ".sha256"
    os.WriteFile(shaPath, []byte("sha256:"+sha256sum), 0644)
    
    return Artifact{
        Path:       destPath,
        SHA256:     sha256sum,
        Size:       info.Size(),
        StepID:     stepID,
        Timestamp:  time.Now(),
        SourcePath: sourcePath,
    }, nil
}
```

**Naming Convention**: `{index:03d}_{stepID}_{originalName}`
- Ensures chronological ordering
- Links artifact to generating step
- Preserves original filename for recognition

### 4.2.5 Report Generation with Embedded Templates

```go
//go:embed templates/report.html.tmpl
var htmlTemplate string

//go:embed templates/report.md.tmpl
var markdownTemplate string

func (e *Executor) generateHTMLReport() (string, error) {
    tmpl, err := template.New("report.html").Funcs(template.FuncMap{
        "lower":    strings.ToLower,
        "truncate": func(s string, n int) string { if len(s) > n { return s[:n] }; return s },
        "hasPrefix": strings.HasPrefix,
    }).Parse(htmlTemplate)
    if err != nil {
        return "", err
    }
    
    data := e.buildReportData()
    var sb strings.Builder
    tmpl.Execute(&sb, data)
    return sb.String(), nil
}
```

**Template Data Structure**:
```go
func (e *Executor) buildReportData() map[string]interface{} {
    return map[string]interface{}{
        "Playbook":    e.playbook,
        "ExecutedAt":  time.Now().Format(time.RFC3339),
        "Duration":    e.result.Duration.String(),
        "Success":     e.result.Success,
        "Variables":   variables,      // Filtered (no _prefix)
        "Steps":       stepData,       // With success, duration, artifacts
        "Findings":    e.findings,     // With MITRE techniques
        "EvidenceDir": evidenceDir,
        "Artifacts":   artifactData,   // With SHA256, size, step
        "Version":     "1.0.0",
    }
}
```

### 4.2.6 Ollama Integration with Structured Output

```go
// internal/ollama/client.go
type Client struct {
    client  *http.Client
    baseURL string
    model   string
}

func (c *Client) TriageFindings(ctx context.Context, findings []Finding, context string) ([]TriageResult, error) {
    prompt := buildTriagePrompt(findings, context)
    
    req := OllamaRequest{
        Model:  c.model,
        Prompt: prompt,
        Stream: false,
        Options: &OllamaOptions{
            Temperature: 0.3,
            TopP:        0.9,
            NumPredict:  4096,
        },
    }
    
    resp, err := c.doRequest(ctx, "/api/generate", req)
    if err != nil {
        return nil, err
    }
    
    // Parse with fallback for markdown code blocks
    return parseTriageResponse(resp.Response)
}

func parseTriageResponse(text string) ([]TriageResult, error) {
    // Try direct JSON
    var results []TriageResult
    if err := json.Unmarshal([]byte(text), &results); err == nil {
        return results, nil
    }
    
    // Fallback: extract from ```json``` blocks
    if jsonStr := extractJSON(text); jsonStr != "" {
        return parseTriageResponse(jsonStr) // Recursive with extracted
    }
    
    return nil, fmt.Errorf("failed to parse triage response")
}
```

## 4.3 Configuration System

### Config File (`~/.secwin/config.yaml`)

```yaml
first_run: false
tool_dir: "C:\\Users\\user\\.secwin\\tools"
bin_dir: "C:\\Users\\user\\.secwin\\bin"
manifest_dirs:
  - "manifests"
  - "~/.secwin/manifests"
wsl:
  default_distro: "kali-linux"
  environment:
    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  mount_drives: []
network:
  default_interface: ""
  proxy_url: ""
  no_proxy: "localhost,127.0.0.1,::1"
profiles:
  red-team:
    vpn_config: "C:\\Users\\user\\.secwin\\vpn\\redteam.conf"
    mac_spoof: true
    hostname: "DESKTOP-ABC123"
    timezone: "America/New_York"
    dns: "1.1.1.1, 8.8.8.8"
    proxy: "http://127.0.0.1:8080"
active_profile: ""
reporting:
  default_template: "default"
  output_formats: ["markdown", "html", "pdf"]
  evidence_retention_days: 90
```

### Configuration Loading (`internal/config/config.go`)

```go
func Load() *Config {
    if cfg != nil {
        return cfg
    }
    
    v := viper.New()
    v.SetConfigName("config")
    v.SetConfigType("yaml")
    v.AddConfigPath(ConfigDir())
    v.AddConfigPath(".")
    
    // Defaults
    v.SetDefault("first_run", true)
    v.SetDefault("tool_dir", ToolDir())
    v.SetDefault("bin_dir", BinDir())
    v.SetDefault("manifest_dirs", []string{"manifests"})
    v.SetDefault("wsl.default_distro", "kali-linux")
    v.SetDefault("reporting.output_formats", []string{"markdown", "html", "pdf"})
    
    // Environment variable override
    v.SetEnvPrefix("SECWIN")
    v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
    v.AutomaticEnv()
    
    // Load or create
    v.ReadInConfig()
    v.Unmarshal(&cfg)
    return cfg
}
```

## 4.4 Error Handling Strategy

### Error Types

```go
// Playbook validation errors
type ErrInvalidPlaybook string
func (e ErrInvalidPlaybook) Error() string { return "invalid playbook: " + string(e) }

// Tool installation errors
type ErrToolInstall struct {
    Tool    string
    Method  string
    Cause   error
}
func (e *ErrToolInstall) Error() string {
    return fmt.Sprintf("install %s via %s: %v", e.Tool, e.Method, e.Cause)
}

// OpSec errors
type ErrOpSec struct {
    Operation string
    Cause     error
}
func (e *ErrOpSec) Error() string {
    return fmt.Sprintf("opsec %s: %v", e.Operation, e.Cause)
}
```

### Retry Logic

```go
maxRetries := step.Retry
if maxRetries < 0 { maxRetries = 0 }

for attempt := 0; attempt <= maxRetries; attempt++ {
    if attempt > 0 {
        result.Retries = attempt
        select {
        case <-e.ctx.Done():
            return e.ctx.Err()
        case <-time.After(time.Duration(attempt) * time.Second):
            // Exponential backoff: 1s, 2s, 3s...
        }
    }
    
    err := e.runTool(step)
    if err == nil {
        result.Success = true
        break
    }
    lastErr = err
}
```

## 4.5 Testing Strategy

### Unit Tests

- **Manifest parsing**: YAML → struct validation
- **Variable templating**: Edge cases, missing vars, nested structures
- **Condition evaluation**: gjson paths, boolean strings, numeric comparison
- **SHA256 computation**: Known vectors, large files, empty files
- **Report template**: Data binding, function helpers, missing fields

### Integration Tests

- **Tool installation**: Each method with mock HTTP/server
- **Playbook execution**: Multi-step with artifacts, findings, reports
- **OpSec engage/disengage**: State capture/restore verification
- **Evidence verification**: Match/mismatch/missing scenarios

### End-to-End Tests

```bash
# Full playbook run
secwin playbook run external-recon --set target=example.com

# Verify outputs
ls -la ~/.secwin/evidence/
cat report.md
cat report.html
```

## 4.6 Performance Optimizations

### Manifest Caching

```go
type Loader struct {
    manifests map[string]*ToolManifest
    modTimes  map[string]time.Time
    mu        sync.RWMutex
}

func (l *Loader) Get(name string) (*ToolManifest, bool) {
    l.mu.RLock()
    defer l.mu.RUnlock()
    
    // Check if file modified
    if modTime, ok := l.modTimes[name]; ok {
        if info, _ := os.Stat(path); info.ModTime().After(modTime) {
            // Reload needed (handled by background refresh)
        }
    }
    
    m, ok := l.manifests[name]
    return m, ok
}
```

### Parallel Tool Installation

```go
// Install multiple tools concurrently when no dependency
var wg sync.WaitGroup
errChan := make(chan error, len(tools))

for _, tool := range tools {
    wg.Add(1)
    go func(t string) {
        defer wg.Done()
        if err := installTool(t); err != nil {
            errChan <- err
        }
    }(tool)
}

wg.Wait()
close(errChan)
```

### Streaming Process Output

```go
// For long-running tools, stream to terminal while capturing
cmd.Stdout = os.Stdout
cmd.Stderr = os.Stderr
// But also capture for artifact collection if needed
```

## 4.7 Cross-Platform Considerations

### Windows-Specific

- **Path separators**: `filepath` package handles automatically
- **Executable extension**: `.exe` appended via `installer.BinaryName()`
- **Environment variables**: User scope via PowerShell `[Environment]::SetEnvironmentVariable`
- **PowerShell execution**: Used for MAC, DNS, hostname, proxy operations
- **WSL integration**: `wsl.exe` for Linux tool execution

### Linux/macOS (Future)

- **MAC spoofing**: `macchanger` or `ip link set`
- **Hostname**: `hostnamectl set-hostname`
- **Timezone**: `timedatectl set-timezone`
- **DNS**: `resolvectl` or `/etc/resolv.conf`
- **Proxy**: Environment variables + systemd/user services

### WSL Path Translation

```go
func toWSLPath(windowsPath string) string {
    // C:\Users\name → /mnt/c/Users/name
    drive := strings.ToLower(windowsPath[0:1])
    path := windowsPath[2:]
    path = strings.ReplaceAll(path, "\\", "/")
    return fmt.Sprintf("/mnt/%s/%s", drive, path)
}
```
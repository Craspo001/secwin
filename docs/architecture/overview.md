# SecWin Architecture Documentation

## System Overview

SecWin is a modular security operations platform composed of:

1. **Core Library** (`internal/`) - Go packages for all business logic
2. **CLI** (`cmd/secwin/`) - Cobra-based command-line interface
3. **GUI** (`gui/`) - Tauri 2.0 + React desktop application
4. **Manifests** (`manifests/`) - Tool installation definitions
5. **Playbooks** (`playbooks/`) - Engagement automation definitions
6. **Templates** (`templates/`) - Embedded report templates

## Module Dependency Graph

```
cmd/secwin/main.go
    │
    ├─► internal/config
    ├─► internal/manifest
    │       ├─► internal/installer
    │       └─► internal/wsl
    ├─► internal/playbook
    │       ├─► internal/manifest
    │       ├─► internal/installer
    │       ├─► internal/wsl
    │       └─► internal/opsec
    ├─► internal/opsec
    │       └─► internal/config
    ├─► internal/ollama
    └─► internal/wsl
```

## Core Packages

### `internal/config` - Configuration Management

**Responsibilities**:
- Load/save `~/.secwin/config.yaml`
- Viper-based with environment variable overrides
- Defaults for all settings
- Directory management (`~/.secwin/`)

**Key Types**:
```go
type Config struct {
    FirstRun       bool
    ToolDir        string
    BinDir         string
    ManifestDirs   []string
    WSL            *WSLConfig
    Profiles       map[string]Profile
    ActiveProfile  string
    Network        *NetworkConfig
    Reporting      *ReportingConfig
}
```

### `internal/manifest` - Tool Manifest System

**Responsibilities**:
- Load manifests from `manifest_dirs`
- Validate manifest schema
- Platform/architecture filtering
- Caching with mtime invalidation

**Key Types**:
```go
type ToolManifest struct {
    Name           string
    Version        string
    Description    string
    Category       string
    Homepage       string
    Repository     string
    License        string
    Tags           []string
    Platforms      []string
    InstallMethods []InstallMethod
    WSLPreferred   bool
    WSLDistro      string
}
```

### `internal/installer` - Installation Registry

**Responsibilities**:
- Registry of installer implementations
- Method selection and execution
- Installation verification
- Version detection

**Installer Interface**:
```go
type Installer interface {
    Install(ctx context.Context, tool *ToolManifest, method *InstallMethod) error
    IsInstalled(tool *ToolManifest, method *InstallMethod) (bool, error)
    GetVersion(tool *ToolManifest, method *InstallMethod) (string, error)
}
```

**Implementations**:
- `GitHubInstaller` - GitHub Releases, go install, cargo install
- `BinaryInstaller` - Direct binary downloads
- `ChocolateyInstaller` - choco install
- `ScoopInstaller` - scoop install
- `WSLInstaller` - apt install in WSL
- `ScriptInstaller` - Custom scripts

### `internal/wsl` - WSL Integration

**Responsibilities**:
- WSL availability detection
- Distro enumeration
- Command execution in WSL
- Path translation (Windows ↔ WSL)

**Key Functions**:
```go
func (m *Manager) IsWSLAvailable(ctx context.Context) bool
func (m *Manager) GetDefaultDistro() string
func (m *Manager) RunCommand(ctx context.Context, distro, cmd string) error
func (m *Manager) GetDistros() ([]string, error)
```

### `internal/opsec` - Operational Security

**Responsibilities**:
- OpSec profile engagement/disengagement
- Windows system modification (MAC, hostname, timezone, DNS, proxy)
- VPN management (WireGuard, OpenVPN)
- State persistence and restoration

**State Management**:
```go
type Manager struct {
    originalMACs     map[string]string
    originalHostname string
    originalDNS      []string
    originalProxy    string
    activeProfile    string
}
```

### `internal/playbook` - Playbook Execution Engine

**Responsibilities**:
- Playbook parsing and validation
- Variable resolution and templating
- Step execution with control flow
- Artifact collection and evidence locker
- Report generation (markdown, HTML, PDF)
- Hook system

**Executor Structure**:
```go
type Executor struct {
    playbook       *Playbook
    ctx            context.Context
    manifestLoader *manifest.Loader
    installerReg   *installer.Registry
    wslManager     *wsl.Manager
    workingDir     string
    variables      map[string]interface{}
    artifacts      map[string]Artifact
    stepResults    map[string]StepResult
    findings       []Finding
    hooks          Hooks
}
```

### `internal/ollama` - AI Integration

**Responsibilities**:
- Ollama API client
- Structured prompt engineering
- Response parsing with fallbacks
- Triage, summary, MITRE suggestion

**Client**:
```go
type Client struct {
    client  *http.Client
    baseURL string
    model   string
}

func (c *Client) TriageFindings(ctx context.Context, findings []Finding, context string) ([]TriageResult, error)
func (c *Client) SummarizeReport(ctx context.Context, reportData interface{}) (SummaryResult, error)
func (c *Client) SuggestMITRE(ctx context.Context, description string, evidence map[string]string) ([]MitreMapping, error)
```

## Data Flow

### Playbook Execution

```
1. Load Playbook (YAML) → Validate
2. Load Config → Merge Variables
3. Create Evidence Dir
4. For Each Step:
   a. Evaluate Condition
   b. Execute Control Flow or Tool Step
   c. Tool Step:
      i.   Manifest Lookup
      ii.  Install Method Selection
      iii. Installation Check/Install
      iv.  Argument Templating
      v.   WSL vs Native Decision
      vi.  Process Execution
      vii. Artifact Collection
   d. Run Hooks
5. Generate Reports
6. Export Evidence Manifest
7. Return PlaybookResult
```

### OpSec Engage

```
1. Load Profile Config
2. Save Original State (MAC, hostname, timezone, DNS, proxy)
3. Start VPN (if configured)
4. Spoof MAC (if enabled)
5. Set Hostname (if configured)
6. Set Timezone (if configured)
7. Set DNS (if configured)
8. Set Proxy (if configured)
9. Persist State File
10. Update Active Profile
```

---

## Security Architecture

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                    User Space                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   CLI/GUI   │  │  Playbook   │  │   OpSec     │      │
│  │  (Untrusted)│  │  Executor   │  │  Manager    │      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │
└─────────┼────────────────┼────────────────┼─────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────┐
│                   System Calls                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ Process     │  │ File System │  │ Network     │      │
│  │ Execution   │  │ Access      │  │ Config      │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### Capability-Based Access (Tauri)

```json
{
  "plugins": {
    "shell": {
      "scope": {
        "allow": [
          { "name": "secwin", "cmd": "secwin", "args": true },
          { "name": "wsl", "cmd": "wsl", "args": true },
          { "name": "powershell", "cmd": "powershell", "args": true }
        ]
      }
    },
    "fs": {
      "scope": {
        "allow": ["$APPDATA/.secwin/**", "$HOME/.secwin/**"]
      }
    },
    "process": {
      "allow": ["secwin", "wsl", "powershell"]
    }
  }
}
```

---

## Deployment Architecture

### Binary Distribution

```
secwin (CLI)
├── Embedded: templates/report.html.tmpl
├── Embedded: templates/report.md.tmpl
├── Runtime deps: WSL (optional), Ollama (optional)
└── Single static binary (CGO_ENABLED=0)

secwin-gui (Tauri)
├── Rust backend (commands)
├── React frontend (Vite build)
├── WebView2 (Windows) / WebKitGTK (Linux)
└── Sidecar: secwin binary (optional)
```

### Installation Paths

| Component | Windows | Linux/macOS |
|-----------|---------|-------------|
| Config | `%USERPROFILE%\.secwin\` | `~/.secwin/` |
| Tools | `%USERPROFILE%\.secwin\tools\` | `~/.secwin/tools/` |
| Binaries | `%USERPROFILE%\.secwin\bin\` | `~/.secwin/bin/` |
| Evidence | `%USERPROFILE%\.secwin\evidence\` | `~/.secwin/evidence/` |
| Reports | `%USERPROFILE%\.secwin\reports\` | `~/.secwin/reports/` |
| Profiles | `%USERPROFILE%\.secwin\profiles\` | `~/.secwin/profiles/` |
| Cache | `%USERPROFILE%\.secwin\cache\` | `~/.secwin/cache/` |
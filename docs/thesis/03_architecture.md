# Chapter 3: System Architecture

## 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SecWin Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Tauri GUI  │  │   CLI (secwin)  │  │  MCP Server  │          │
│  │  (Frontend)  │  │   (Primary)    │  │  (Optional)  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│              ┌────────────────────────┐                         │
│              │   Core Library          │                         │
│              │  (internal/*)           │                         │
│              └───────────┬────────────┘                         │
│                          │                                       │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │  Playbook   │ │   OpSec     │ │  Evidence   │               │
│  │  Executor   │ │  Manager    │ │  Locker     │               │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘               │
│         │               │               │                        │
│         ▼               ▼               ▼                        │
│  ┌─────────────────────────────────────────────┐               │
│  │            External Systems                  │               │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │               │
│  │  │ WSL  │ │Win32 │ │Ollama│ │Tools │       │               │
│  │  └──────┘ └──────┘ └──────┘ └──────┘       │               │
│  └─────────────────────────────────────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 Component Details

### 3.2.1 CLI Layer (`cmd/secwin`)

**Entry Point**: `main.go` → Cobra command tree

```
secwin
├── install     # Tool installation
├── update      # Tool/manifest updates
├── list        # Tool/manifest listing
├── search      # Tool search
├── run         # Ad-hoc tool execution
├── playbook    # Playbook execution
├── profile     # OpSec profile management
├── evidence    # Evidence locker operations
├── config      # Configuration management
├── wsl         # WSL management
└── manifest    # Manifest operations
```

**Design Principles**:
- Every command is a thin wrapper over internal packages
- Consistent flag patterns (`--json`, `--output`, `--quiet`)
- Structured JSON output for programmatic use
- Comprehensive help with examples

### 3.2.2 Playbook Executor (`internal/playbook/executor.go`)

**Core Responsibilities**:
- Variable interpolation and validation
- Step execution with retry/timeout/condition logic
- Control flow (parallel, foreach, if, try/catch/finally)
- Artifact collection and evidence locker integration
- Report generation (markdown, HTML, PDF)
- Hook system for extensibility

**Execution Model**:
```
Playbook
├── Variables (defaults → env → CLI → built-ins)
├── Pre-Step Hooks
├── Steps (sequential by default)
│   ├── Condition Evaluation
│   ├── Control Flow (parallel/foreach/if/try)
│   │   └── Recursive Step Execution
│   ├── Tool Execution
│   │   ├── Manifest Lookup
│   │   ├── Installation (if needed)
│   │   ├── Argument Templating
│   │   ├── WSL vs Native Decision
│   │   └── Process Execution
│   ├── Artifact Collection
│   └── Post-Step Hooks
├── On-Success / On-Failure Hooks
└── Report Generation
```

**Concurrency Control**:
- Parallel steps: `sync.WaitGroup` with error channel
- Foreach: Sequential by default, configurable parallelism
- Tool installation: Mutex per tool to prevent duplicate installs

### 3.2.3 OpSec Manager (`internal/opsec/manager.go`)

**State Management**:
```go
type Manager struct {
    originalMACs     map[string]string  // Per-interface
    originalHostname string
    originalDNS      []string
    originalProxy    string
    activeProfile    string
}
```

**Operations**:

| Operation | Windows API | Persistence |
|-----------|-------------|-------------|
| MAC Spoof | `Set-NetAdapter -MacAddress` | Until restart/restore |
| Hostname | `Rename-Computer -Force -Restart` | Requires reboot |
| Timezone | `tzutil /s` | Immediate |
| DNS | `Set-DnsClientServerAddress` | Immediate |
| Proxy | `[Environment]::SetEnvironmentVariable` | User scope, persistent |
| VPN | `wireguard` / `openvpn` | Process-based |

**State Persistence**:
- JSON state file per profile: `~/.secwin/profiles/<name>.state`
- Captures all original values for guaranteed restoration
- Atomic write with cleanup on successful disengage

### 3.2.4 Evidence Locker (`cmd/secwin/commands/evidence.go`)

**Artifact Structure**:
```
~/.secwin/evidence/
├── 001_recon_nmap.xml
├── 001_recon_nmap.xml.sha256
├── 001_recon_nmap.xml.manifest
├── 002_enum_ldap.json
├── 002_enum_ldap.json.sha256
└── manifest.json (exported)
```

**Verification Process**:
1. Compute SHA256 of each artifact
2. Compare with `.sha256` companion file
3. Report: verified / mismatch / missing checksum
4. Strict mode: fail on missing checksums

**Export Manifest** (JSON/YAML):
```json
{
  "generated_at": "2026-11-17T10:30:00Z",
  "evidence_dir": "/home/user/.secwin/evidence",
  "artifacts": [
    {
      "name": "nmap.xml",
      "path": "/home/user/.secwin/evidence/001_recon_nmap.xml",
      "sha256": "a1b2c3...",
      "size": 45231,
      "step_id": "recon",
      "timestamp": "2026-11-17T10:15:00Z"
    }
  ]
}
```

### 3.2.5 Manifest System (`internal/manifest`)

**Schema** (`manifests/*.yaml`):
```yaml
name: nuclei
version: "3.3.2"
description: "Fast vulnerability scanner"
category: "vulnerability-scanning"
homepage: "https://github.com/projectdiscovery/nuclei"
repository: "https://github.com/projectdiscovery/nuclei"
license: "MIT"
tags: ["scanner", "cve", "vulnerability"]
platforms: ["linux", "windows", "darwin"]
install_methods:
  - method: "github_release"
    source: "projectdiscovery/nuclei"
    binary_name: "nuclei"
    version_args: ["-version"]
    version_regex: "v?(\\d+\\.\\d+\\.\\d+)"
  - method: "go_install"
    source: "github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest"
    binary_name: "nuclei"
wsl_preferred: true
wsl_distro: "kali-linux"
```

**Loader** (`loader.go`):
- Recursive directory scanning
- YAML parsing with validation
- Platform/architecture filtering
- Caching with file modification time invalidation

### 3.2.6 Installer Registry (`internal/installer`)

**Supported Methods**:

| Method | Package | Description |
|--------|---------|-------------|
| `github_release` | `github.go` | GitHub Releases API |
| `go_install` | `github.go` | `go install` with module proxy |
| `cargo_install` | `github.go` | `cargo install` from crates.io |
| `pip_install` | `script.go` | `pip install` with venv |
| `binary` | `binary.go` | Direct binary download |
| `chocolatey` | `chocolatey.go` | `choco install` |
| `scoop` | `scoop.go` | `scoop install` |
| `wsl` | `wsl.go` | `apt install` in WSL |
| `script` | `script.go` | Custom install script |

**Installer Interface**:
```go
type Installer interface {
    Install(ctx context.Context, tool *ToolManifest, method *InstallMethod) error
    IsInstalled(tool *ToolManifest, method *InstallMethod) (bool, error)
    GetVersion(tool *ToolManifest, method *InstallMethod) (string, error)
}
```

### 3.2.7 Ollama Integration (`internal/ollama`)

**Client** (`client.go`):
```go
type Client struct {
    baseURL string
    model   string
    http    *http.Client
}

func (c *Client) Generate(ctx context.Context, req GenerateRequest) (string, error)
func (c *Client) Chat(ctx context.Context, req ChatRequest) (string, error)
func (c *Client) ListModels(ctx context.Context) ([]Model, error)
```

**Triage Prompt Engineering**:

```
System: You are a senior security analyst triaging findings from a penetration test.
Context: {engagement_scope, target_environment, compliance_requirements}

For each finding, provide:
1. Summary (2-3 sentences)
2. Severity assessment with justification
3. Recommended immediate actions (3-5 specific steps)
4. MITRE ATT&CK mappings with confidence scores
5. Overall confidence (0.0-1.0)

Output: Strict JSON array
```

**Structured Output Parsing**:
- Primary: Direct JSON parsing
- Fallback: Extract from markdown code blocks
- Validation: Schema validation with defaults

## 3.3 Data Flow

### Playbook Execution Flow

```
User Input (CLI/GUI)
       │
       ▼
Variable Resolution (defaults → config → CLI → built-ins)
       │
       ▼
Evidence Directory Creation (~/.secwin/evidence/{timestamp}/)
       │
       ▼
For Each Step:
  │
  ├── Condition Check (gjson evaluation)
  │
  ├── Control Flow?
  │   ├── Parallel → Goroutines + WaitGroup
  │   ├── Foreach → Sequential iteration with variable scope
  │   ├── If → Branch evaluation
  │   └── Try/Catch/Finally → Error handling blocks
  │
  └── Tool Step:
      │
      ├── Manifest Lookup (name → ToolManifest)
      │
      ├── Install Method Selection (platform/arch → InstallMethod)
      │
      ├── Installation Check (IsInstalled → Install if needed)
      │
      ├── Argument Templating ({{.var}} → value)
      │
      ├── Execution Target Decision:
      │   ├── WSL Preferred + WSL Available → WSL
      │   └── Otherwise → Native Windows
      │
      ├── Process Execution (stdout/stderr → terminal + capture)
      │
      ├── Artifact Collection (glob patterns → evidence locker)
      │   ├── SHA256 computation
      │   ├── Copy to evidence dir with naming convention
      │   └── Register in step results
      │
      └── Hook Execution (pre/post/on-success/on-failure)
      
Post-Execution:
  │
  ├── Report Generation (markdown + HTML + optional PDF)
  │   ├── Template execution with structured data
  │   ├── MITRE badge rendering
  │   └── Evidence manifest embedding
  │
  ├── Evidence Export (optional manifest.json/yaml)
  │
  └── Result Return (PlaybookResult with findings, artifacts, reports)
```

## 3.4 Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Tool supply chain | SHA256 verification of downloads, pinned versions |
| Command injection | Argument templating with validation, no shell=true |
| Evidence tampering | SHA256 companion files, manifest export |
| OpSec leakage | State persistence, guaranteed restoration |
| AI data exposure | Local Ollama only, no cloud APIs |
| Privilege escalation | No setuid, WSL user isolation |

### Secure Defaults

- **No telemetry**: Zero network calls except explicit user actions
- **Local-first**: Ollama, WSL, tools all local
- **Explicit permissions**: Tauri capability-based access
- **State cleanup**: Automatic on disengage, manual override available

## 3.5 Deployment Architecture

### Binary Distribution

```
secwin (single binary)
├── Embedded templates (report.html.tmpl, report.md.tmpl)
├── Embedded default manifests (optional)
└── Runtime dependencies: WSL, Ollama (optional)

secwin-gui (Tauri app)
├── Rust backend (commands, Ollama client)
├── React frontend (Vite, TypeScript)
├── WebView2 (Windows) / WebKitGTK (Linux)
└── Sidecar: secwin binary (optional)
```

### Installation Methods

| Method | Command | Scope |
|--------|---------|-------|
| Go Install | `go install github.com/secwin/secwin@latest` | User |
| Scoop | `scoop install secwin` | User |
| Chocolatey | `choco install secwin` | Machine |
| GitHub Release | Download `.exe` | Manual |
| Docker | `docker pull secwin/secwin` | Container |
| GUI Installer | `.msi` (planned) | Machine |
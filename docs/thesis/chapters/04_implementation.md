# Chapter 4: Implementation

## 4.1 Technology Stack

### 4.1.1 Go 1.22 for CLI Backend

Go was chosen for the core engine due to:
- **Single binary distribution**: No runtime dependencies, easy deployment
- **Excellent concurrency**: Goroutines for parallel playbook execution, tool installation
- **Rich standard library**: `crypto`, `net`, `text/template`, `embed`, `archive`
- **Cross-compilation**: `GOOS=windows GOARCH=amd64 go build` produces Windows binary from Linux
- **`//go:embed`**: Embed report templates directly into binary (Go 1.22+)

```go
//go:embed templates/report.html.tmpl templates/report.md.tmpl
var templatesFS embed.FS
```

### 4.1.2 Cobra/Viper for CLI Framework

- **Cobra**: Hierarchical command structure, automatic help, flag parsing
- **Viper**: Configuration management (YAML, env vars, flags) with precedence

```go
// Config precedence: defaults < config file < env vars < flags
viper.SetDefault("wsl.distro", "kali-linux")
viper.BindEnv("wsl.distro", "SECWIN_WSL_DISTRO")
```

### 4.1.3 Tauri 2.0 + React 18 + TypeScript for GUI

| Layer | Technology | Purpose |
|-------|------------|---------|
| Backend | Rust + Tauri 2.0 | System integration, IPC, security |
| Frontend | React 18 + TypeScript | Component-based UI, type safety |
| Styling | Tailwind CSS | Utility-first, dark mode support |
| Build | Vite 5 | Fast HMR, optimized production builds |

Tauri's capability-based security model restricts IPC to explicitly declared commands.

### 4.1.4 Key Dependencies (go.mod)

```go
module github.com/secwin/secwin

go 1.22

require (
	github.com/spf13/cobra v1.8.1        // CLI framework
	github.com/spf13/viper v1.18.2       // Config
	github.com/tidwall/gjson v1.17.0     // JSON path queries
	github.com/tidwall/sjson v1.2.7      // JSON modification
	github.com/itchyny/gojq v0.12.16     // JQ for condition evaluation
	github.com/shirou/gopsutil/v3 v3.21.12 // System info
	gopkg.in/yaml.v3 v3.0.1              // YAML parsing
	github.com/atotto/clipboard v0.1.4   // Clipboard access
	golang.org/x/sys v0.19.0             // Windows syscalls
	github.com/creack/pty v1.1.21        // PTY for streaming
)
```

## 4.2 Core Modules

### 4.2.1 `internal/manifest` - Manifest Loading & Validation

```
internal/manifest/
├── types.go      # ToolManifest, InstallMethodEntry, Platform, Architecture
├── loader.go     # Embedded + local + remote loading, search, validation
└── validation.go # Schema validation, dependency resolution
```

**Key Features:**
- Embedded manifests via `//go:embed manifests/*.yaml`
- Local override at `~/.secwin/manifests/`
- Remote manifest index from GitHub releases
- Platform/architecture filtering with priority resolution
- Schema validation with detailed error messages

### 4.2.2 `internal/installer` - Plugin-Based Installer Registry

```
internal/installer/
├── installer.go  # Interface, Registry, helpers (download, extract, checksum, path)
├── scoop.go      # Scoop bucket management, shim generation
├── chocolatey.go # Chocolatey package installation
├── binary.go     # GitHub Releases API, auto-extract, checksum
├── github.go     # Git clone, tag checkout, build scripts
├── wsl.go        # APT install in WSL distro
└── script.go     # PowerShell execution with context
```

**Registry Pattern:**
```go
func init() {
    installer.Register(&ScoopInstaller{})
    installer.Register(&ChocolateyInstaller{})
    installer.Register(&BinaryInstaller{})
    installer.Register(&GitHubInstaller{})
    installer.Register(&WSLInstaller{})
    installer.Register(&ScriptInstaller{})
}
```

### 4.2.3 `internal/wsl` - WSL2 Integration

```go
type Manager struct {
    defaultDistro string
}

func (m *Manager) Exec(ctx context.Context, distro, cmd string, args ...string) (string, error)
func (m *Manager) InstallPackage(ctx context.Context, distro, pkg string) error
func (m *Manager) SyncFiles(ctx context.Context, src, dst string) error
func (m *Manager) SetupKali(ctx context.Context) error  // kali-linux-large + tools
```

### 4.2.4 `internal/playbook` - Playbook Engine

```
internal/playbook/
├── types.go      # Playbook, Step, Variable, Finding, ExecutionContext, control flow
├── executor.go   # Full executor with control flow, artifacts, findings, reporting
├── parser.go     # YAML parsing with variable substitution
├── controlflow.go # Parallel, foreach, if/else, try/catch implementation
└── artifacts.go  # Artifact collection, evidence registration
```

**Executor Flow:**
```
Execute(playbook)
  → Initialize ExecutionContext
  → For each step:
      → Resolve condition (gjson)
      → Template variables (sjson)
      → Execute step (goroutine for parallel)
      → Collect artifacts
      → Aggregate findings
      → Update StepResults
  → Generate reports
  → Return PlaybookResult
```

### 4.2.5 `internal/opsec` - OpSec Profile Management

```go
type Manager struct {
    profilesDir string
    stateDir    string
}

func (m *Manager) Engage(ctx context.Context, name string) error
func (m *Manager) Disengage(ctx context.Context) error
func (m *Manager) GetProfile(name string) (*Profile, error)
func (m *Manager) SaveState(profile string, state *ProfileState) error
func (m *Manager) LoadState(profile string) (*ProfileState, error)
```

**System Modifications (Windows):**
| Feature | Implementation |
|---------|----------------|
| VPN (WireGuard) | `wireguard.exe /installtunnelservice config.conf` |
| VPN (OpenVPN) | `openvpn --config file.ovpn --daemon` |
| MAC Spoof | `Set-NetAdapter -MacAddress "02:XX:XX:XX:XX:XX"` |
| Hostname | `Rename-Computer -NewName` (reboot required) |
| Timezone | `tzutil /s "Time Zone Name"` |
| DNS | `Set-DnsClientServerAddress -InterfaceAlias '*'` |
| Proxy | `[Environment]::SetEnvironmentVariable('HTTP_PROXY', ...)` |

### 4.2.6 `internal/ai` - Ollama Integration

```
internal/ai/
├── client.go     # HTTP client for Ollama API
├── triage.go     # TriageEngine with cache + rule fallback
└── prompts.go    # System prompts for classification
```

**Triage Pipeline:**
```
Finding → Cache Check → Ollama API → Parse JSON → Validate → Cache → Return
                ↓ (miss/error)
           Rule Engine → Keyword Match → Return Classification
```

### 4.2.7 `internal/evidence` - Evidence Locker

```go
type Locker struct {
    baseDir string
}

func (l *Locker) Register(srcPath, stepID string) (*Artifact, error)
func (l *Locker) Verify(dir string, strict bool) (*VerificationReport, error)
func (l *Locker) Export(dir, format string) ([]byte, error)
func (l *Locker) Manifest(dir string) (*ChainOfCustody, error)
```

### 4.2.8 `internal/report` - Report Generation

```go
type Generator struct {
    templates embed.FS
}

func (g *Generator) Generate(data ReportData, format string) ([]byte, error)
// Formats: markdown, html, pdf (via wkhtmltopdf)
```

## 4.3 Manifest Corpus

### 4.3.1 55 Tool Manifests Across 6 Categories

| Category | Count | Example Tools |
|----------|-------|---------------|
| **Reconnaissance** | 12 | nmap, masscan, subfinder, amass, theharvester, dnsx, httpx, naabu, rustscan, nuclei, recon-ng, spiderfoot |
| **Vulnerability** | 10 | nuclei, nikto, wapiti, openvas, zap, wpscan, sqlmap, xsstrike, commix, dalfox |
| **Exploitation** | 8 | metasploit, exploitdb, searchsploit, msfconsole, armitage, empire, sliver, covenant |
| **Post-Exploitation** | 11 | mimikatz, bloodhound, crackmapexec, impacket, secretsdump, donpapi, lsa, powerview, sharphound, certipy, pywhisker |
| **Utilities** | 8 | gobuster, ffuf, feroxbuster, dirsearch, jq, yq, fzf, ripgrep |
| **Wireless** | 6 | aircrack-ng, kismet, wifite, bettercap, hcxtools, hostapd-wpe |

### 4.3.2 Manifest Example (nmap)

```yaml
name: nmap
version: "7.95"
description: "Network exploration tool and security scanner"
category: recon
homepage: "https://nmap.org"
repository: "https://github.com/nmap/nmap"
license: "Nmap-Public-Source-License"
tags: [network, scanner, port, discovery]
aliases: [nmap]
install_methods:
  - method: scoop
    priority: 100
    platforms: [windows]
    architectures: [amd64, arm64]
    source: "nmap"
    version: "7.95"
  - method: chocolatey
    priority: 90
    platforms: [windows]
    architectures: [amd64, arm64]
    source: "nmap"
  - method: binary
    priority: 80
    platforms: [windows, linux, darwin]
    architectures: [amd64, arm64]
    source: "https://nmap.org/dist/nmap-7.95-win64.zip"
    checksum: "sha256:..."
    extract_path: "nmap-7.95"
    binary_name: "nmap.exe"
  - method: wsl
    priority: 70
    platforms: [windows]
    architectures: [amd64, arm64]
    source: "nmap"
    wsl_distro: "kali-linux"
  - method: script
    priority: 10
    platforms: [windows]
    script: |
      # Custom PowerShell install logic
post_install:
  commands: ["nmap --version"]
  verify_command: "nmap --version"
wsl_preferred: false
```

## 4.4 Playbook Library

### 4.4.1 Built-in Playbooks

**1. external-recon.yaml** (12 steps)
- Subdomain enumeration (subfinder, amass)
- DNS resolution (dnsx)
- HTTP probing (httpx)
- Port scanning (naabu, nmap)
- Technology detection (nuclei, whatweb)
- SSL/TLS analysis (testssl)
- Screenshot capture (gowitness)

**2. internal-ad-enum.yaml** (18 steps)
- Domain enumeration (ldap, dns)
- User/group enumeration (bloodhound, crackmapexec)
- GPO analysis
- Kerberos delegation
- ACL analysis (bloodhound)
- LAPS password reading
- Certificate template abuse (certipy)

**3. web-app-test.yaml** (15 steps)
- Spidering (feroxbuster, katana)
- Vulnerability scanning (nuclei, zap)
- SQL injection (sqlmap)
- XSS (xsstrike, dalfox)
- Authentication testing
- API enumeration
- Business logic tests

### 4.4.2 Control Flow Demonstrations

```yaml
# Parallel execution
- id: "parallel_probes"
  parallel:
    - id: "http"
      tool: "httpx"
    - id: "dns"
      tool: "dnsx"
    - id: "ssl"
      tool: "testssl"

# Foreach iteration
- id: "foreach_host"
  foreach:
    variable: "host"
    in: "{{.output_dir}}/hosts.txt"
    steps:
      - id: "vuln_scan"
        tool: "nuclei"
        args: ["-target", "{{.host}}"]

# Conditional branching
- id: "conditional_exploit"
  if:
    condition: "{{.step_results.vuln_scan.findings | len > 0}}"
    then:
      - id: "exploit"
        tool: "metasploit"
    else:
      - id: "skip"
        tool: "echo"
        args: ["No vulnerabilities to exploit"]

# Error handling
- id: "risky_step"
  try:
    - id: "exploit"
      tool: "exploit"
  catch:
    - id: "fallback"
      tool: "manual_review"
  finally:
    - id: "cleanup"
      tool: "cleanup"
```

## 4.5 GUI Components

### 4.5.1 Component Architecture

```
ui/src/
├── components/
│   ├── Dashboard.tsx         # System status, quick actions
│   ├── PlaybookRunner.tsx    # Playbook selection, variables, real-time output
│   ├── ProfileManager.tsx    # OpSec profiles, engage/disengage
│   ├── EvidenceViewer.tsx    # Evidence browser, verification, export
│   ├── FindingsDashboard.tsx # Findings table, AI triage, filtering
│   ├── Settings.tsx          # Config, tool management, paths
│   └── Layout.tsx            # Shell with navigation
├── hooks/
│   └── useSecWin.ts          # All API integrations
├── api/
│   └── tauri.ts              # Tauri IPC wrappers
└── types/
    └── index.ts              # TypeScript interfaces
```

### 4.5.2 Key Features

| Component | Features |
|-----------|----------|
| **Dashboard** | System health, WSL status, Ollama status, recent playbooks |
| **PlaybookRunner** | Variable form, real-time terminal output, step progress, abort |
| **ProfileManager** | Profile CRUD, engage/disengage buttons, status indicators |
| **EvidenceViewer** | Tree view, SHA256 verification, artifact details, export |
| **FindingsDashboard** | Sortable table, severity badges, AI triage batch, filter/sort |
| **Settings** | Config editor, tool install/manage, path configuration |

### 4.5.3 Real-Time Output Streaming

```typescript
// Frontend hook
const { run, running, output, abort } = useRunPlaybook();

// Tauri command (Rust)
#[command]
async fn run_playbook(playbook: Playbook, variables: HashMap<String, Value>) -> Result<PlaybookResult> {
    let (tx, mut rx) = mpsc::channel(100);
    let handle = tokio::spawn(async move {
        let result = executor.execute(playbook, variables).await;
        tx.send(result).await.ok();
    });
    // Stream events via Tauri events
    while let Some(event) = rx.recv().await {
        emit("playbook-output", event);
    }
}
```

## 4.6 CI/CD Pipeline

### 4.6.1 GitHub Actions Workflow

```yaml
# .github/workflows/build.yml
name: Build & Release
on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, ubuntu-latest]
        arch: [amd64, arm64]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - run: make build-all
      - uses: actions/upload-artifact@v4
        with: { name: secwin-${{ matrix.os }}-${{ matrix.arch }}, path: dist/ }

  scoop-publish:
    needs: build
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - run: make scoop-publish
```

### 4.6.2 Multi-Arch Builds

```makefile
# Makefile
build-all:
	GOOS=windows GOARCH=amd64 go build -o dist/secwin-windows-amd64.exe ./cmd/secwin
	GOOS=windows GOARCH=arm64 go build -o dist/secwin-windows-arm64.exe ./cmd/secwin
	GOOS=linux GOARCH=amd64 go build -o dist/secwin-linux-amd64 ./cmd/secwin
	GOOS=linux GOARCH=arm64 go build -o dist/secwin-linux-arm64 ./cmd/secwin

release:
	goreleaser release --clean
```

### 4.6.3 Scoop Bucket Publishing

```powershell
# bucket/secwin.json
{
  "version": "1.0.0",
  "description": "Modern Kali Linux tooling on Windows",
  "homepage": "https://github.com/secwin/secwin",
  "license": "MIT",
  "architecture": {
    "64bit": { "url": "https://github.com/secwin/secwin/releases/download/v1.0.0/secwin-windows-amd64.exe", "hash": "sha256:..." },
    "arm64": { "url": "https://github.com/secwin/secwin/releases/download/v1.0.0/secwin-windows-arm64.exe", "hash": "sha256:..." }
  },
  "bin": "secwin.exe",
  "checkver": "github",
  "autoupdate": { "architecture": { "64bit": { "url": "https://github.com/secwin/secwin/releases/download/v$version/secwin-windows-amd64.exe" } } }
}
```

## 4.7 Documentation Site (MkDocs Material)

```
docs/
├── index.md                 # Landing page
├── getting-started/
│   ├── installation.md
│   ├── quickstart.md
│   └── configuration.md
├── concepts/
│   ├── manifests.md
│   ├── playbooks.md
│   ├── opsec.md
│   └── evidence.md
├── cli-reference/
│   ├── install.md
│   ├── run.md
│   ├── playbook.md
│   ├── profile.md
│   ├── evidence.md
│   ├── ai.md
│   └── benchmark.md
├── gui-guide/
│   ├── dashboard.md
│   ├── playbook-runner.md
│   └── findings.md
└── development/
    ├── contributing.md
    ├── architecture.md
    └── manifest-authoring.md
```

**mkdocs.yml:**
```yaml
site_name: SecWin Documentation
theme:
  name: material
  palette:
    - scheme: default
      primary: indigo
    - scheme: slate
      primary: indigo
nav:
  - Home: index.md
  - Getting Started: getting-started/
  - Concepts: concepts/
  - CLI Reference: cli-reference/
  - GUI Guide: gui-guide/
  - Development: development/
```
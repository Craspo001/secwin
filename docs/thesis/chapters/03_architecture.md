# Chapter 3: Architecture and Implementation

## 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SecWin Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   CLI    │  │   GUI    │  │  REST    │  │  Plugins │        │
│  │ (Cobra)  │  │ (Tauri)  │  │  (Future)│  │          │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       └─────────────┼─────────────┼─────────────┘               │
│                     ▼                                           │
│         ┌─────────────────────┐                                 │
│         │   Core Engine       │                                 │
│         │  (Go/Rust Shared)   │                                 │
│         └──────────┬──────────┘                                 │
│                    │                                            │
│       ┌───────────┼───────────┐                                 │
│       ▼           ▼           ▼                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                            │
│  │Manifest │ │Installer│ │  WSL    │                            │
│  │ Loader  │ │Registry │ │ Bridge  │                            │
│  └────┬────┘ └────┬────┘ └────┬────┘                            │
│       │           │           │                                 │
│       ▼           ▼           ▼                                 │
│  ┌─────────────────────────────────┐                            │
│  │       Playbook Engine           │                            │
│  │  (Executor, Variables, Hooks)   │                            │
│  └──────────────┬──────────────────┘                            │
│                 │                                                │
│       ┌─────────┼─────────┐                                     │
│       ▼         ▼         ▼                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐                               │
│  │ OpSec  │ │Evidence│ │ Report  │                               │
│  │ Manager│ │ Locker │ │ Generator│                              │
│  └────────┘ └────────┘ └────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 Core Components

### 3.2.1 Manifest System

**Location**: `internal/manifest/`

**Purpose**: Declarative tool definitions supporting multiple installation methods per platform/architecture.

```yaml
# Example: nmap.yaml
name: nmap
description: "Network exploration tool and security/port scanner"
category: recon
website: "https://nmap.org"
repository: "https://github.com/nmap/nmap"
license: "GPL-2.0"
install_methods:
  - platform: windows
    arch: amd64
    method: scoop
    package: nmap
  - platform: windows
    arch: amd64
    method: chocolatey
    package: nmap
  - platform: windows
    arch: amd64
    method: binary
    url: "https://nmap.org/dist/nmap-{{.Version}}-win64.zip"
    binary: "nmap.exe"
    version_cmd: "nmap --version"
  - platform: linux
    arch: amd64
    method: apt
    package: nmap
    distro: kali-linux
  - platform: linux
    arch: amd64
    method: binary
    url: "https://github.com/nmap/nmap/releases/download/{{.Version}}/nmap-{{.Version}}-linux.x86_64.tar.gz"
    binary: "nmap"
WSLPreferred: true
```

**Key Features**:
- Platform/architecture matrix (Windows AMD64/ARM64, Linux AMD64/ARM64)
- Multiple installation methods with priority fallback
- Version detection via command output parsing
- WSL preference flag for Linux-native tools
- Embedded manifests (50+) + remote manifest repository support

### 3.2.2 Installer Registry

**Location**: `internal/installer/`

**Pattern**: Strategy pattern with interface:

```go
type Installer interface {
    Install(ctx context.Context, tool *manifest.Tool, method *manifest.InstallMethod) error
    IsInstalled(tool *manifest.Tool, method *manifest.InstallMethod) (bool, error)
    GetVersion(tool *manifest.Tool, method *manifest.InstallMethod) (string, error)
}
```

**Implementations**:
| Installer | Method | Description |
|-----------|--------|-------------|
| `ScoopInstaller` | `scoop` | User-space Windows packages |
| `ChocolateyInstaller` | `chocolatey` | System-wide Windows packages |
| `WSLInstaller` | `wsl` | APT/pacman in WSL distro |
| `BinaryInstaller` | `binary` | Direct download + extract |
| `GitHubInstaller` | `github` | GitHub Releases API |
| `ScriptInstaller` | `script` | Custom install scripts |

**Features**:
- Parallel installation with semaphore limiting
- Checksum verification (SHA256)
- Atomic installs (staging directory → final location)
- Rollback on failure
- Progress reporting via callbacks

### 3.2.3 WSL Bridge

**Location**: `internal/wsl/`

**Capabilities**:
- Distribution detection and health checking
- Path translation: `C:\Users\...` ↔ `/mnt/c/Users/...`
- Command execution with environment propagation
- Drive mounting configuration
- Default distro management (Kali Linux primary)

```go
type Manager interface {
    IsWSLAvailable(ctx context.Context) bool
    GetDefaultDistro() string
    RunCommand(ctx context.Context, distro, command string) error
    TranslatePath(windowsPath string) string
    TranslatePathWSL(wslPath string) string
}
```

**Path Translation Algorithm**:
1. Detect drive letter (`C:` → `/mnt/c`)
2. Normalize separators (`\` → `/`)
3. Handle UNC paths (`\\wsl$\kali-linux\...`)
4. Preserve case sensitivity where needed

### 3.2.4 Playbook Engine

**Location**: `internal/playbook/`

**DSL Features**:
- **Variables**: Typed (string, int, bool, list), validation (regex, enum), secrets
- **Control Flow**: `parallel`, `foreach`, `if/else`, `try/catch/finally`
- **Templating**: `{{.variable}}` substitution in args, env, paths
- **Artifacts**: Glob patterns for automatic evidence collection
- **MITRE Mapping**: Tactics (playbook) + Techniques (steps)
- **Hooks**: Pre/post step, on success/failure
- **Outputs**: Findings file, report path, evidence dir, formats

**Execution Model**:
```go
type Executor struct {
    playbook     *Playbook
    variables    map[string]interface{}
    artifacts    map[string]Artifact
    stepResults  map[string]StepResult
    findings     []Finding
    hooks        Hooks
}
```

**Control Flow Semantics**:
- `parallel`: Concurrent execution, fail-fast on error
- `foreach`: Variable scoping per iteration, index/item available
- `if/else`: Condition evaluation via gjson (JSON path + boolean)
- `try/catch/finally`: Error handling with guaranteed cleanup

### 3.2.5 OpSec Manager

**Location**: `internal/opsec/`

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

**Operations**:
1. **Engage**: Apply profile settings in order (VPN → MAC → Hostname → Timezone → DNS → Proxy)
2. **Disengage**: Reverse order restoration with best-effort cleanup
3. **Status**: Current system state snapshot
4. **Persistence**: State file for crash recovery

**Windows APIs Used**:
- `Rename-Computer` (hostname, requires reboot)
- `tzutil` (timezone)
- `Set-NetAdapter -MacAddress` (MAC spoofing)
- `Set-DnsClientServerAddress` (DNS)
- `[Environment]::SetEnvironmentVariable` (Proxy)
- `wireguard` / `openvpn` (VPN)

### 3.2.6 Evidence Locker

**Location**: `internal/evidence/` (integrated in playbook executor)

**Artifact Lifecycle**:
1. **Collection**: Glob patterns from step definitions
2. **Hashing**: SHA256 computation (streaming for large files)
3. **Storage**: Indexed copy to evidence directory (`001_step_file.ext`)
4. **Manifest**: Companion `.sha256` files + JSON manifest
5. **Verification**: Re-compute and compare

**Data Structures**:
```go
type EvidenceArtifact struct {
    Name      string
    Path      string
    SHA256    string
    Size      int64
    StepID    string
    Timestamp time.Time
}

type EvidenceManifest struct {
    GeneratedAt string
    EvidenceDir string
    Artifacts   []EvidenceArtifact
}
```

### 3.2.7 Report Generator

**Location**: `internal/playbook/executor.go` (embedded templates)

**Templates** (Go 1.22 `//go:embed`):
- `report.html.tmpl`: Responsive, print-friendly, MITRE badges, severity colors
- `report.md.tmpl`: Clean Markdown for version control

**Template Functions**:
```go
FuncMap{
    "lower":    strings.ToLower,
    "truncate": func(s string, n int) string { ... },
    "hasPrefix": strings.HasPrefix,
}
```

**Output Formats**:
- Markdown (`.md`): Lightweight, diffable
- HTML (`.html`): Styled, printable, self-contained
- PDF (`.pdf`): Via headless Chrome/wkhtmltopdf (future)

## 3.3 CLI Design

**Framework**: Cobra (v1.8)

**Command Structure**:
```
secwin
├── install <tool>[@group]     # Tool installation
├── run <tool> [args...]       # Direct tool execution
├── playbook
│   ├── run <file>             # Execute playbook
│   ├── validate <file>        # Validate syntax
│   └── list                   # List built-in playbooks
├── wsl
│   ├── run <command>          # Execute in WSL
│   ├── translate <path>       # Path translation
│   └── status                 # WSL health
├── profile
│   ├── create <name>          # Create OpSec profile
│   ├── engage <name>          # Apply profile
│   ├── disengage              # Restore defaults
│   ├── status                 # Current OpSec state
│   └── list/show/delete
├── evidence
│   ├── verify [path]          # SHA256 verification
│   ├── list [path]            # List artifacts
│   ├── show <artifact>        # Artifact details
│   └── export                 # Manifest export
├── list                       # List installed tools
├── search <query>             # Search manifests
├── update                     # Update manifests/tools
├── config                     # Configuration management
└── manifest                   # Manifest operations
```

**Global Flags**:
- `--tool-dir`, `--bin-dir`, `--config-dir`
- `--wsl-distro`, `--no-wsl`
- `--json`, `--yaml` (output format)
- `--verbose`, `--quiet`

## 3.4 Configuration

**File**: `~/.secwin/config.yaml` (Viper)

```yaml
first_run: false
tool_dir: "C:\\Users\\user\\.secwin\\tools"
bin_dir: "C:\\Users\\user\\.secwin\\bin"
manifest_dirs: ["manifests"]
wsl:
  default_distro: "kali-linux"
  environment: {}
  mount_drives: ["C", "D"]
network:
  default_interface: ""
  proxy_url: ""
  no_proxy: "localhost,127.0.0.1,::1"
profiles: {}
active_profile: ""
reporting:
  default_template: "default"
  output_formats: ["markdown", "html", "pdf"]
  evidence_retention_days: 90
```

## 3.5 Security Considerations

1. **No Elevated Privileges**: Default user-space operation
2. **Checksum Verification**: All downloads verified
3. **Path Sanitization**: Template injection prevention
4. **Secret Handling**: Variable `secret: true` prevents logging
5. **State Encryption**: OpSec state files (future: age/GPG)
6. **Supply Chain**: Pinned dependencies, reproducible builds
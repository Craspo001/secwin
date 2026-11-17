# Manifest Guide

Tool manifests define how SecWin installs, runs, and manages security tools. Each tool gets a YAML file in `manifests/`.

## Manifest Schema

```yaml
name: string                    # Required: unique tool identifier
version: string                 # Required: tool version
description: string             # Required: human-readable description
category: string                # Required: categorization (recon, exploitation, post-exploit, etc.)
homepage: string                # Optional: project homepage
repository: string              # Optional: source repository
license: string                 # Optional: SPDX license identifier
tags: [string]                  # Optional: searchable tags
aliases: [string]               # Optional: alternative names
install_methods: [...]          # Required: ordered list of install methods
dependencies: [string]          # Optional: tool names this depends on
conflicts: [string]             # Optional: tools that conflict
provides: [string]              # Optional: virtual capabilities provided
post_install: {...}             # Optional: post-install actions
environment: {...}              # Optional: env vars to set
wsl_preferred: boolean          # Optional: prefer WSL for this tool
wsl_distro: string              # Optional: specific WSL distro
checksums: {...}                # Optional: SHA256 for downloads
min_version: string             # Optional: minimum supported version
max_version: string             # Optional: maximum supported version
deprecated: boolean             # Optional: mark as deprecated
replacement: string             # Optional: replacement tool name
maintainers: [string]           # Optional: maintainer handles
```

## Install Methods

### 1. Scoop (`scoop`)

Best for: Windows-native tools in Scoop buckets

```yaml
install_methods:
  - method: scoop
    priority: 100
    platforms: [windows]
    architectures: [amd64, arm64]
    source: "nmap"                    # Scoop package name
    version: "7.94"                   # Optional: specific version
    pre_commands: []                  # Optional: commands before install
    post_commands: []                 # Optional: commands after install
```

### 2. Chocolatey (`chocolatey`)

Best for: Windows tools in Chocolatey community repo

```yaml
install_methods:
  - method: chocolatey
    priority: 90
    platforms: [windows]
    architectures: [amd64, arm64]
    source: "nmap"                    # Chocolatey package ID
    version: "7.94"                   # Optional
    args: ["--params", "'/NoDesktopIcon'"]  # Optional choco args
```

### 3. WSL (`wsl`)

Best for: Linux-only tools, tools with better Linux support

```yaml
install_methods:
  - method: wsl
    priority: 80
    platforms: [windows]
    architectures: [amd64, arm64]
    source: "kali-linux"              # WSL distro name
    version: "7.94"                   # Package version in distro
    args: ["-y"]                      # Optional apt args
wsl_preferred: true
wsl_distro: "kali-linux"
```

### 4. Binary (`binary`)

Best for: GitHub releases, direct downloads

```yaml
install_methods:
  - method: binary
    priority: 100
    platforms: [windows, linux, darwin]
    architectures: [amd64, arm64]
    source: "https://github.com/project/release/download/v1.0/tool_windows_amd64.zip"
    binary_name: "tool.exe"           # Executable name in archive
    extract_path: "tool_1.0"          # Subdirectory in archive
    checksum: "sha256:abc123..."      # SHA256 of download
    pre_commands: []                  # Optional
    post_commands: []                 # Optional
```

### 5. GitHub (`github`)

Best for: Tools built from source, private repos

```yaml
install_methods:
  - method: github
    priority: 90
    platforms: [windows, linux, darwin]
    architectures: [amd64, arm64]
    source: "owner/repo"              # GitHub repo
    version: "v1.0.0"                 # Tag/branch/commit
    extract_path: "build/output"      # Path to binary after clone
    binary_name: "tool.exe"
    pre_commands: ["go build -o tool.exe ./cmd/tool"]
    post_commands: []
```

### 6. Script (`script`)

Best for: Complex installs, custom logic

```yaml
install_methods:
  - method: script
    priority: 50
    platforms: [windows]
    architectures: [amd64]
    script: |
      # PowerShell script content
      $url = "https://example.com/tool.zip"
      Invoke-WebRequest -Uri $url -OutFile "tool.zip"
      Expand-Archive -Path "tool.zip" -DestinationPath "$env:TOOL_DIR"
      Copy-Item "$env:TOOL_DIR\tool.exe" "$env:BIN_DIR\tool.exe"
    env:
      CUSTOM_VAR: "value"
```

## Priority Resolution

Install methods are tried in **priority order** (highest first). SecWin selects the first method that:

1. Matches current platform/architecture
2. Has available installer (Scoop/Choco/WSL installed)
3. Passes any `condition` expression

## Platform/Architecture Filtering

```yaml
platforms: [windows, linux, darwin, all]      # Default: all
architectures: [amd64, arm64, 386, all]       # Default: all
```

## Condition Expressions

```yaml
condition: "{{.config.wsl.enabled}} && {{.tool.wsl_preferred}}"
```

Available variables:
- `.config.*` — SecWin config
- `.tool.*` — Tool manifest fields
- `.env.*` — Environment variables

## Post-Install Specification

```yaml
post_install:
  commands:
    - "tool --init"
    - "tool update-db"
  environment:
    TOOL_HOME: "{{.tool_dir}}"
  path_additions:
    - "{{.tool_dir}}/bin"
  verify_command: "tool --version"
```

## Checksums

```yaml
checksums:
  "tool_windows_amd64.zip": "sha256:abc123..."
  "tool_linux_amd64.tar.gz": "sha256:def456..."
```

Can also be specified per-install-method via `checksum` field.

## Complete Examples

### Simple Windows Tool (Scoop + Binary Fallback)

```yaml
name: nmap
version: "7.94"
description: "Network exploration tool and security/port scanner"
category: recon
homepage: "https://nmap.org"
license: "GPL-2.0"
tags: ["port-scanner", "network-discovery"]
install_methods:
  - method: scoop
    priority: 100
    source: "nmap"
  - method: binary
    priority: 90
    platforms: [windows]
    architectures: [amd64]
    source: "https://nmap.org/dist/nmap-7.94-win64.zip"
    binary_name: "nmap.exe"
    extract_path: "nmap-7.94"
    checksum: "sha256:..."
post_install:
  verify_command: "nmap --version"
```

### Linux-Preferred Tool (WSL Primary)

```yaml
name: bloodhound
version: "6.0.0"
description: "Active Directory graph analysis"
category: post-exploit
homepage: "https://github.com/BloodHoundAD/BloodHound"
license: "GPL-3.0"
tags: ["ad", "graph", "privilege-escalation"]
wsl_preferred: true
wsl_distro: "kali-linux"
install_methods:
  - method: wsl
    priority: 100
    source: "kali-linux"
    version: "6.0.0"
  - method: binary
    priority: 80
    platforms: [windows, linux]
    architectures: [amd64]
    source: "https://github.com/BloodHoundAD/BloodHound/releases/download/6.0.0/BloodHound-linux-x64.zip"
    binary_name: "BloodHound"
    extract_path: "BloodHound-linux-x64"
```

### Go-Based Tool (GitHub + Binary)

```yaml
name: nuclei
version: "3.2.0"
description: "Fast vulnerability scanner"
category: vuln-scanning
homepage: "https://nuclei.projectdiscovery.io"
license: "MIT"
tags: ["vulnerability-scanner", "cve"]
install_methods:
  - method: binary
    priority: 100
    platforms: [windows, linux, darwin]
    architectures: [amd64, arm64]
    source: "https://github.com/projectdiscovery/nuclei/releases/download/v3.2.0/nuclei_3.2.0_windows_amd64.zip"
    binary_name: "nuclei.exe"
    checksum: "sha256:..."
  - method: github
    priority: 90
    platforms: [windows, linux, darwin]
    architectures: [amd64, arm64]
    source: "projectdiscovery/nuclei"
    version: "v3.2.0"
    extract_path: "nuclei_3.2.0_windows_amd64"
    binary_name: "nuclei.exe"
post_install:
  commands:
    - "nuclei -update-templates"
  verify_command: "nuclei -version"
```

### Python Tool (GitHub + Pip)

```yaml
name: sqlmap
version: "1.7.1"
description: "Automatic SQL injection tool"
category: exploitation
homepage: "https://sqlmap.org"
license: "GPL-2.0"
tags: ["sql-injection", "database"]
wsl_preferred: true
install_methods:
  - method: github
    priority: 100
    platforms: [windows, linux, darwin]
    architectures: [amd64, arm64]
    source: "sqlmapproject/sqlmap"
    version: "1.7.1"
    extract_path: "sqlmap-1.7.1"
    binary_name: "sqlmap.py"
    pre_commands:
      - "pip install -r requirements.txt"
  - method: wsl
    priority: 90
    source: "kali-linux"
```

## Local Overrides

Create `~/.secwin/manifests/<tool>.yaml` to override embedded manifests without forking.

## Remote Manifest Bucket

Configure in `config.yaml`:

```yaml
manifest_dirs:
  - "manifests"
  - "~/.secwin/manifests"
  - "https://github.com/secwin/manifest-bucket/raw/main"
```

## Validation

```bash
secwin manifest validate              # Validate all
secwin manifest validate manifests/   # Validate directory
secwin manifest validate tool.yaml    # Validate single file
```

## Best Practices

1. **Always provide checksums** for binary downloads
2. **Order methods by reliability**: Scoop/Choco > Binary > GitHub > Script
3. **Set `wsl_preferred: true`** for Linux-native tools
4. **Use semantic versioning** in `version` field
5. **Include `verify_command`** for post-install validation
6. **Tag thoroughly** for discoverability
7. **Keep `post_install.commands` minimal** — prefer upstream packages
8. **Test on clean Windows** before committing
# SecWin CLI API Reference

## Global Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--config` | `-c` | Config file path |
| `--json` | `-j` | Output JSON |
| `--quiet` | `-q` | Suppress non-error output |
| `--verbose` | `-v` | Verbose output |
| `--help` | `-h` | Show help |

## Commands

### `secwin install`

Install a security tool.

```bash
secwin install <tool> [flags]
```

**Flags**:
| Flag | Description |
|------|-------------|
| `--method` | Force installation method |
| `--version` | Specific version to install |
| `--force` | Reinstall if already present |

**Examples**:
```bash
secwin install nuclei
secwin install nmap --method chocolatey
secwin install nuclei --version v3.3.0
```

---

### `secwin update`

Update tools and manifests.

```bash
secwin update [flags]
```

**Flags**:
| Flag | Description |
|------|-------------|
| `--tools` | Update installed tools |
| `--manifests` | Update manifest repository |
| `--all` | Update everything |

**Examples**:
```bash
secwin update --all
secwin update --tools
```

---

### `secwin list`

List installed tools or available manifests.

```bash
secwin list [tools|manifests] [flags]
```

**Flags**:
| Flag | Description |
|------|-------------|
| `--installed` | Show only installed tools |
| `--category` | Filter by category |
| `--json` | JSON output |

**Examples**:
```bash
secwin list tools
secwin list manifests --category vulnerability-scanning
secwin list tools --installed --json
```

---

### `secwin search`

Search for tools in manifests.

```bash
secwin search <query> [flags]
```

**Flags**:
| Flag | Description |
|------|-------------|
| `--tag` | Filter by tag |
| `--category` | Filter by category |

**Examples**:
```bash
secwin search nmap
secwin search "web scanner" --category web
```

---

### `secwin run`

Execute a tool ad-hoc.

```bash
secwin run <tool> [args...] [flags]
```

**Flags**:
| Flag | Description |
|------|-------------|
| `--wsl` | Force WSL execution |
| `--native` | Force native execution |
| `--env` | Environment variables (KEY=VALUE) |

**Examples**:
```bash
secwin run nmap -sS 192.168.1.0/24
secwin run nuclei -t cves/ -u https://example.com
secwin run httpx -l urls.txt --wsl
```

---

### `secwin playbook`

Playbook management and execution.

```bash
secwin playbook <subcommand> [flags]
```

#### `secwin playbook list`

List available playbooks.

```bash
secwin playbook list [flags]
```

#### `secwin playbook show`

Show playbook details.

```bash
secwin playbook show <playbook> [flags]
```

#### `secwin playbook run`

Execute a playbook.

```bash
secwin playbook run <playbook> [flags]
```

**Flags**:
| Flag | Short | Description |
|------|-------|-------------|
| `--set` | `-s` | Set variable (KEY=VALUE) |
| `--format` | `-f` | Output format (markdown, html, pdf) |
| `--output` | `-o` | Output file path |
| `--evidence-dir` | | Custom evidence directory |
| `--dry-run` | | Validate without executing |

**Examples**:
```bash
secwin playbook run external-recon --set target=example.com
secwin playbook run internal-ad --set domain=corp.local --format html,pdf
secwin playbook run web-app-test --set target=https://app.example.com --output report.html
```

#### `secwin playbook validate`

Validate a playbook file.

```bash
secwin playbook validate <file> [flags]
```

---

### `secwin profile`

OpSec profile management.

```bash
secwin profile <subcommand> [flags]
```

#### `secwin profile create`

Create a new OpSec profile.

```bash
secwin profile create <name> [flags]
```

**Flags**:
| Flag | Description |
|------|-------------|
| `--vpn` | VPN config file path |
| `--mac-spoof` | Enable MAC spoofing |
| `--hostname` | Custom hostname |
| `--timezone` | Custom timezone |
| `--dns` | DNS servers (comma-separated) |
| `--proxy` | Proxy URL |

**Examples**:
```bash
secwin profile create red-team --vpn ~/vpn/redteam.conf --mac-spoof --hostname DESKTOP-ABC --timezone America/New_York --dns "1.1.1.1,8.8.8.8" --proxy http://127.0.0.1:8080
```

#### `secwin profile list`

List all profiles.

```bash
secwin profile list
```

#### `secwin profile engage`

Activate an OpSec profile.

```bash
secwin profile engage <name>
```

#### `secwin profile disengage`

Deactivate current profile and restore settings.

```bash
secwin profile disengage
```

#### `secwin profile status`

Show current OpSec status and active profile.

```bash
secwin profile status
```

#### `secwin profile show`

Show profile configuration.

```bash
secwin profile show <name>
```

#### `secwin profile delete`

Delete a profile.

```bash
secwin profile delete <name>
```

---

### `secwin evidence`

Evidence locker operations.

```bash
secwin evidence <subcommand> [flags]
```

#### `secwin evidence verify`

Verify evidence integrity via SHA256.

```bash
secwin evidence verify [path] [flags]
```

**Flags**:
| Flag | Short | Description |
|------|-------|-------------|
| `--dir` | `-d` | Evidence directory |
| `--manifest` | `-m` | Manifest file to verify against |
| `--strict` | | Fail on missing checksums |

**Examples**:
```bash
secwin evidence verify
secwin evidence verify ~/evidence --strict
```

#### `secwin evidence list`

List evidence artifacts.

```bash
secwin evidence list [path] [flags]
```

**Flags**:
| Flag | Short | Description |
|------|-------|-------------|
| `--dir` | `-d` | Evidence directory |

#### `secwin evidence show`

Show artifact details with SHA256.

```bash
secwin evidence show <artifact> [flags]
```

**Flags**:
| Flag | Short | Description |
|------|-------|-------------|
| `--dir` | `-d` | Evidence directory |

#### `secwin evidence export`

Export evidence manifest.

```bash
secwin evidence export [flags]
```

**Flags**:
| Flag | Short | Description |
|------|-------|-------------|
| `--dir` | `-d` | Evidence directory |
| `--output` | `-o` | Output manifest file |
| `--format` | `-f` | Output format (json, yaml) |

**Examples**:
```bash
secwin evidence export --output manifest.json
secwin evidence export --format yaml --output manifest.yaml
```

---

### `secwin config`

Configuration management.

```bash
secwin config <subcommand> [flags]
```

#### `secwin config show`

Show current configuration.

```bash
secwin config show
```

#### `secwin config set`

Set a configuration value.

```bash
secwin config set <key> <value>
```

#### `secwin config get`

Get a configuration value.

```bash
secwin config get <key>
```

#### `secwin config reset`

Reset to defaults.

```bash
secwin config reset
```

---

### `secwin wsl`

WSL management.

```bash
secwin wsl <subcommand> [flags]
```

#### `secwin wsl list`

List available WSL distributions.

```bash
secwin wsl list
```

#### `secwin wsl install`

Install a WSL distribution.

```bash
secwin wsl install <distro>
```

#### `secwin wsl set-default`

Set default WSL distribution.

```bash
secwin wsl set-default <distro>
```

#### `secwin wsl run`

Run command in WSL.

```bash
secwin wsl run <command> [args...]
```

---

### `secwin manifest`

Manifest management.

```bash
secwin manifest <subcommand> [flags]
```

#### `secwin manifest validate`

Validate a manifest file.

```bash
secwin manifest validate <file>
```

#### `secwin manifest generate`

Generate manifest template.

```bash
secwin manifest generate <name> [flags]
```

---

### `secwin ai`

AI-assisted operations (requires Ollama).

```bash
secwin ai <subcommand> [flags]
```

#### `secwin ai triage`

Triage findings with AI.

```bash
secwin ai triage [flags]
```

**Flags**:
| Flag | Short | Description |
|------|-------|-------------|
| `--findings` | `-f` | Findings JSON file |
| `--report` | `-r` | Report JSON file |
| `--context` | `-c` | Engagement context |
| `--model` | `-m` | Ollama model to use |
| `--output` | `-o` | Output file |

**Examples**:
```bash
secwin ai triage --findings findings.json --context "PCI-DSS external"
secwin ai triage --report report.json --model llama3.1:70b --output triage.json
```

#### `secwin ai summarize`

Generate executive summary.

```bash
secwin ai summarize [flags]
```

**Flags**:
| Flag | Short | Description |
|------|-------|-------------|
| `--report` | `-r` | Report JSON file |
| `--format` | | Output format (markdown, json) |
| `--output` | `-o` | Output file |

#### `secwin ai suggest-mitre`

Suggest MITRE techniques for a finding.

```bash
secwin ai suggest-mitre [flags]
```

**Flags**:
| Flag | Short | Description |
|------|-------|-------------|
| `--description` | `-d` | Finding description |
| `--evidence` | `-e` | Evidence JSON file |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Tool not found |
| 4 | Installation failed |
| 5 | Playbook validation failed |
| 6 | Playbook execution failed |
| 7 | OpSec operation failed |
| 8 | Evidence verification failed |
| 9 | AI operation failed |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECWIN_CONFIG_DIR` | Config directory | `~/.secwin` |
| `SECWIN_TOOL_DIR` | Tool installation directory | `~/.secwin/tools` |
| `SECWIN_BIN_DIR` | Binary directory | `~/.secwin/bin` |
| `SECWIN_MANIFEST_DIRS` | Manifest directories (colon-separated) | `manifests` |
| `SECWIN_WSL_DISTRO` | Default WSL distro | `kali-linux` |
| `SECWIN_OLLAMA_URL` | Ollama API URL | `http://localhost:11434` |
| `SECWIN_OLLAMA_MODEL` | Default Ollama model | `llama3.1:8b` |
| `SECWIN_LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |

## JSON Output Schema

### Tool List

```json
[
  {
    "name": "nuclei",
    "version": "3.3.2",
    "installed": true,
    "install_method": "github_release",
    "path": "/home/user/.secwin/bin/nuclei",
    "manifest": { ... }
  }
]
```

### Playbook Run Result

```json
{
  "success": true,
  "playbook": "external-recon",
  "duration_ms": 45230,
  "report_path": "/home/user/report.html",
  "evidence_dir": "/home/user/.secwin/evidence/20261117_103000",
  "findings": [
    {
      "id": "finding-1",
      "title": "Open Port 22",
      "description": "SSH service exposed",
      "severity": "Medium",
      "mitre_techniques": ["T1021.004"],
      "step_id": "port-scan"
    }
  ],
  "artifacts": {
    "nmap.xml": "/home/user/.secwin/evidence/001_recon_nmap.xml"
  }
}
```

### Evidence Verification

```json
{
  "verified": 15,
  "failed": 0,
  "missing_checksum": 2,
  "results": [
    {
      "name": "nmap.xml",
      "status": "verified",
      "sha256": "a1b2c3...",
      "expected": "a1b2c3..."
    }
  ]
}
```

### AI Triage Result

```json
[
  {
    "finding_id": "finding-1",
    "summary": "SSH service exposed on port 22 allows remote access...",
    "severity_assessment": "Medium - SSH with key auth reduces risk but exposure increases attack surface",
    "recommended_actions": [
      "Restrict SSH to management network",
      "Enforce key-based authentication",
      "Enable fail2ban"
    ],
    "mitre_mapping": [
      {
        "technique_id": "T1021.004",
        "technique_name": "Pass the Hash",
        "tactic": "Lateral Movement",
        "confidence": 0.85
      }
    ],
    "confidence": 0.88
  }
]
```
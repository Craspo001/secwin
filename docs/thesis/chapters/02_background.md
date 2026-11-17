# Chapter 2: Background and Related Work

## 2.1 Security Tooling Landscape on Windows

### 2.1.1 Package Managers

| Manager | Strengths | Weaknesses |
|---------|-----------|------------|
| **Scoop** | User-space, portable, good Windows support | Limited security tool coverage |
| **Chocolatey** | Large package repo, enterprise features | System-wide, requires admin, slower |
| **Winget** | Native Windows 10/11, Microsoft backed | Newer, fewer security packages |
| **WSL/APT** | Access to Kali/Ubuntu repos, latest versions | Path translation, distro management overhead |
| **Manual/GitHub** | Latest versions, custom builds | No updates, dependency hell |

### 2.1.2 Existing Frameworks

| Framework | Approach | Limitations |
|-----------|----------|-------------|
| **Kali Linux** | Full distro | Heavy, not Windows-native |
| **WSL-Kali** | WSL distro | Manual tool management |
| **Docker/K8s** | Containerized | Network complexity, GUI tools hard |
| **Ansible/Terraform** | IaC | Not designed for interactive pentesting |
| **Cobalt Strike/Metasploit** | C2 frameworks | Proprietary, post-exploitation focus |
| **BloodHound/SharpHound** | AD enumeration | Single-purpose |

## 2.2 Workflow Orchestration

### 2.2.1 Current Practices

1. **Ad-hoc Commands**: Copy-paste from notes, shell history, team wikis
2. **Shell Scripts**: Bash/PowerShell scripts per engagement
3. **Jupyter Notebooks**: Documentation + execution, but not reproducible
4. **Custom Python/Go Tools**: Project-specific, high maintenance

### 2.2.2 Desired Properties

- **Declarative**: Define *what*, not *how*
- **Version Controlled**: Git-trackable engagement definitions
- **Reproducible**: Same input → same output
- **Extensible**: Easy to add tools and patterns
- **Auditable**: Clear execution trail for compliance

## 2.3 Operational Security

### 2.3.1 Engagement Isolation Requirements

| Layer | Configuration | Reversibility |
|-------|---------------|---------------|
| Network | VPN (WireGuard/OpenVPN) | Disconnect |
| Link | MAC address spoofing | Restore original |
| Host | Hostname change | Restore (reboot) |
| Time | Timezone alignment | Restore |
| DNS | Custom resolvers | Restore |
| Application | Proxy (HTTP/HTTPS) | Clear env vars |

### 2.3.2 Existing Solutions

- **Manual**: `netsh`, `powershell`, `tzutil` commands
- **Scripts**: Custom PowerShell/Bash per engagement
- **VPN Clients**: GUI-based, no automation
- **No integrated solution** exists for full stack

## 2.4 Reporting and Evidence Management

### 2.4.1 Current Pain Points

- Screenshots scattered across filesystem
- Manual hash verification (or skipped entirely)
- Report templates in Word/Markdown, inconsistent formatting
- No standardized evidence locker structure
- MITRE ATT&CK mapping done manually

### 2.4.2 Standards and Frameworks

- **MITRE ATT&CK**: Tactics, techniques, procedures
- **NIST SP 800-115**: Technical guide for security testing
- **PTES**: Penetration Testing Execution Standard
- **OSSTMM**: Open Source Security Testing Methodology Manual

## 2.5 GUI Frameworks for Security Tools

| Framework | Language | Pros | Cons |
|-----------|----------|------|------|
| **Electron** | JS/TS | Mature, huge ecosystem | Heavy, memory hungry |
| **Tauri** | Rust + Web | Lightweight, secure, native | Newer, smaller ecosystem |
| **Wails** | Go + Web | Go backend, similar to Tauri | Less mature |
| **Flutter** | Dart | Cross-platform, performant | Not web-tech, learning curve |
| **Native (WinUI/QT)** | C++/Rust | Best performance | High development cost |

**Decision**: Tauri chosen for Rust backend compatibility, small binary size, and web frontend familiarity.

## 2.6 AI in Security Operations

### 2.6.1 Current Applications

- **Vulnerability Prioritization**: CVSS enrichment, exploit availability
- **Log Analysis**: Anomaly detection, pattern matching
- **Report Generation**: Template filling, executive summaries
- **Code Analysis**: SAST/DAST enhancement

### 2.6.2 Local LLM Landscape (2024)

| Model | Size | Use Case |
|-------|------|----------|
| Llama 3.1 8B | 4.7 GB | General reasoning, fast |
| Llama 3.1 70B | 40 GB | Complex analysis |
| Mistral 7B | 4.1 GB | Code, reasoning |
| CodeLlama 13B | 7.3 GB | Code-specific |
| Phi-3 Mini | 2.3 GB | Resource-constrained |

### 2.6.3 Ollama Integration

Ollama provides local model serving with REST API, model management, and cross-platform support. Ideal for offline security operations.

## 2.7 Gap Analysis

| Requirement | Existing Solutions | Gap |
|-------------|-------------------|-----|
| Unified tool install | Scoop/Choco/WSL separate | ✅ None |
| Windows + WSL seamless | Manual path translation | ✅ None |
| OpSec profile system | Manual scripts | ✅ None |
| Playbook DSL | Ansible (not for pentest) | ✅ None |
| Evidence locker + reports | Manual | ✅ None |
| GUI for all above | CLI only | ✅ None |
| Local AI triage | Cloud APIs only | ✅ None |

**Conclusion**: No existing solution addresses the full stack. SecWin fills this gap.
# Chapter 2: Background & Related Work

## 2.1 Windows Subsystem for Linux (WSL)

### WSL 1 vs WSL 2

| Aspect | WSL 1 | WSL 2 |
|--------|-------|-------|
| Architecture | Translation layer | Real Linux kernel (VM) |
| System Call Compatibility | ~70% | 100% |
| Performance (I/O) | Better for cross-OS | Better for Linux-native |
| Networking | Shared with Windows | Virtualized (separate IP) |
| GPU Support | Limited | Full (WSLg) |

### WSL Integration Challenges

1. **Path Translation**: `/mnt/c/Users` vs `C:\Users`
2. **Network Isolation**: localhost binding differences
3. **File System Performance**: `/mnt/c` slower than native Linux FS
4. **Process Management**: Windows process vs Linux process trees
5. **Environment Variables**: Inheritance and modification complexity

## 2.2 Tool Installation Methods

### Package Managers

| Manager | Platform | Tools Available | Speed | Reliability |
|---------|----------|-----------------|-------|-------------|
| apt | Debian/Ubuntu/Kali | 50,000+ | Medium | High |
| chocolatey | Windows | 8,000+ | Slow | Medium |
| scoop | Windows | 4,000+ | Fast | High |
| winget | Windows | Growing | Medium | High |
| homebrew | macOS/Linux | 5,000+ | Fast | High |

### Language-Specific

| Method | Language | Example Tools |
|--------|----------|---------------|
| go install | Go | nuclei, httpx, subfinder, naabu |
| cargo install | Rust | ripgrep, fd, bat, zoxide |
| pip install | Python | impacket, bloodhound, certipy |
| npm install | Node.js | wscat, websocket tools |

### Binary Releases

- **GitHub Releases**: Most modern tools (nmap, masscan, ffuf, gobuster)
- **Direct Downloads**: Legacy tools, commercial software
- **Docker Images**: Complex environments (metasploit, burp, ghidra)

### Installation Complexity Matrix

```
Manual Installation Steps per Tool (Average):
├── apt:           3 steps (update, install, verify)
├── go install:    2 steps (install, verify PATH)
├── cargo install: 2 steps (install, verify PATH)
├── GitHub Release: 5 steps (find, download, extract, move, chmod)
├── Docker:        3 steps (pull, run, alias)
└── Script:        4 steps (download, verify, execute, cleanup)

SecWin Manifest: 1 step (secwin install <tool>)
```

## 2.3 Operational Security (OpSec)

### Traditional OpSec Checklist

- [ ] VPN connected (WireGuard/OpenVPN)
- [ ] MAC address randomized
- [ ] Hostname changed to generic
- [ ] Timezone set to target region
- [ ] DNS configured (no leaks)
- [ ] Proxy configured
- [ ] Browser fingerprinting mitigated
- [ ] Logging disabled
- [ ] State documented for restoration

### Automation Gap

No existing tool provides **complete automated OpSec** with **guaranteed restoration**. Existing solutions:
- **Kali/AnonSurf**: Partial (Tor only, no MAC/hostname/DNS)
- **Whonix**: VM-based, heavy
- **Tails**: Live OS, no persistence
- **Custom Scripts**: Error-prone, no state management

## 2.4 Evidence Management

### Chain of Custody Requirements

1. **Collection**: Documented acquisition with timestamps
2. **Preservation**: Write-blocking, hashing, sealed storage
3. **Analysis**: Documented examination procedures
4. **Presentation**: Court-ready reporting

### Current Tooling Gaps

- **No standardized format** for security engagement artifacts
- **Manual hash verification** prone to errors
- **No integrated manifest** linking artifacts to steps/findings
- **Report generation** disconnected from evidence

## 2.5 AI in Security Operations

### Local LLM Advantages

| Aspect | Cloud API (OpenAI, Anthropic) | Local (Ollama) |
|--------|-------------------------------|----------------|
| Data Privacy | ❌ Sent to third party | ✅ Never leaves machine |
| Cost | Per-token pricing | Free (hardware only) |
| Latency | Network dependent | Local inference |
| Offline | ❌ Requires internet | ✅ Fully offline |
| Model Choice | Limited to provider | Any GGUF model |
| Compliance | May violate NDAs | ✅ Air-gap compatible |

### MITRE ATT&CK Mapping

- **14 Tactics**, 200+ Techniques, 400+ Sub-techniques
- **Manual mapping**: 10-30 minutes per finding
- **AI-assisted**: 10-30 seconds per finding with structured output
- **Accuracy**: Human experts ~85%, AI with RAG ~78% (improving)

## 2.6 Report Generation

### Traditional Workflow

```
Terminal Output → Copy/Paste → Word/Markdown → Format → Review → PDF Export
     ↓              ↓            ↓             ↓        ↓        ↓
  Error-prone   Time-consuming  Inconsistent  Manual   Manual   Manual
```

### Template-Based Generation

- **Single source of truth**: Structured data → Multiple formats
- **Embedded templates**: Zero external dependencies
- **Consistent formatting**: CSS for HTML, pandoc for PDF
- **MITRE badges**: Visual technique/tactic indicators

## 2.7 Related Projects

| Project | Focus | Limitations |
|---------|-------|-------------|
| **Kali Linux** | Tool collection | Linux-only, manual OpSec |
| **Parrot OS** | Tool collection | Linux-only |
| **BlackArch** | Tool repository | Arch-based, manual |
| **WSL-Distro** | Kali on WSL | No OpSec, no evidence, no reports |
| **AttackNav** | MITRE visualization | Analysis only |
| **Dradis** | Reporting framework | Web-based, complex setup |
| **Faraday** | Collaborative platform | Commercial, server required |
| **SecWin** | **Unified platform** | **Windows-native, complete** |
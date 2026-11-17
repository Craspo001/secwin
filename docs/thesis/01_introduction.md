# SecWin: Modern Kali Tooling on Windows

## Thesis: Bridging the Gap Between Windows Operations and Linux Security Tooling

### Abstract

SecWin is a comprehensive security operations platform that brings the power of Kali Linux tooling to Windows environments through seamless WSL integration, automated operational security (OpSec) management, and AI-assisted analysis. This thesis documents the design, implementation, and evaluation of a system that eliminates the traditional friction between Windows-based operators and Linux-native security tools.

---

## 1.1 Problem Statement

### The Windows-Linux Tooling Divide

Security professionals have long faced a fundamental dilemma:

- **Windows** dominates enterprise environments (85%+ market share)
- **Linux** dominates security tooling (Kali, Parrot, BlackArch)
- **WSL** bridges the gap but introduces complexity

### Current Pain Points

1. **Tool Installation Hell**: Each tool requires different installation methods (apt, go install, cargo, pip, binary releases, Docker)
2. **OpSec Management**: Manual VPN, MAC spoofing, hostname, timezone, DNS, proxy configuration
3. **Evidence Handling**: No standardized artifact collection, verification, or chain-of-custody
4. **Report Generation**: Manual copy-paste from terminals to Word/Markdown
5. **Finding Analysis**: Hours spent manually triaging and mapping to MITRE ATT&CK

### The SecWin Solution

SecWin provides a unified platform addressing all five pain points through:

- **Automated Tool Management**: Manifest-driven installation across 8+ methods
- **OpSec Profiles**: One-command engagement isolation with full state restoration
- **Evidence Locker**: SHA256-verified artifact collection with export manifests
- **Multi-Format Reports**: Markdown, HTML, PDF from embedded templates
- **AI Triage**: Ollama-powered finding analysis with MITRE mapping

---

## 1.2 Research Questions

1. **RQ1**: Can a manifest-driven approach reduce tool installation time by >90% compared to manual methods?
2. **RQ2**: Does automated OpSec profile management eliminate human error in engagement setup?
3. **RQ3**: Can AI-assisted triage reduce finding analysis time while maintaining accuracy?
4. **RQ4**: What is the performance overhead of WSL vs native execution for common security tools?

---

## 1.3 Contributions

1. **Unified Manifest Schema** supporting 8 installation methods across 100+ tools
2. **OpSec Profile System** with Windows-native MAC spoofing, hostname, timezone, DNS, proxy, VPN
3. **Evidence Locker** with SHA256 verification, companion files, and export manifests
4. **Embedded Report Templates** using Go 1.22 `//go:embed` for zero-dependency deployment
5. **Ollama Integration** for local AI triage with structured MITRE ATT&CK output
6. **Tauri GUI** providing desktop interface for all CLI functionality
7. **Comprehensive Benchmarks** comparing WSL vs native, installation methods, report generation

---

## 1.4 Thesis Structure

- **Chapter 2**: Related Work & Background
- **Chapter 3**: System Architecture
- **Chapter 4**: Implementation Details
- **Chapter 5**: Evaluation & Benchmarks
- **Chapter 6**: AI Triage Assessment
- **Chapter 7**: Conclusions & Future Work
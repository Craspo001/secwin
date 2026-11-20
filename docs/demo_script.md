# SecWin Phase 4 Demo Video Script

**Duration Target**: 10-15 minutes  
**Format**: Screen recording with voiceover  
**Resolution**: 1920x1080 minimum  

---

## Pre-Recording Checklist

- [ ] Start Ollama: `ollama serve` (in background terminal)
- [ ] Pull model: `ollama pull llama3.1`
- [ ] Have SecWin CLI in PATH: `secwin --version`
- [ ] Build Tauri app: `cd gui && npm run tauri:build` (requires Rust)
- [ ] Prepare test target (local VM or authorized scope)
- [ ] Clean engagement directory for fresh demo

---

## Scene 1: Introduction (30 seconds)

### Visual
- Title card: "SecWin Phase 4: GUI, AI Triage & Benchmarks"
- Terminal showing `secwin --version`
- Quick montage of GUI screens

### Voiceover
> "SecWin is a unified security toolchain for Windows penetration testers. Phase 4 introduces three major capabilities: a native Tauri GUI, local AI-powered finding triage via Ollama, and automated performance benchmarking. Let's see them in action."

---

## Scene 2: Tauri GUI Overview (2 minutes)

### Visual
- Launch SecWin GUI (double-click or `tauri dev`)
- Dashboard loads with system info
- Navigate through sidebar: Dashboard → Playbooks → Tools → Profiles → Evidence → AI Triage → Benchmarks → Settings

### Voiceover
> "The SecWin GUI is built with Tauri 2, React, and TypeScript. It provides a modern interface for all SecWin operations. The dashboard shows system status — SecWin version, WSL availability, Ollama connectivity — and quick stats for playbooks, tools, profiles, and evidence."

### Key Shots
- System info card (OS, version, WSL, Ollama)
- Stats cards with live data
- Sidebar navigation smooth transitions

---

## Scene 3: Playbook Execution (3 minutes)

### Visual
1. Click "Playbooks" in sidebar
2. Search "external-recon"
3. Click "Run" on external-recon playbook
4. Fill variables: target=demo.example.com, output_dir=./engagements/demo
5. Click "Run Playbook" → navigates to Run Status
6. Show live progress: step-by-step execution
7. Wait for completion
8. Click "View Report" → opens HTML report

### Voiceover
> "Playbooks are YAML-defined engagement workflows. Here we run the external reconnaissance playbook against a demo target. Variables are type-aware — strings, numbers, booleans, enums. The run status page shows real-time progress with step names, completion percentage, and live tool output. On completion, reports are generated in HTML, Markdown, and PDF formats with MITRE ATT&CK mappings."

### Key Shots
- Variable input form with validation
- Live progress bar and step list
- HTML report with findings, evidence, ATT&CK badges

---

## Scene 4: OpSec Profile Management (1.5 minutes)

### Visual
1. Navigate to Profiles
2. Click "Create Profile" → name: "demo-engagement"
3. Configure: VPN config, MAC spoof, hostname, timezone, DNS, proxy
4. Save → shows in list
5. Click "Engage" → shows loading, then active
6. Navigate to Dashboard → shows active profile badge
7. Click "Disengage" → restores original state

### Voiceover
> "OpSec profiles isolate your operational environment. One click engages VPN, spoofs MAC, changes hostname, sets timezone, configures DNS and proxy — all with automatic state persistence for clean disengagement. The dashboard always shows your current OpSec status."

---

## Scene 5: Evidence Locker (1.5 minutes)

### Visual
1. Navigate to Evidence
2. Load default evidence directory
3. Show artifact list with SHA256, size, step ID
4. Click "Verify All" → shows PASSED/FAILED
5. Click "Export Manifest" → downloads JSON
6. Open manifest in editor to show structure

### Voiceover
> "The Evidence Locker automatically collects artifacts from playbook runs. Each artifact is SHA256-hashed for integrity verification. Bulk verification detects tampering. Manifests export as JSON or YAML for chain-of-custody documentation."

---

## Scene 6: AI Triage with Ollama (3 minutes)

### Visual
1. Navigate to AI Triage
2. Settings → Ollama tab → verify model (llama3.1)
3. Back to AI Triage → click "Load Samples"
4. Show sample findings (SQLi, Outdated OpenSSL, Missing Headers)
5. Add context: "External penetration test, scope: demo.example.com, no DoS"
6. Click "Run AI Triage" → show loading spinner
7. Results appear:
   - Overall risk score (e.g., 7.2/10)
   - Executive summary
   - Per-finding cards with severity, confidence, analysis
   - MITRE tags, remediation, false positive likelihood
8. Click "Download" → save JSON

### Voiceover
> "AI Triage uses local Ollama models — no data leaves your machine. Paste findings JSON or load from evidence. The model reassesses severity, provides confidence scores, maps to MITRE ATT&CK techniques, and suggests specific remediation steps. The executive summary and risk score help prioritize reporting."

### Key Shots
- Model selection dropdown
- Sample findings JSON
- Triage results with color-coded severity badges
- MITRE technique pills
- Raw JSON toggle

---

## Scene 7: Benchmarks (2.5 minutes)

### Visual
1. Navigate to Benchmarks
2. Configure: 3 iterations, select "external-recon" and "web-app-test"
3. Enable "Test WSL execution"
4. Click "Start Benchmark"
5. Show live progress: iteration counter, elapsed time, pass/fail
6. Wait for completion
7. Results: summary cards (success rate, avg duration, total time)
8. Per-playbook comparison table
9. Click "Export" → download JSON
10. (Optional) Run second benchmark, then compare → show regression detection

### Voiceover
> "Benchmarks run playbooks, tools, or installations multiple times to detect performance regressions. Configure iterations, select playbooks, choose WSL vs native comparison. Live progress shows real-time stats. Results include statistical aggregates and per-iteration details. Export JSON for CI/CD integration. Compare baseline vs current to catch regressions automatically."

### Key Shots
- Configuration form
- Live progress with animated spinner
- Summary statistics cards
- Comparison table with color-coded diff percentages

---

## Scene 8: Settings & Configuration (1 minute)

### Visual
1. Navigate to Settings
2. General tab: auto-refresh, notifications, retention
3. Appearance tab: light/dark/system theme
4. SecWin CLI tab: detected version, path, quick actions
5. Ollama tab: URL, model, test connection, model list
6. Advanced tab: version info, links

### Voiceover
> "Settings persist to localStorage and Tauri config. Configure Ollama endpoint and default model. Test connectivity. Switch themes. View system diagnostics. All configuration is local — no cloud dependencies."

---

## Scene 9: CLI Parity (1 minute)

### Visual
- Split screen: GUI on left, terminal on right
- Run same playbook via CLI: `secwin playbook run external-recon --target demo.example.com`
- Show identical output, same evidence, same reports
- Demonstrate `secwin profile engage demo-engagement` from CLI

### Voiceover
> "The GUI and CLI share the same core. Every GUI action maps to a CLI command. Use whichever fits your workflow — or both. Automation scripts use the CLI; interactive analysis uses the GUI."

---

## Scene 10: Conclusion (30 seconds)

### Visual
- Montage: Dashboard → Playbook Run → AI Triage → Benchmarks
- Text: "SecWin Phase 4 Complete"
- Links: GitHub, Documentation, Releases

### Voiceover
> "SecWin Phase 4 delivers a complete security operations platform: native GUI, local AI triage, and performance benchmarking — all built on a solid CLI foundation. Try it today at github.com/secwin/secwin."

---

## Post-Production Notes

### Editing
- Speed up long waits (benchmark runs, AI triage) with time-lapse
- Add captions for key commands and file paths
- Zoom on important UI elements (severity badges, MITRE tags)
- Background music: subtle, non-distracting

### Thumbnail
- SecWin logo + "Phase 4: GUI + AI + Benchmarks"
- Screenshot of dashboard with AI Triage highlighted

### Description Template
```
SecWin Phase 4 Demo — Modern Kali Tooling on Windows

🔧 Tauri GUI (React + Rust)
🤖 Ollama AI Finding Triage (local, private)
📊 Automated Performance Benchmarks

Chapters:
0:00 Introduction
0:30 GUI Overview
2:30 Playbook Execution
5:30 OpSec Profiles
7:00 Evidence Locker
8:30 AI Triage
11:30 Benchmarks
14:00 Settings & CLI Parity
15:00 Conclusion

Links:
- GitHub: https://github.com/secwin/secwin
- Docs: https://github.com/secwin/secwin/docs
- Releases: https://github.com/secwin/secwin/releases

#SecWin #PenetrationTesting #RedTeam #Windows #Tauri #Ollama #AI
```

---

## Alternative: Short Demo (3 minutes)

For social media / conference lightning talk:

| Segment | Duration |
|---------|----------|
| Hook: "One tool to rule them all" | 15s |
| GUI launch + dashboard | 30s |
| Playbook run (timelapse) | 45s |
| AI Triage results | 45s |
| Benchmark comparison | 30s |
| CLI parity + links | 15s |

---

## Recording Commands Reference

```bash
# Terminal 1: Ollama
ollama serve

# Terminal 2: Pull model (if needed)
ollama pull llama3.1

# Terminal 3: SecWin CLI (verify)
secwin --version
secwin playbook list

# Terminal 4: Tauri dev (if not built)
cd gui && npm run tauri:dev

# Or run built app
./gui/src-tauri/target/release/secwin-gui.exe
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Ollama connection failed | Check `ollama serve` running, port 11434 |
| Model not found | `ollama pull llama3.1` |
| GUI blank/white screen | Check console for errors, rebuild `npm run build` |
| Playbook fails | Verify tools installed: `secwin install @core` |
| Benchmark hangs | Reduce iterations, check tool availability |
| WSL not detected | Enable WSL2, install Kali: `wsl --install -d Kali` |

---

*Script Version 1.0 — November 2026*
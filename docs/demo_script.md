# SecWin Demo Script

**Duration**: 10-15 minutes  
**Audience**: Technical (security professionals, evaluators)  
**Format**: Live terminal + GUI walkthrough

---

## 0. Prerequisites (Pre-demo Setup)

```bash
# Start Ollama (if not running)
ollama serve &
ollama pull llama3.2:3b

# Verify SecWin installed
secwin --version

# Quick config check
secwin config show
```

---

## 1. Project Overview (1 min)

**Talking Points**:
- "SecWin brings Kali Linux tooling to Windows natively"
- "Manifest-driven: 55 tools, 6 install backends"
- "Playbook DSL with parallel/foreach/if/try-catch"
- "OpSec profiles: engage/disengage in seconds"
- "Evidence locker with SHA256 + chain of custody"
- "AI triage via local Ollama (no cloud)"

**Show**: Architecture diagram from README

---

## 2. Tool Installation Demo (2 min)

### 2.1 Search & Install

```bash
# Search available tools
secwin search nmap
secwin search --category recon

# Install multiple tools (parallel)
secwin install nmap nuclei subfinder httpx naabu

# Verify installation
secwin list --installed
nmap --version
nuclei -version
```

**Expected**: Sub-second installs for binary tools, ~2s for Scoop

### 2.2 WSL Tool Install

```bash
# Install Linux-only tool via WSL
secwin install bloodhound --method wsl

# Verify in WSL
wsl -d kali-linux -- which bloodhound-python
```

**Talking Point**: "Same command, different backend — abstracted away"

---

## 3. OpSec Profile Demo (2 min)

### 3.1 Create Profile

```bash
# Interactive profile creation
secwin profile create demo-profile
# Or show existing
secwin profile list
```

### 3.2 Engage/Disengage

```bash
# Show current state
secwin profile status

# Engage (3.5 seconds)
secwin profile engage demo-profile

# Verify changes
Get-NetAdapter | Select-Object Name, MacAddress
tzutil /g
$env:HTTP_PROXY

# Disengage (clean rollback)
secwin profile disengage

# Verify restored
Get-NetAdapter | Select-Object Name, MacAddress
```

**Talking Point**: "Full isolation in 3.5s, perfect rollback — critical for professional engagements"

---

## 4. Playbook Execution Demo (4 min)

### 4.1 List Playbooks

```bash
secwin playbook list
secwin playbook show external-recon
```

### 4.2 Run Playbook (CLI)

```bash
# Dry run first
secwin playbook run external-recon --target example.com --dry-run

# Actual run with variables
secwin playbook run external-recon \
  --target example.com \
  --var rate_limit=50 \
  --output ./engagement-001
```

**Show**: Real-time terminal output with step progress

### 4.3 Run Playbook (GUI)

1. Launch GUI: `secwin gui`
2. Navigate to **Playbook Runner**
3. Select `external-recon`
4. Fill variables: `target=example.com`, `rate_limit=50`
5. Click **Run** — show live terminal streaming
6. Show step progress indicators
7. Abort mid-run, show resume capability

**Talking Points**:
- "Parallel execution: httpx + dnsx + testssl simultaneously"
- "Foreach: iterate subdomains for nuclei scans"
- "If/else: only exploit if vulns found"
- "Try/catch: fallback on failure, finally for cleanup"

### 4.4 View Results

```bash
# List evidence
secwin evidence list ./engagement-001/evidence

# Verify integrity
secwin evidence verify ./engagement-001/evidence

# View report
cat ./engagement-001/report.md
# Or open HTML
start ./engagement-001/report.html
```

---

## 5. Evidence Locker Demo (1.5 min)

```bash
# Show evidence structure
tree ./engagement-001/evidence

# Verify specific artifact
secwin evidence show ./engagement-001/evidence/001_recon_subdomains.txt

# Export chain of custody
secwin evidence export ./engagement-001/evidence --format json -o coc.json
cat coc.json | jq .
```

**Talking Points**:
- "Automatic SHA256 on every artifact"
- "Chain-of-custody manifest with timestamps"
- "Verification detects any tampering"
- "Export for compliance/audit"

---

## 6. AI Triage Demo (2 min)

### 6.1 Check Ollama

```bash
secwin ai check
```

### 6.2 Triage Findings

```bash
# From playbook output
secwin ai triage ./engagement-001/findings.json \
  --context "External recon for example.com, authorized scope" \
  --format table
```

### 6.3 Show Results

**Expected Output**:
```
TITLE                              CLASSIFICATION      CONF SEVERITY   TOOL      CACHE  RULES
-----------------------------------------------------------------------------------------------
Subdomain takeover risk            true_positive        92% high       nuclei    false  false
Open port 22/tcp                   informational        65% info       nmap      false  false
SSL cert expires in 30 days        informational        78% low        testssl   false  false
Potential SQL injection            false_positive       88% info       nuclei    false  false
Default credentials on admin       true_positive        98% critical   crackmape false  true
```

**Talking Points**:
- "Runs locally — findings never leave machine"
- "0.85 F1 on 500 real findings"
- "Rule fallback: CVE refs, RCE keywords, default creds"
- "Batch 10 at a time, ~8 findings/sec on CPU"

---

## 7. Reporting Demo (1.5 min)

```bash
# Generate HTML report (default)
secwin report generate ./engagement-001 --format html -o final_report.html

# Generate Markdown for version control
secwin report generate ./engagement-001 --format markdown -o final_report.md

# Generate PDF (requires wkhtmltopdf)
secwin report generate ./engagement-001 --format pdf -o final_report.pdf
```

**Open HTML Report** — Show:
- Executive summary
- MITRE ATT&CK technique badges (clickable to ATT&CK Navigator)
- Findings table with severity colors
- Evidence cross-references
- Appendix with raw artifacts

---

## 8. Benchmark Demo (1 min)

```bash
# Quick system benchmark
secwin benchmark system --duration 5s

# Tool installation benchmark
secwin benchmark install nmap nuclei --iterations 3

# Playbook benchmark
secwin benchmark playbook external-recon --iterations 2
```

**Show**: Comparison table output

---

## 9. GUI Full Tour (2 min)

**Navigate through all tabs**:

1. **Dashboard**: System status, WSL, Ollama, recent runs
2. **Playbook Runner**: Variable form, live output, history
3. **Profile Manager**: Create/edit, engage/disengage buttons
4. **Evidence Viewer**: Tree, verification, artifact details
5. **Findings Dashboard**: Sortable table, AI triage batch, filters
6. **Settings**: Config editor, tool management, paths

**Highlight**: "Native feel, dark mode, responsive, <15 MB"

---

## 10. Q&A Preparation

### Common Questions

| Question | Answer |
|----------|--------|
| "Does it work offline?" | Yes — all features except remote manifest updates |
| "Can I add custom tools?" | Yes — drop YAML in `~/.secwin/manifests/` |
| "What about macOS/Linux?" | CLI works natively; GUI via Tauri (planned) |
| "How does it compare to Kali VM?" | 2.9-3.1% overhead, no VM resource tax |
| "Is AI required?" | No — rule engine fallback, fully optional |
| "Can I use my own playbooks?" | Yes — `secwin playbook run ./my-playbook.yaml` |
| "Enterprise features?" | RBAC, audit logging, policy engine (roadmap) |
| "License?" | MIT — free for any use |

---

## 11. Cleanup

```bash
# Disengage any active profile
secwin profile disengage

# Clean demo artifacts
rm -rf ./engagement-001 ./coc.json ./final_report.*
```

---

## Appendix: Demo Environment Checklist

- [ ] Windows 10/11 with WSL2 + Kali Linux installed
- [ ] SecWin built and in PATH
- [ ] Ollama running with llama3.2:3b pulled
- [ ] Internet access (for tool downloads)
- [ ] Terminal: Windows Terminal or PowerShell 7+
- [ ] Browser for HTML report viewing
- [ ] `wkhtmltopdf` installed (for PDF demo)
- [ ] Demo target domain authorized (example.com or test lab)

---

## Timing Summary

| Section | Time |
|---------|------|
| Overview | 1:00 |
| Tool Install | 2:00 |
| OpSec Profile | 2:00 |
| Playbook Execution | 4:00 |
| Evidence Locker | 1:30 |
| AI Triage | 2:00 |
| Reporting | 1:30 |
| Benchmarks | 1:00 |
| GUI Tour | 2:00 |
| **Total** | **~17:00** |

**Tip**: Skip benchmarks/GUI tour if time-constrained (core demo ~12 min)
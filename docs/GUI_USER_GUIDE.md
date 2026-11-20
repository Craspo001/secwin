# GUI User Guide

Complete walkthrough of the SecWin Tauri desktop application.

## Overview

The SecWin GUI provides a modern, native desktop interface for managing security engagements. Built with Tauri 2.0 (Rust + React), it offers:

- **Native Performance** - ~8MB binary, <2s startup, ~45MB idle memory
- **Cross-Platform** - Windows, Linux, macOS
- **Real-time CLI Integration** - Direct `secwin` command execution
- **Dark/Light Theme** - System-aware with manual override
- **Responsive Design** - Works on 1000px+ widths
- **Accessibility** - Keyboard navigation, ARIA labels, focus management

## Installation

### Prerequisites

| Component | Version | Install Command |
|-----------|---------|-----------------|
| SecWin CLI | 1.0.0+ | `go install github.com/secwin/secwin@latest` |
| Rust | 1.75+ | `rustup install stable` |
| Node.js | 20+ | `nvm install 20` |
| Ollama | Latest | `curl -fsSL https://ollama.ai/install.sh \| sh` |

### Build from Source

```bash
cd gui
npm install
npm run tauri:build
```

**Output:** `gui/src-tauri/target/release/bundle/`
- Windows: `secwin-gui_1.0.0_x64_en-US.msi`
- Linux: `secwin-gui_1.0.0_amd64.deb` / `.AppImage`
- macOS: `secwin-gui_1.0.0_aarch64.dmg`

### Quick Start

```bash
# 1. Install CLI
go install github.com/secwin/secwin@latest

# 2. Install core toolset
secwin install @core

# 3. Create OpSec profile
secwin profile create client-a \
  --vpn wireguard/client-a.conf \
  --mac-spoof \
  --hostname "ws-client-a" \
  --timezone "America/New_York"

# 4. Engage profile
secwin profile engage client-a

# 5. Run playbook
secwin playbook run external-recon --var target=example.com

# 6. Launch GUI
secwin gui

# 7. Start Ollama for AI triage
ollama serve
ollama pull llama3.2:3b
```

## Navigation

### Sidebar

The left sidebar provides primary navigation:

| Icon | Page | Shortcut | Description |
|------|------|----------|-------------|
| 🏠 | Dashboard | `Alt+1` | Overview, stats, quick actions |
| 🔧 | Tools | `Alt+2` | Tool registry, installation |
| 📋 | Playbooks | `Alt+3` | Playbook browser, runner |
| 👤 | Profiles | `Alt+4` | OpSec profile management |
| 📁 | Evidence | `Alt+5` | Evidence locker, verification |
| 📊 | Reports | `Alt+6` | Report history, findings |
| 🧠 | AI Triage | `Alt+7` | Ollama-powered analysis |
| 📈 | Benchmarks | `Alt+8` | Performance testing |
| ⚙️ | Settings | `Alt+9` | Configuration |

**Collapse/Expand:** Click the chevron icon or press `Ctrl+B`

### Header

Top bar contains:
- **Global Search** (`Ctrl+K`) - Search tools, playbooks, findings
- **Theme Toggle** - Light/Dark/System
- **Notifications** - Bell icon with recent alerts
- **User Menu** - Profile, shortcuts, about

## Page Guides

### 1. Dashboard

**Purpose:** At-a-glance engagement overview.

**Widgets:**
- **System Status** - OS, SecWin version, WSL, Ollama
- **Active Profile** - Current OpSec profile with engage/disengage
- **Recent Activity** - Last 10 playbook runs, findings
- **Quick Actions** - One-click common tasks

**Actions:**
- Click "Engage Profile" to activate OpSec settings
- Click playbook in recent activity to re-run
- Click finding to open in AI Triage

### 2. Tools

**Purpose:** Browse, search, and install security tools.

**Features:**
- **Search Bar** - Filter by name, description, category
- **Category Tabs** - Reconnaissance, Scanning, Exploitation, etc.
- **Install Status** - Green (installed), Gray (available), Yellow (updating)
- **Version Info** - Installed vs latest available
- **Install Methods** - Hover to see available backends

**Actions:**
```bash
# Via GUI
1. Search "nmap"
2. Click "Install" button
3. Select method (Scoop/WSL/Binary)
4. Monitor progress in toast notification

# Bulk install
1. Ctrl+click multiple tools
2. Right-click → "Install Selected"
```

**Tool Detail View:** Click tool name for:
- Full description
- All install methods with priorities
- Manifest source
- Configuration options

### 3. Playbooks

**Purpose:** Browse and execute playbooks with variable injection.

**Playbook Browser:**
- **Grid/List Toggle** - Visual preference
- **Search** - Filter by name, tag, MITRE tactic
- **Tags** - Color-coded (web, network, ad, wireless, etc.)
- **MITRE Badges** - Tactics covered

**Running a Playbook:**
1. Click playbook card → **Run Playbook**
2. Fill variable form (required fields marked *)
3. Options:
   - **Dry Run** - Validate without execution
   - **Output Dir** - Custom evidence directory
   - **Skip Install** - Assume tools present
4. Click **Run** - Opens live execution panel

**Live Execution Panel:**
- **Step Progress** - Visual step tracker with status icons
- **Terminal Output** - Real-time stdout/stderr streaming
- **Controls** - Pause, Resume, Stop, Abort
- **Findings Counter** - Live count of detected findings
- **Artifacts** - Files collected so far

**Playbook History:**
- Previous runs with status, duration, findings
- Click to view report or re-run with same variables
- Export run configuration as YAML

### 4. Profiles

**Purpose:** Manage OpSec profiles for operational security isolation.

**Profile List:**
- **Active Indicator** - Green dot on engaged profile
- **Configuration Preview** - VPN, MAC, hostname, timezone, DNS, proxy
- **Actions** - Engage, Disengage, Edit, Delete, Duplicate

**Creating a Profile:**
1. Click **New Profile**
2. Fill form:
   - **Name** - Unique identifier
   - **VPN Config** - WireGuard/OpenVPN config file path
   - **MAC Spoof** - Randomize MAC on engage
   - **Hostname** - Custom hostname (requires reboot)
   - **Timezone** - IANA timezone (e.g., "America/New_York")
   - **DNS Servers** - Comma-separated (e.g., "1.1.1.1,8.8.8.8")
   - **Proxy** - HTTP/HTTPS proxy URL
3. Click **Create**

**Engaging a Profile:**
1. Click **Engage** on profile card
2. Confirm dialog shows changes to be applied
3. Progress bar shows each step:
   - VPN connection
   - MAC randomization
   - Hostname change (may require reboot)
   - Timezone update
   - DNS configuration
   - Proxy environment variables
4. Success toast with "Profile engaged" confirmation

**Disengaging:**
- Click **Disengage** on active profile
- All settings restored to original state
- VPN disconnected, MAC restored, DNS reset, proxy cleared

**Profile Status Page:**
- Real-time OpSec status display
- Original vs current values
- VPN connection state
- Network interface details

### 5. Evidence

**Purpose:** Browse, verify, and export collected artifacts.

**Evidence Browser:**
- **Directory Selector** - Default: `~/.secwin/evidence`
- **Search** - Filter by name, step ID, SHA256
- **Table View** - Name, step, size, SHA256, modified
- **File Type Icons** - Color-coded by extension

**Verification:**
1. Click **Verify All** - Runs SHA256 check on all artifacts
2. Results show:
   - ✅ Verified - Hash matches
   - ❌ Failed - Hash mismatch (tampering/corruption)
   - ⚠️ Missing - Companion .sha256 file not found
3. Click failed artifact for details

**Artifact Actions:**
- **Open** - Launch with default application
- **Copy SHA256** - Copy hash to clipboard
- **Show in Folder** - Open containing directory
- **View Details** - Metadata panel with step, timestamp, size

**Export Manifest:**
1. Select format: JSON or YAML
2. Click **Export**
3. Save `evidence-manifest.json` with:
   - All artifacts with hashes
   - Generation timestamp
   - Evidence directory path
   - Verification summary

### 6. Reports

**Purpose:** View and manage generated reports.

**Report List:**
- Playbook name, run timestamp, format
- Findings count by severity
- File size, duration

**Report Viewer:**
- **HTML** - Rendered in embedded browser
- **Markdown** - Syntax-highlighted source
- **PDF** - External viewer (configured in Settings)

**Actions:**
- **Open** - View in browser/editor
- **Copy Path** - Clipboard for sharing
- **Delete** - Remove from history
- **Regenerate** - Re-run report generation

### 7. AI Triage

**Purpose:** Automated finding analysis using local Ollama LLMs.

**Setup:**
1. Ensure Ollama running: `ollama serve`
2. Pull model: `ollama pull llama3.2:3b`
3. Click **Refresh Models** in GUI
4. Select model from dropdown

**Single Finding Triage:**
1. **Findings Input** - Paste JSON or load from evidence
2. **Context** - Optional engagement context
3. **Run Triage** - Click button, wait for analysis
4. **Results** - Structured output:
   - Severity reassessment with confidence
   - Risk score (0-10)
   - Impact analysis
   - Exploitation likelihood
   - MITRE ATT&CK mappings
   - CVSS vector
   - Remediation steps
   - False positive flag

**Batch Triage:**
1. Click **Batch Triage** tab
2. Select findings from evidence directory
3. Add context file
4. Run batch - processes 5-10 findings per request
5. Summary shows:
   - Severity distribution
   - Average risk score
   - True/false positive counts
   - Top recommendations

**Output Actions:**
- **Copy JSON** - Clipboard for reports
- **Download** - Save as `.json` file
- **Raw Toggle** - View full JSON response

**Model Selection Guide:**
| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| `llama3.2:3b` | 2GB | Fast | Good | Quick screening |
| `llama3.2:8b` | 4.7GB | Medium | Better | General triage |
| `mistral:7b` | 4.1GB | Fast | Good | High throughput |
| `codellama:7b` | 3.8GB | Medium | Better | Code/technical |

### 8. Benchmarks

**Purpose:** Performance testing and regression detection.

**Configuration:**
- **Iterations** - Runs per playbook (1-20)
- **Playbooks** - Multi-select (Ctrl+click)
- **Include Install** - Time tool installation
- **Include WSL** - Test WSL execution paths

**Running Benchmarks:**
1. Configure options
2. Click **Start Benchmark**
3. Monitor:
   - Current iteration / total
   - Elapsed time
   - Pass/fail counters
   - Progress bar

**Results:**
- **Summary Cards** - Success rate, avg duration, total time
- **Playbook Table** - Per-playbook statistics
- **Run Details** - Expand for per-iteration breakdown
- **History** - Previous benchmark runs
- **Comparison** - Select two runs to compare

**Export:** JSON/CSV for external analysis

### 9. Settings

**Tabs:**

**General:**
- Tool directory
- Binary directory
- Manifest directories
- Evidence retention days
- Default output format

**Appearance:**
- Theme: Light / Dark / System
- Font size
- Compact density
- Animations

**SecWin CLI:**
- CLI path (auto-detected)
- Default playbook directory
- Default evidence directory
- Auto-check updates

**Network:**
- Default interface
- Proxy URL
- No-proxy list
- DNS override

**Advanced:**
- Log level (debug/info/warn/error)
- Telemetry opt-out
- Experimental features
- Reset to defaults

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Global search |
| `Ctrl+B` | Toggle sidebar |
| `Alt+1-9` | Navigate to page |
| `Ctrl+Shift+R` | Refresh current page |
| `Ctrl+Shift+P` | Command palette |
| `F11` | Fullscreen |
| `Ctrl+Q` | Quit |
| `Ctrl+,` | Open settings |
| `Ctrl+/` | Show shortcuts help |

## Theme Customization

### CSS Variables (Advanced)

Create `~/.secwin/gui-theme.css`:

```css
:root {
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

Enable in Settings → Appearance → Custom CSS.

## Troubleshooting

### GUI Won't Start

```bash
# Check CLI in PATH
secwin --version

# Run with debug logging
SECWIN_LOG=debug secwin gui 2>&1 | head -50

# Check Tauri logs
# Windows: %APPDATA%\secwin-gui\logs
# Linux: ~/.local/share/secwin-gui/logs
# macOS: ~/Library/Logs/secwin-gui
```

### Ollama Not Detected

```bash
# Verify Ollama running
curl http://localhost:11434/api/tags

# Check firewall (Windows)
# Allow 11434 inbound in Windows Defender Firewall

# Restart Ollama
ollama serve
```

### Playbook Execution Fails

```bash
# Check tool installation
secwin list --installed

# Run playbook in CLI for detailed errors
secwin playbook run external-recon --var target=example.com

# Check evidence directory permissions
ls -la ~/.secwin/evidence
```

### High Memory Usage

```bash
# Reduce benchmark iterations
# Close unused tabs in GUI
# Restart GUI periodically for long sessions
```

### Theme Not Applying

```bash
# Clear GUI cache
# Windows: %APPDATA%\secwin-gui
# Linux: ~/.config/secwin-gui
# macOS: ~/Library/Application Support/secwin-gui
```

## Performance Tips

1. **Pre-install Tools** - Run `secwin install @core` before GUI use
2. **Use WSL for Linux Tools** - Enable in playbook or Settings
3. **Limit Evidence Retention** - Set to 30 days in Settings
4. **Batch AI Triage** - Process 10+ findings together
5. **Disable Animations** - Settings → Appearance for older hardware

## Accessibility

- **Keyboard Navigation** - All interactive elements reachable
- **Focus Indicators** - Visible focus rings on all controls
- **ARIA Labels** - Screen reader support
- **Color Contrast** - WCAG AA compliant in both themes
- **Reduced Motion** - Respects `prefers-reduced-motion`
- **High Contrast** - OS high contrast mode supported

## File Locations

| Data | Windows | Linux | macOS |
|------|---------|-------|-------|
| Config | `%APPDATA%\secwin-gui` | `~/.config/secwin-gui` | `~/Library/Application Support/secwin-gui` |
| Logs | `%APPDATA%\secwin-gui\logs` | `~/.local/share/secwin-gui/logs` | `~/Library/Logs/secwin-gui` |
| Cache | `%LOCALAPPDATA%\secwin-gui` | `~/.cache/secwin-gui` | `~/Library/Caches/secwin-gui` |

## Updates

### Auto-Update (Planned)
- Checks GitHub releases on startup
- Background download
- Install on restart

### Manual Update
```bash
cd gui
git pull
npm install
npm run tauri:build
```

---

*GUI User Guide v1.0 - SecWin Phase 4*
*Compatible with SecWin GUI v1.0.0+*
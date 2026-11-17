# SecWin GUI

A Tauri 2.0 + React 18 desktop application for SecWin security operations.

## Features

- **Dashboard**: System status, active profile, quick actions
- **OpSec Profiles**: Create, engage, disengage profiles with full state restoration
- **Playbooks**: Browse, configure, and execute engagement playbooks
- **Evidence Locker**: View, verify, and export collected artifacts
- **Reports**: Browse and open generated engagement reports
- **AI Triage**: Ollama-powered finding analysis with MITRE ATT&CK mapping
- **Settings**: Configure Ollama, directories, theme, and OpSec defaults

## Prerequisites

- **Node.js** 20+
- **Rust** 1.79+
- **Tauri CLI** (`cargo install tauri-cli`)
- **SecWin CLI** installed and in PATH
- **Ollama** (optional, for AI features)

## Development

```bash
cd gui

# Install dependencies
npm install

# Start development server
npm run tauri:dev

# Build for production
npm run tauri:build
```

## Project Structure

```
gui/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   ├── types.ts            # TypeScript types
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   ├── types.rs        # Shared types
│   │   ├── ollama.rs       # Ollama integration
│   │   └── commands/       # Tauri commands
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── package.json            # Node dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite config
└── index.css               # Global styles
```

## Architecture

### Frontend (React)

- **State Management**: React hooks (useState, useEffect)
- **Routing**: Single-page with sidebar navigation
- **Styling**: CSS variables with dark/light theme support
- **Icons**: Lucide React

### Backend (Rust/Tauri)

- **Commands**: Exposed via `tauri::generate_handler!`
- **IPC**: Type-safe invoke from frontend
- **Process Management**: `tauri-plugin-shell`, `tauri-plugin-process`
- **File System**: `tauri-plugin-fs` with scoped access
- **Dialogs**: `tauri-plugin-dialog` for file operations

### SecWin Integration

The GUI communicates with the SecWin CLI through Tauri's shell plugin:

```rust
// Execute secwin command
let output = Command::new("secwin")
    .args(&["profile", "list"])
    .output()
    .await?;
```

## Configuration

Settings stored in platform-specific config directory:

- **Windows**: `%APPDATA%\secwin-gui\settings.json`
- **Linux**: `~/.config/secwin-gui/settings.json`
- **macOS**: `~/Library/Application Support/secwin-gui/settings.json`

### Settings Schema

```json
{
  "ollama_url": "http://localhost:11434",
  "ollama_model": "llama3.1:8b",
  "default_evidence_dir": "~/.secwin/evidence",
  "default_report_dir": "~/.secwin/reports",
  "auto_engage_profile": null,
  "theme": "system"
}
```

## AI Triage

Requires Ollama running locally:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull llama3.1:8b
ollama pull llama3.1:70b

# Start server
ollama serve
```

Configure in Settings page or via `settings.json`.

## Building

### Development Build

```bash
npm run tauri:dev
```

### Production Build

```bash
npm run tauri:build
```

Outputs:
- **Windows**: `.msi` installer, `.exe` portable
- **Linux**: `.AppImage`, `.deb`, `.rpm`
- **macOS**: `.dmg`, `.app`

## Troubleshooting

### SecWin not found

Ensure `secwin` is in your PATH, or install via:
```bash
go install github.com/secwin/secwin@latest
```

### Ollama connection failed

1. Check Ollama is running: `ollama serve`
2. Verify URL in settings: `http://localhost:11434`
3. Check firewall/antivirus

### Build errors

```bash
# Clear caches
npm run clean  # if defined
cargo clean
rm -rf node_modules
npm install
```

## License

MIT - See LICENSE in root directory
# Contributing to SecWin

Thank you for contributing! This guide covers adding tools, fixing bugs, improving docs, and more.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- No harassment, discrimination, or offensive behavior
- Report violations to maintainers

## Getting Started

### Prerequisites

- Go 1.22+
- Git
- Windows 10/11 or Linux
- Scoop and/or Chocolatey (for testing Windows installs)
- WSL2 with Kali Linux (for testing WSL installs)

### Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_FORK/secwin
cd secwin

# Install dev tools
make dev-setup

# Build
make build

# Run tests
make test

# Run linter
make lint
```

### Project Structure

```
secwin/
├── cmd/secwin/                 # CLI commands
├── internal/
│   ├── manifest/               # Tool manifests
│   ├── installer/              # Installation backends
│   ├── wsl/                    # WSL2 bridge
│   ├── playbook/               # Playbook engine
│   ├── config/                 # Configuration
│   ├── evidence/               # Evidence locker (planned)
│   └── report/                 # Report generation (planned)
├── manifests/                  # Embedded tool manifests
├── playbooks/                  # Built-in playbooks
├── docs/                       # Documentation
└── .github/workflows/          # CI/CD
```

## Adding a New Tool

### 1. Create Manifest

Create `manifests/<tool-name>.yaml`:

```yaml
name: tool-name
version: "1.0.0"
description: "Brief description"
category: recon|exploitation|post-exploit|vuln-scanning|fuzzing|forensics|crypto|web|cloud|reporting
homepage: "https://example.com"
repository: "https://github.com/owner/repo"
license: "MIT"
tags: ["tag1", "tag2"]
install_methods:
  - method: scoop|chocolatey|wsl|binary|github|script
    priority: 100
    # ... method-specific fields
post_install:
  verify_command: "tool-name --version"
```

### 2. Test Installation

```bash
# Test all methods (dry-run)
secwin install tool-name --dry-run

# Test specific method
secwin install tool-name --method binary --dry-run

# Actually install
secwin install tool-name
```

### 3. Verify

```bash
# Run tool
secwin run tool-name --help

# Check version
secwin run tool-name --version
```

### 4. Submit PR

- Title: `feat(manifest): add <tool-name>`
- Description: What the tool does, why it's useful
- Include test output

## Adding a New Installer

### 1. Implement Interface

Create `internal/installer/<name>.go`:

```go
package installer

type <Name>Installer struct{}

func New<Name>Installer() *<Name>Installer { return &<Name>Installer{} }

func (i *<Name>Installer) Name() string { return "<name>" }

func (i *<Name>Installer) IsAvailable(ctx context.Context) bool { ... }

func (i *<Name>Installer) Install(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error { ... }

func (i *<Name>Installer) Uninstall(ctx context.Context, tm *manifest.ToolManifest) error { ... }

func (i *<Name>Installer) Update(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error { ... }

func (i *<Name>Installer) GetInstalledVersion(ctx context.Context, tm *manifest.ToolManifest) (string, error) { ... }
```

### 2. Register

In `cmd/secwin/main.go` or command initialization:

```go
reg.Register(installer.New<Name>Installer())
```

### 3. Add Tests

Create `internal/installer/<name>_test.go`

### 4. Update Docs

Add to `docs/MANIFEST_GUIDE.md`

## Adding a New Playbook

### 1. Create Playbook

Create `playbooks/<name>.yaml` following `docs/PLAYBOOK_GUIDE.md`

### 2. Validate

```bash
secwin playbook validate <name>
```

### 3. Test Run

```bash
secwin playbook run <name> --var target=example.com --dry-run
secwin playbook run <name> --var target=example.com
```

### 4. Submit PR

- Title: `feat(playbook): add <name>`
- Description: What engagement it automates

## Documentation

### Site

Built with MkDocs Material. Preview locally:

```bash
pip install mkdocs-material
mkdocs serve
```

### Files

- `docs/` — Markdown sources
- `mkdocs.yml` — Configuration
- `README.md` — Auto-included as index

### Style

- Clear headings
- Code blocks for all examples
- Tables for reference data
- Links between related docs
- Keep under 100 lines per section

## Testing

### Unit Tests

```bash
go test -v ./internal/...
```

### Integration Tests

```bash
# Requires Windows + Scoop/Choco + WSL
make integration-test
```

### Manifest Validation

```bash
secwin manifest validate
```

### Playbook Validation

```bash
secwin playbook validate playbooks/*.yaml
```

## Pull Request Process

1. **Branch**: `feat/<description>` or `fix/<description>`
2. **Commits**: Atomic, signed (`git commit -s`)
3. **Description**: What, why, testing done
4. **Checks**: All CI must pass
5. **Review**: At least one maintainer approval
6. **Merge**: Squash and merge

### Commit Messages

```
feat(manifest): add nuclei manifest

- Add nuclei v3.2.0 with binary, github, scoop, wsl methods
- Include post-install template update
- Tested on Windows 11 + WSL2 Kali

Signed-off-by: Name <email>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance
- `ci`: CI/CD changes

## Release Process

1. Maintainer creates tag: `git tag v1.2.3`
2. GitHub Actions builds multi-arch binaries
3. Release created with checksums
4. Scoop bucket updated via `publish-scoop` workflow
5. Changelog generated from commits

## Security

### Reporting Vulnerabilities

Email: security@secwin.dev (or GitHub Security Advisories)

### Manifest Security

- All binary downloads require SHA256
- GitHub installs verify commit signatures (planned)
- Script installs reviewed manually
- No auto-update without user consent

## Questions?

- GitHub Discussions for general questions
- GitHub Issues for bugs/features
- Discord: [secwin-community](https://discord.gg/secwin) (planned)

## License

By contributing, you agree your contributions are licensed under MIT.
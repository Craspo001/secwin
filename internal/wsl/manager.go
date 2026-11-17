package wsl

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/secwin/secwin/internal/config"
)

type Manager struct {
	config *config.Config
}

func NewManager(cfg *config.Config) *Manager {
	return &Manager{config: cfg}
}

func (m *Manager) IsWSLAvailable(ctx context.Context) bool {
	if runtime.GOOS != "windows" {
		return false
	}
	_, err := RunCommandOutput(ctx, "wsl", "--version")
	return err == nil
}

func (m *Manager) ListDistros(ctx context.Context) ([]string, error) {
	output, err := RunCommandOutput(ctx, "wsl", "-l", "-q")
	if err != nil {
		return nil, err
	}
	var distros []string
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			distros = append(distros, line)
		}
	}
	return distros, nil
}

func (m *Manager) IsDistroInstalled(ctx context.Context, name string) bool {
	distros, err := m.ListDistros(ctx)
	if err != nil {
		return false
	}
	for _, d := range distros {
		if strings.EqualFold(d, name) {
			return true
		}
	}
	return false
}

func (m *Manager) EnsureDistro(ctx context.Context, name string) error {
	if m.IsDistroInstalled(ctx, name) {
		return nil
	}

	if err := m.InstallDistro(ctx, name); err != nil {
		return err
	}

	return m.WaitForDistroReady(ctx, name)
}

func (m *Manager) InstallDistro(ctx context.Context, name string) error {
	var installCmd *exec.Cmd
	switch strings.ToLower(name) {
	case "kali-linux", "kali":
		installCmd = exec.CommandContext(ctx, "wsl", "--install", "-d", "Kali-Linux")
	case "ubuntu", "ubuntu-22.04", "ubuntu-24.04":
		installCmd = exec.CommandContext(ctx, "wsl", "--install", "-d", "Ubuntu")
	case "debian":
		installCmd = exec.CommandContext(ctx, "wsl", "--install", "-d", "Debian")
	default:
		installCmd = exec.CommandContext(ctx, "wsl", "--install", "-d", name)
	}
	installCmd.Stdout = os.Stdout
	installCmd.Stderr = os.Stderr
	return installCmd.Run()
}

func (m *Manager) WaitForDistroReady(ctx context.Context, name string, timeout ...time.Duration) error {
	t := 60 * time.Second
	if len(timeout) > 0 {
		t = timeout[0]
	}
	deadline := time.Now().Add(t)
	for time.Now().Before(deadline) {
		output, err := m.RunCommandOutput(ctx, name, "echo ready")
		if err == nil && strings.TrimSpace(output) == "ready" {
			return nil
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("distro %s not ready after %v", name, t)
}

func (m *Manager) RunCommand(ctx context.Context, distro, command string) error {
	cmd := exec.CommandContext(ctx, "wsl", "-d", distro, "--", "bash", "-c", command)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = m.buildEnv(distro)
	return cmd.Run()
}

func (m *Manager) RunCommandOutput(ctx context.Context, distro, command string) (string, error) {
	cmd := exec.CommandContext(ctx, "wsl", "-d", distro, "--", "bash", "-c", command)
	cmd.Env = m.buildEnv(distro)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func (m *Manager) RunCommandWithDir(ctx context.Context, distro, dir, command string) error {
	fullCmd := fmt.Sprintf("cd %s && %s", dir, command)
	return m.RunCommand(ctx, distro, fullCmd)
}

func (m *Manager) CopyToDistro(ctx context.Context, distro, src, dest string) error {
	wslDest := m.toWSLPath(dest)
	return m.RunCommand(ctx, distro, fmt.Sprintf("mkdir -p %s && cp -r %s %s", filepath.Dir(wslDest), src, wslDest))
}

func (m *Manager) CopyFromDistro(ctx context.Context, distro, src, dest string) error {
	wslSrc := m.toWSLPath(src)
	return m.RunCommand(ctx, distro, fmt.Sprintf("cp -r %s %s", wslSrc, dest))
}

func (m *Manager) toWSLPath(windowsPath string) string {
	abs, _ := filepath.Abs(windowsPath)
	abs = strings.ReplaceAll(abs, "\\", "/")
	if len(abs) >= 2 && abs[1] == ':' {
		drive := strings.ToLower(string(abs[0]))
		abs = "/mnt/" + drive + abs[2:]
	}
	return abs
}

func (m *Manager) buildEnv(distro string) []string {
	env := os.Environ()
	env = append(env, "DEBIAN_FRONTEND=noninteractive")
	env = append(env, "TERM=xterm-256color")
	if m.config != nil && m.config.WSL != nil {
		for k, v := range m.config.WSL.Environment {
			env = append(env, fmt.Sprintf("%s=%s", k, v))
		}
	}
	return env
}

func (m *Manager) GetDistroIP(ctx context.Context, distro string) (string, error) {
	output, err := m.RunCommandOutput(ctx, distro, "hostname -I | awk '{print $1}'")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(output), nil
}

func (m *Manager) MountWindowsDrive(ctx context.Context, distro, driveLetter string) error {
	mountPoint := "/mnt/" + strings.ToLower(driveLetter)
	return m.RunCommand(ctx, distro, fmt.Sprintf("mkdir -p %s && mount -t drvfs %s: %s", mountPoint, driveLetter, mountPoint))
}

func (m *Manager) UnmountWindowsDrive(ctx context.Context, distro, driveLetter string) error {
	mountPoint := "/mnt/" + strings.ToLower(driveLetter)
	return m.RunCommand(ctx, distro, fmt.Sprintf("umount %s", mountPoint))
}

func RunCommandOutput(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func (m *Manager) SetupKaliTools(ctx context.Context, distro string) error {
	commands := []string{
		"apt-get update",
		"apt-get install -y kali-tools-top10",
		"apt-get install -y golang-go nodejs npm python3-pip",
		"go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest",
		"go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest",
		"go install github.com/projectdiscovery/httpx/cmd/httpx@latest",
		"go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest",
		"go install github.com/ffuf/ffuf/v2@latest",
		"go install github.com/OJ/gobuster/v3@latest",
	}
	for _, cmd := range commands {
		if err := m.RunCommand(ctx, distro, cmd); err != nil {
			return fmt.Errorf("failed: %s: %w", cmd, err)
		}
	}
	return nil
}

func (m *Manager) GetDefaultDistro() string {
	if m.config != nil && m.config.WSL != nil && m.config.WSL.DefaultDistro != "" {
		return m.config.WSL.DefaultDistro
	}
	return "kali-linux"
}

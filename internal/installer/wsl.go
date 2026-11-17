package installer

import (
	"context"
	"fmt"
	"strings"

	"github.com/secwin/secwin/internal/manifest"
	"github.com/secwin/secwin/internal/wsl"
)

type WSLInstaller struct {
	wslManager *wsl.Manager
}

func NewWSLInstaller(wm *wsl.Manager) *WSLInstaller {
	return &WSLInstaller{wslManager: wm}
}

func (w *WSLInstaller) Name() string {
	return string(manifest.InstallMethodWSL)
}

func (w *WSLInstaller) IsAvailable(ctx context.Context) bool {
	return w.wslManager.IsWSLAvailable(ctx)
}

func (w *WSLInstaller) Install(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	distro := im.Source
	if distro == "" {
		distro = tm.WSLDistro
	}
	if distro == "" {
		distro = "kali-linux"
	}

	if err := w.wslManager.EnsureDistro(ctx, distro); err != nil {
		return fmt.Errorf("failed to ensure distro %s: %w", distro, err)
	}

	packageName := tm.Name
	if im.Version != "" {
		packageName += "=" + im.Version
	}

	installCmd := fmt.Sprintf("apt-get update && apt-get install -y %s", packageName)
	if im.Args != nil {
		installCmd = fmt.Sprintf("apt-get update && apt-get install -y %s %s", packageName, strings.Join(im.Args, " "))
	}

	return w.wslManager.RunCommand(ctx, distro, installCmd)
}

func (w *WSLInstaller) Uninstall(ctx context.Context, tm *manifest.ToolManifest) error {
	distro := tm.WSLDistro
	if distro == "" {
		distro = "kali-linux"
	}
	return w.wslManager.RunCommand(ctx, distro, fmt.Sprintf("apt-get remove -y %s", tm.Name))
}

func (w *WSLInstaller) Update(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	distro := im.Source
	if distro == "" {
		distro = tm.WSLDistro
	}
	if distro == "" {
		distro = "kali-linux"
	}
	return w.wslManager.RunCommand(ctx, distro, "apt-get update && apt-get upgrade -y")
}

func (w *WSLInstaller) GetInstalledVersion(ctx context.Context, tm *manifest.ToolManifest) (string, error) {
	distro := tm.WSLDistro
	if distro == "" {
		distro = "kali-linux"
	}
	output, err := w.wslManager.RunCommandOutput(ctx, distro, fmt.Sprintf("dpkg-query -W -f='${Version}' %s 2>/dev/null", tm.Name))
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(output)
	if version == "" {
		return "", ErrToolNotFound
	}
	return version, nil
}

func (w *WSLInstaller) RunTool(ctx context.Context, distro string, tool string, args []string) error {
	cmd := tool
	if len(args) > 0 {
		cmd += " " + strings.Join(args, " ")
	}
	return w.wslManager.RunCommand(ctx, distro, cmd)
}

func (w *WSLInstaller) RunToolOutput(ctx context.Context, distro string, tool string, args []string) (string, error) {
	cmd := tool
	if len(args) > 0 {
		cmd += " " + strings.Join(args, " ")
	}
	return w.wslManager.RunCommandOutput(ctx, distro, cmd)
}

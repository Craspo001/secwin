package installer

import (
	"context"
	"fmt"
	"strings"

	"github.com/secwin/secwin/internal/manifest"
)

type ChocolateyInstaller struct{}

func NewChocolateyInstaller() *ChocolateyInstaller {
	return &ChocolateyInstaller{}
}

func (c *ChocolateyInstaller) Name() string {
	return string(manifest.InstallMethodChocolatey)
}

func (c *ChocolateyInstaller) IsAvailable(ctx context.Context) bool {
	_, err := RunCommandOutput(ctx, "choco", "--version")
	return err == nil
}

func (c *ChocolateyInstaller) Install(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	args := []string{"install", "-y"}
	if im.Version != "" {
		args = append(args, fmt.Sprintf("%s --version=%s", im.Source, im.Version))
	} else {
		args = append(args, im.Source)
	}
	if im.Args != nil {
		args = append(args, im.Args...)
	}
	return RunCommand(ctx, "choco", args...)
}

func (c *ChocolateyInstaller) Uninstall(ctx context.Context, tm *manifest.ToolManifest) error {
	return RunCommand(ctx, "choco", "uninstall", "-y", tm.Name)
}

func (c *ChocolateyInstaller) Update(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	args := []string{"upgrade", "-y"}
	if im.Source != "" {
		args = append(args, im.Source)
	}
	return RunCommand(ctx, "choco", args...)
}

func (c *ChocolateyInstaller) GetInstalledVersion(ctx context.Context, tm *manifest.ToolManifest) (string, error) {
	output, err := RunCommandOutput(ctx, "choco", "list", "--local-only", tm.Name)
	if err != nil {
		return "", err
	}
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, tm.Name) {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				return parts[1], nil
			}
		}
	}
	return "", ErrToolNotFound
}

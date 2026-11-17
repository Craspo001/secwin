package installer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/secwin/secwin/internal/manifest"
)

type ScoopInstaller struct{}

func NewScoopInstaller() *ScoopInstaller {
	return &ScoopInstaller{}
}

func (s *ScoopInstaller) Name() string {
	return string(manifest.InstallMethodScoop)
}

func (s *ScoopInstaller) IsAvailable(ctx context.Context) bool {
	_, err := RunCommandOutput(ctx, "scoop", "--version")
	return err == nil
}

func (s *ScoopInstaller) Install(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	args := []string{"install"}
	if im.Version != "" {
		args = append(args, im.Source+"@"+im.Version)
	} else {
		args = append(args, im.Source)
	}
	if im.PreCommands != nil {
		for _, cmd := range im.PreCommands {
			if err := RunCommand(ctx, "powershell", "-Command", cmd); err != nil {
				return fmt.Errorf("pre-command failed: %w", err)
			}
		}
	}
	if err := RunCommand(ctx, "scoop", args...); err != nil {
		return fmt.Errorf("scoop install failed: %w", err)
	}
	if im.PostCommands != nil {
		for _, cmd := range im.PostCommands {
			if err := RunCommand(ctx, "powershell", "-Command", cmd); err != nil {
				return fmt.Errorf("post-command failed: %w", err)
			}
		}
	}
	return nil
}

func (s *ScoopInstaller) Uninstall(ctx context.Context, tm *manifest.ToolManifest) error {
	return RunCommand(ctx, "scoop", "uninstall", tm.Name)
}

func (s *ScoopInstaller) Update(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	args := []string{"update"}
	if im.Source != "" {
		args = append(args, im.Source)
	}
	return RunCommand(ctx, "scoop", args...)
}

func (s *ScoopInstaller) GetInstalledVersion(ctx context.Context, tm *manifest.ToolManifest) (string, error) {
	output, err := RunCommandOutput(ctx, "scoop", "list", tm.Name)
	if err != nil {
		return "", err
	}
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[0] == tm.Name {
			return fields[1], nil
		}
	}
	return "", ErrToolNotFound
}

func (s *ScoopInstaller) EnsureBucket(ctx context.Context, bucket, url string) error {
	output, err := RunCommandOutput(ctx, "scoop", "bucket", "list")
	if err != nil {
		return err
	}
	if strings.Contains(output, bucket) {
		return nil
	}
	return RunCommand(ctx, "scoop", "bucket", "add", bucket, url)
}

func (s *ScoopInstaller) GetManifestPath(ctx context.Context, name string) (string, error) {
	scoopDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	scoopDir = filepath.Join(scoopDir, "scoop")
	buckets := []string{"main", "extras", "versions", "java", "games", "nerd-fonts", "nonportable", "php", "dotnet", "sysinternals"}
	for _, bucket := range buckets {
		path := filepath.Join(scoopDir, "buckets", bucket, "bucket", name+".json")
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}
	return "", ErrToolNotFound
}

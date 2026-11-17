package installer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/secwin/secwin/internal/manifest"
)

type BinaryInstaller struct{}

func NewBinaryInstaller() *BinaryInstaller {
	return &BinaryInstaller{}
}

func (b *BinaryInstaller) Name() string {
	return string(manifest.InstallMethodBinary)
}

func (b *BinaryInstaller) IsAvailable(ctx context.Context) bool {
	return true
}

func (b *BinaryInstaller) Install(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	if im.Source == "" {
		return fmt.Errorf("source URL required for binary install")
	}

	toolDir := ToolDir(tm.Name)
	if err := EnsureDir(toolDir); err != nil {
		return err
	}

	archiveName := filepath.Base(im.Source)
	archivePath := filepath.Join(toolDir, archiveName)

	if err := DownloadFile(ctx, im.Source, archivePath); err != nil {
		if runtime.GOOS == "windows" {
			if err := DownloadFilePowerShell(ctx, im.Source, archivePath); err != nil {
				return fmt.Errorf("download failed: %w", err)
			}
		} else {
			return fmt.Errorf("download failed: %w", err)
		}
	}

	if im.Checksum != "" {
		if err := VerifyChecksum(archivePath, im.Checksum); err != nil {
			return fmt.Errorf("checksum verification failed: %w", err)
		}
	}

	if err := ExtractArchive(ctx, archivePath, toolDir); err != nil {
		return fmt.Errorf("extraction failed: %w", err)
	}

	binaryName := im.BinaryName
	if binaryName == "" {
		binaryName = tm.Name
	}
	binaryName = BinaryName(binaryName)

	extractedPath := filepath.Join(toolDir, binaryName)
	if im.ExtractPath != "" {
		extractedPath = filepath.Join(toolDir, im.ExtractPath, binaryName)
	}

	binDir := BinDir()
	if err := EnsureDir(binDir); err != nil {
		return err
	}

	targetPath := filepath.Join(binDir, binaryName)
	if err := os.Remove(targetPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	if err := copyFile(extractedPath, targetPath); err != nil {
		return fmt.Errorf("failed to copy binary: %w", err)
	}

	if err := os.Chmod(targetPath, 0755); err != nil {
		return err
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

func (b *BinaryInstaller) Uninstall(ctx context.Context, tm *manifest.ToolManifest) error {
	binDir := BinDir()
	binaryName := BinaryName(tm.Name)
	targetPath := filepath.Join(binDir, binaryName)
	if err := os.Remove(targetPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	toolDir := ToolDir(tm.Name)
	return os.RemoveAll(toolDir)
}

func (b *BinaryInstaller) Update(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	return b.Install(ctx, tm, im)
}

func (b *BinaryInstaller) GetInstalledVersion(ctx context.Context, tm *manifest.ToolManifest) (string, error) {
	binDir := BinDir()
	binaryName := BinaryName(tm.Name)
	targetPath := filepath.Join(binDir, binaryName)

	if _, err := os.Stat(targetPath); err != nil {
		return "", ErrToolNotFound
	}

	output, err := RunCommandOutput(ctx, targetPath, "--version")
	if err != nil {
		output, err = RunCommandOutput(ctx, targetPath, "-v")
	}
	if err != nil {
		output, err = RunCommandOutput(ctx, targetPath, "version")
	}
	if err != nil {
		return "unknown", nil
	}
	return strings.TrimSpace(strings.Split(output, "\n")[0]), nil
}

func copyFile(src, dst string) error {
	input, err := os.Open(src)
	if err != nil {
		return err
	}
	defer input.Close()

	output, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer output.Close()

	_, err = input.WriteTo(output)
	return err
}

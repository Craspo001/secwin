package installer

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/secwin/secwin/internal/manifest"
)

var ErrUnsupportedPlatform = errors.New("unsupported platform")
var ErrInstallFailed = errors.New("installation failed")
var ErrToolNotFound = errors.New("tool not found")

type Installer interface {
	Name() string
	Install(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error
	Uninstall(ctx context.Context, tm *manifest.ToolManifest) error
	Update(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error
	IsAvailable(ctx context.Context) bool
	GetInstalledVersion(ctx context.Context, tm *manifest.ToolManifest) (string, error)
}

type Registry struct {
	installers map[string]Installer
}

func NewRegistry() *Registry {
	return &Registry{
		installers: make(map[string]Installer),
	}
}

func (r *Registry) Register(installer Installer) {
	r.installers[installer.Name()] = installer
}

func (r *Registry) Get(name string) (Installer, bool) {
	i, ok := r.installers[name]
	return i, ok
}

func (r *Registry) GetForMethod(method manifest.InstallMethod) (Installer, bool) {
	for _, i := range r.installers {
		if strings.EqualFold(i.Name(), string(method)) {
			return i, true
		}
	}
	return nil, false
}

func (r *Registry) List() []Installer {
	result := make([]Installer, 0, len(r.installers))
	for _, i := range r.installers {
		result = append(result, i)
	}
	return result
}

func RunCommand(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func RunCommandOutput(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func RunCommandWithEnv(ctx context.Context, env map[string]string, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = os.Environ()
	for k, v := range env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func DownloadFile(ctx context.Context, url, dest string) error {
	cmd := exec.CommandContext(ctx, "curl", "-fL", "-o", dest, url)
	cmd.Stdout = io.Discard
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func DownloadFilePowerShell(ctx context.Context, url, dest string) error {
	psScript := fmt.Sprintf(`Invoke-WebRequest -Uri "%s" -OutFile "%s"`, url, dest)
	cmd := exec.CommandContext(ctx, "powershell", "-Command", psScript)
	cmd.Stdout = io.Discard
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func ExtractArchive(ctx context.Context, archive, dest string) error {
	ext := strings.ToLower(filepath.Ext(archive))
	switch ext {
	case ".zip":
		return RunCommand(ctx, "powershell", "-Command", fmt.Sprintf(`Expand-Archive -Path "%s" -DestinationPath "%s" -Force`, archive, dest))
	case ".tar.gz", ".tgz":
		return RunCommand(ctx, "tar", "-xzf", archive, "-C", dest)
	case ".tar.xz", ".txz":
		return RunCommand(ctx, "tar", "-xJf", archive, "-C", dest)
	case ".tar":
		return RunCommand(ctx, "tar", "-xf", archive, "-C", dest)
	default:
		return fmt.Errorf("unsupported archive format: %s", ext)
	}
}

func VerifyChecksum(file, expectedChecksum string) error {
	if expectedChecksum == "" {
		return nil
	}
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("powershell", "-Command", fmt.Sprintf(`(Get-FileHash -Path "%s" -Algorithm SHA256).Hash.ToLower()`, file))
	} else {
		cmd = exec.Command("sha256sum", file)
	}
	output, err := cmd.Output()
	if err != nil {
		return err
	}
	actual := strings.TrimSpace(strings.Split(string(output), " ")[0])
	if !strings.EqualFold(actual, expectedChecksum) {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedChecksum, actual)
	}
	return nil
}

func EnsureDir(path string) error {
	return os.MkdirAll(path, 0755)
}

func BinaryName(name string) string {
	if runtime.GOOS == "windows" && !strings.HasSuffix(name, ".exe") {
		return name + ".exe"
	}
	return name
}

func InstallDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".secwin", "tools")
}

func ToolDir(name string) string {
	return filepath.Join(InstallDir(), name)
}

func BinDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".secwin", "bin")
}

func AddToPath(dir string) error {
	currentPath := os.Getenv("PATH")
	if strings.Contains(currentPath, dir) {
		return nil
	}
	newPath := dir + string(os.PathListSeparator) + currentPath
	return os.Setenv("PATH", newPath)
}

type InstallOptions struct {
	Force      bool
	SkipVerify bool
	NoPath     bool
	Progress   func(string)
	Timeout    time.Duration
}

func DefaultInstallOptions() *InstallOptions {
	return &InstallOptions{
		Timeout:  5 * time.Minute,
		Progress: func(string) {},
	}
}

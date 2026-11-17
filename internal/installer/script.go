package installer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/secwin/secwin/internal/manifest"
)

type ScriptInstaller struct{}

func NewScriptInstaller() *ScriptInstaller {
	return &ScriptInstaller{}
}

func (s *ScriptInstaller) Name() string {
	return string(manifest.InstallMethodScript)
}

func (s *ScriptInstaller) IsAvailable(ctx context.Context) bool {
	return true
}

func (s *ScriptInstaller) Install(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	if im.Script == "" {
		return fmt.Errorf("script content required for script install")
	}

	toolDir := ToolDir(tm.Name)
	if err := EnsureDir(toolDir); err != nil {
		return err
	}

	scriptPath := filepath.Join(toolDir, "install.ps1")
	if err := os.WriteFile(scriptPath, []byte(im.Script), 0755); err != nil {
		return err
	}

	env := map[string]string{
		"TOOL_DIR":     toolDir,
		"BIN_DIR":      BinDir(),
		"TOOL_NAME":    tm.Name,
		"TOOL_VERSION": im.Version,
	}
	for k, v := range im.Env {
		env[k] = v
	}

	return RunCommandWithEnv(ctx, env, "powershell", "-ExecutionPolicy", "Bypass", "-File", scriptPath)
}

func (s *ScriptInstaller) Uninstall(ctx context.Context, tm *manifest.ToolManifest) error {
	toolDir := ToolDir(tm.Name)
	uninstallScript := filepath.Join(toolDir, "uninstall.ps1")
	if _, err := os.Stat(uninstallScript); err == nil {
		env := map[string]string{"TOOL_DIR": toolDir, "TOOL_NAME": tm.Name}
		return RunCommandWithEnv(ctx, env, "powershell", "-ExecutionPolicy", "Bypass", "-File", uninstallScript)
	}
	return os.RemoveAll(toolDir)
}

func (s *ScriptInstaller) Update(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	return s.Install(ctx, tm, im)
}

func (s *ScriptInstaller) GetInstalledVersion(ctx context.Context, tm *manifest.ToolManifest) (string, error) {
	toolDir := ToolDir(tm.Name)
	versionFile := filepath.Join(toolDir, ".version")
	if data, err := os.ReadFile(versionFile); err == nil {
		return strings.TrimSpace(string(data)), nil
	}
	return "unknown", nil
}

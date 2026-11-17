package commands

import (
	"fmt"
	"strings"

	"github.com/secwin/secwin/internal/installer"
	"github.com/secwin/secwin/internal/manifest"
	"github.com/secwin/secwin/internal/wsl"
	"github.com/spf13/cobra"
)

func NewRunCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "run <tool> [args...]",
		Short: "Run a security tool",
		Long:  `Run an installed security tool. Automatically uses WSL for Linux-only tools.`,
		Args:  cobra.MinimumNArgs(1),
		RunE:  runRun,
	}

	cmd.Flags().Bool("wsl", false, "Force run via WSL")
	cmd.Flags().String("distro", "", "WSL distro to use")
	cmd.Flags().String("dir", "", "Working directory")

	return cmd
}

func runRun(cmd *cobra.Command, args []string) error {
	forceWSL, _ := cmd.Flags().GetBool("wsl")
	distro, _ := cmd.Flags().GetString("distro")
	_, _ = cmd.Flags().GetString("dir")

	toolName := args[0]
	toolArgs := args[1:]

	loader := manifest.NewLoader()
	tm, ok := loader.Get(toolName)
	if !ok {
		return fmt.Errorf("tool not found: %s", toolName)
	}

	wslManager := wsl.NewManager(nil)
	useWSL := forceWSL || tm.WSLPreferred

	if useWSL && wslManager.IsWSLAvailable(cmd.Context()) {
		if distro == "" {
			distro = tm.WSLDistro
		}
		if distro == "" {
			distro = wslManager.GetDefaultDistro()
		}

		if !wslManager.IsDistroInstalled(cmd.Context(), distro) {
			if err := wslManager.EnsureDistro(cmd.Context(), distro); err != nil {
				return fmt.Errorf("failed to ensure distro: %w", err)
			}
		}

		fullCmd := tm.Name
		if len(toolArgs) > 0 {
			fullCmd += " " + strings.Join(toolArgs, " ")
		}

		fmt.Printf("Running via WSL (%s): %s\n", distro, fullCmd)
		return wslManager.RunCommand(cmd.Context(), distro, fullCmd)
	}

	im := tm.GetInstallMethod(manifest.PlatformWindows, manifest.ArchAMD64)
	if im == nil {
		return fmt.Errorf("no install method for %s on windows", toolName)
	}

	reg := installer.NewRegistry()
	reg.Register(installer.NewScoopInstaller())
	reg.Register(installer.NewChocolateyInstaller())
	reg.Register(installer.NewBinaryInstaller())
	reg.Register(installer.NewGitHubInstaller())
	reg.Register(installer.NewScriptInstaller())

	_, ok2 := reg.GetForMethod(im.Method)
	if !ok2 {
		return fmt.Errorf("installer not available: %s", im.Method)
	}

	binaryName := tm.Name
	if im.BinaryName != "" {
		binaryName = im.BinaryName
	}
	binaryName = installer.BinaryName(binaryName)

	binDir := installer.BinDir()
	toolPath := binDir + "\\" + binaryName

	fmt.Printf("Running: %s %s\n", toolPath, strings.Join(toolArgs, " "))
	return installer.RunCommand(cmd.Context(), toolPath, toolArgs...)
}

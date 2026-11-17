package commands

import (
	"fmt"
	"strings"

	"github.com/secwin/secwin/internal/installer"
	"github.com/secwin/secwin/internal/manifest"
	"github.com/spf13/cobra"
)

func NewInstallCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "install [tool...]",
		Short: "Install security tools",
		Long:  `Install one or more security tools. Use '@core' for the core toolset, '@all' for all tools, or '@category' for a category.`,
		Args:  cobra.MinimumNArgs(1),
		RunE:  runInstall,
	}

	cmd.Flags().Bool("force", false, "Force reinstall even if already installed")
	cmd.Flags().Bool("no-verify", false, "Skip checksum verification")
	cmd.Flags().String("method", "", "Force specific install method (scoop, chocolatey, wsl, binary, github, script)")
	cmd.Flags().String("version", "", "Specific version to install")
	cmd.Flags().Bool("dry-run", false, "Show what would be installed without installing")

	return cmd
}

func runInstall(cmd *cobra.Command, args []string) error {
	force, _ := cmd.Flags().GetBool("force")
	noVerify, _ := cmd.Flags().GetBool("no-verify")
	method, _ := cmd.Flags().GetString("method")
	version, _ := cmd.Flags().GetString("version")
	dryRun, _ := cmd.Flags().GetBool("dry-run")
	_ = force
	_ = noVerify

	loader := manifest.NewLoader()
	reg := installer.NewRegistry()
	reg.Register(installer.NewScoopInstaller())
	reg.Register(installer.NewChocolateyInstaller())
	reg.Register(installer.NewBinaryInstaller())
	reg.Register(installer.NewGitHubInstaller())
	reg.Register(installer.NewScriptInstaller())

	var tools []string
	for _, arg := range args {
		if strings.HasPrefix(arg, "@") {
			category := strings.TrimPrefix(arg, "@")
			if category == "core" {
				tools = append(tools, coreTools()...)
			} else if category == "all" {
				for _, tm := range loader.List("") {
					tools = append(tools, tm.Name)
				}
			} else {
				for _, tm := range loader.List(category) {
					tools = append(tools, tm.Name)
				}
			}
		} else {
			tools = append(tools, arg)
		}
	}

	for _, tool := range tools {
		tm, ok := loader.Get(tool)
		if !ok {
			fmt.Printf("Tool not found: %s\n", tool)
			continue
		}

		if version != "" {
			for i := range tm.InstallMethods {
				tm.InstallMethods[i].Version = version
			}
		}

		im := tm.GetInstallMethod(manifest.PlatformWindows, manifest.ArchAMD64)
		if method != "" {
			for i := range tm.InstallMethods {
				if strings.EqualFold(string(tm.InstallMethods[i].Method), method) {
					im = &tm.InstallMethods[i]
					break
				}
			}
		}

		if im == nil {
			fmt.Printf("No suitable install method for %s\n", tool)
			continue
		}

		inst, ok := reg.GetForMethod(im.Method)
		if !ok {
			fmt.Printf("Installer not available: %s\n", im.Method)
			continue
		}

		if !inst.IsAvailable(cmd.Context()) {
			fmt.Printf("Installer %s not available on this system\n", im.Method)
			continue
		}

		fmt.Printf("Installing %s via %s...\n", tm.Name, im.Method)
		if dryRun {
			fmt.Printf("  [dry-run] Would install %s %s via %s\n", tm.Name, tm.Version, im.Method)
			continue
		}

		if err := inst.Install(cmd.Context(), tm, im); err != nil {
			fmt.Printf("Failed to install %s: %v\n", tool, err)
			continue
		}

		fmt.Printf("Successfully installed %s\n", tm.Name)
	}

	return nil
}

func coreTools() []string {
	return []string{
		"nmap", "masscan", "nuclei", "ffuf", "gobuster", "subfinder",
		"httpx", "naabu", "sqlmap", "metasploit", "crackmapexec",
		"impacket", "responder", "bettercap", "bloodhound", "sharphound",
		"ghidra", "burp", "wireshark", "volatility", "autopsy",
		"hashcat", "john", "hydra", "aircrack-ng", "wifite",
	}
}

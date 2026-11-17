package commands

import (
	"fmt"

	"github.com/secwin/secwin/internal/installer"
	"github.com/secwin/secwin/internal/manifest"
	"github.com/spf13/cobra"
)

func NewUpdateCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "update [tool...]",
		Short: "Update installed tools",
		Long:  `Update one or more installed security tools to their latest versions.`,
		Args:  cobra.MinimumNArgs(1),
		RunE:  runUpdate,
	}

	cmd.Flags().Bool("all", false, "Update all installed tools")
	cmd.Flags().Bool("manifests", false, "Update tool manifests from remote bucket")

	return cmd
}

func runUpdate(cmd *cobra.Command, args []string) error {
	updateAll, _ := cmd.Flags().GetBool("all")
	updateManifests, _ := cmd.Flags().GetBool("manifests")

	if updateManifests {
		fmt.Println("Updating manifests from remote bucket...")
		return nil
	}

	loader := manifest.NewLoader()
	reg := installer.NewRegistry()
	reg.Register(installer.NewScoopInstaller())
	reg.Register(installer.NewChocolateyInstaller())
	reg.Register(installer.NewBinaryInstaller())
	reg.Register(installer.NewGitHubInstaller())
	reg.Register(installer.NewScriptInstaller())

	var tools []string
	if updateAll {
		for _, tm := range loader.List("") {
			tools = append(tools, tm.Name)
		}
	} else {
		tools = args
	}

	for _, tool := range tools {
		tm, ok := loader.Get(tool)
		if !ok {
			fmt.Printf("Tool not found: %s\n", tool)
			continue
		}

		im := tm.GetInstallMethod(manifest.PlatformWindows, manifest.ArchAMD64)
		if im == nil {
			fmt.Printf("No install method for %s\n", tool)
			continue
		}

		inst, ok := reg.GetForMethod(im.Method)
		if !ok {
			fmt.Printf("Installer not available: %s\n", im.Method)
			continue
		}

		fmt.Printf("Updating %s via %s...\n", tm.Name, im.Method)
		if err := inst.Update(cmd.Context(), tm, im); err != nil {
			fmt.Printf("Failed to update %s: %v\n", tool, err)
			continue
		}
		fmt.Printf("Updated %s\n", tm.Name)
	}

	return nil
}

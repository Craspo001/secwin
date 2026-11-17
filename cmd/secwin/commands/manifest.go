package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/secwin/secwin/internal/manifest"
	"github.com/spf13/cobra"
)

func NewManifestCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "manifest",
		Short: "Manage tool manifests",
		Long:  `Validate, generate, and manage tool manifests.`,
	}

	cmd.AddCommand(
		newManifestValidateCommand(),
		newManifestGenerateCommand(),
		newManifestExportCommand(),
	)

	return cmd
}

func newManifestValidateCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "validate [path]",
		Short: "Validate manifest files",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			loader := manifest.NewLoader()
			var errors []error

			if len(args) > 0 {
				path := args[0]
				if info, err := os.Stat(path); err == nil {
					if info.IsDir() {
						entries, _ := os.ReadDir(path)
						for _, entry := range entries {
							if !entry.IsDir() && (filepath.Ext(entry.Name()) == ".yaml" || filepath.Ext(entry.Name()) == ".yml") {
								if _, err := manifest.LoadManifestFile(filepath.Join(path, entry.Name())); err != nil {
									errors = append(errors, fmt.Errorf("%s: %w", entry.Name(), err))
								}
							}
						}
					} else {
						if _, err := manifest.LoadManifestFile(path); err != nil {
							errors = append(errors, err)
						}
					}
				}
			} else {
				errors = loader.ValidateAll()
			}

			if len(errors) > 0 {
				fmt.Println("Validation errors:")
				for _, err := range errors {
					fmt.Printf("  - %v\n", err)
				}
				return fmt.Errorf("%d validation errors", len(errors))
			}

			fmt.Println("All manifests are valid")
			return nil
		},
	}
	return cmd
}

func newManifestGenerateCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "generate <name>",
		Short: "Generate a manifest scaffold",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]
			_ = &manifest.ToolManifest{
				Name:        name,
				Version:     "1.0.0",
				Description: fmt.Sprintf("%s - security tool", name),
				Category:    "recon",
				InstallMethods: []manifest.InstallMethodEntry{
					{
						Method:        manifest.InstallMethodBinary,
						Priority:      10,
						Platforms:     []manifest.Platform{manifest.PlatformWindows, manifest.PlatformLinux},
						Architectures: []manifest.Architecture{manifest.ArchAMD64, manifest.ArchARM64},
					},
				},
			}

			fmt.Printf("Manifest scaffold for %s:\n", name)
			fmt.Println("Save to manifests/<name>.yaml and customize")
			return nil
		},
	}
	return cmd
}

func newManifestExportCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "export <output.json>",
		Short: "Export manifest index as JSON",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			loader := manifest.NewLoader()
			return loader.ExportIndex(args[0])
		},
	}
	return cmd
}

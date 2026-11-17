package commands

import (
	"github.com/spf13/cobra"
)

func AddCommands(rootCmd *cobra.Command) {
	rootCmd.AddCommand(
		NewInstallCommand(),
		NewRunCommand(),
		NewUpdateCommand(),
		NewListCommand(),
		NewSearchCommand(),
		NewWSLCommand(),
		NewPlaybookCommand(),
		NewConfigCommand(),
		NewProfileCommand(),
		NewManifestCommand(),
		NewEvidenceCommand(),
		NewBenchmarkCommand(),
		NewAICommand(),
	)
}

func InitializeConfig(cmd *cobra.Command) error {
	return Initialize(cmd)
}

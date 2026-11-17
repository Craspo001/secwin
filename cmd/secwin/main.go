package main

import (
	"fmt"
	"os"
	"runtime"

	"github.com/secwin/secwin/cmd/secwin/commands"
	"github.com/spf13/cobra"
)

var (
	version   = "dev"
	commit    = "unknown"
	buildTime = "unknown"
)

func main() {
	rootCmd := &cobra.Command{
		Use:     "secwin",
		Short:   "SecWin — Modern Kali Tooling on Windows",
		Long:    `SecWin: Unified security toolchain for Windows pentesters. Install, orchestrate, and report — all native.`,
		Version: fmt.Sprintf("%s (commit: %s, built: %s, go: %s, %s/%s)", version, commit, buildTime, runtime.Version(), runtime.GOOS, runtime.GOARCH),
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			return commands.InitializeConfig(cmd)
		},
	}

	rootCmd.SetVersionTemplate(`{{.Version}}
`)

	commands.AddCommands(rootCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

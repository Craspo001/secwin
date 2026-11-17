package commands

import (
	"fmt"

	"github.com/secwin/secwin/internal/wsl"
	"github.com/spf13/cobra"
)

func NewWSLCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "wsl",
		Short: "WSL management commands",
		Long:  `Manage WSL distros and run commands in them.`,
	}

	cmd.AddCommand(
		newWSLListCommand(),
		newWSLInstallCommand(),
		newWSLRunCommand(),
		newWSLSetupCommand(),
	)

	return cmd
}

func newWSLListCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List installed WSL distros",
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := wsl.NewManager(nil)
			distros, err := mgr.ListDistros(cmd.Context())
			if err != nil {
				return err
			}
			if len(distros) == 0 {
				fmt.Println("No WSL distros installed")
				return nil
			}
			fmt.Println("Installed distros:")
			for _, d := range distros {
				fmt.Printf("  %s\n", d)
			}
			return nil
		},
	}
}

func newWSLInstallCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "install <distro>",
		Short: "Install a WSL distro",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := wsl.NewManager(nil)
			distro := args[0]
			fmt.Printf("Installing %s...\n", distro)
			if err := mgr.EnsureDistro(cmd.Context(), distro); err != nil {
				return err
			}
			fmt.Printf("%s installed successfully\n", distro)
			return nil
		},
	}
	return cmd
}

func newWSLRunCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "run <distro> <command>",
		Short: "Run a command in a WSL distro",
		Args:  cobra.MinimumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := wsl.NewManager(nil)
			distro := args[0]
			command := args[1:]
			fullCmd := ""
			for i, part := range command {
				if i > 0 {
					fullCmd += " "
				}
				fullCmd += part
			}
			return mgr.RunCommand(cmd.Context(), distro, fullCmd)
		},
	}
	return cmd
}

func newWSLSetupCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "setup [distro]",
		Short: "Set up a distro with security tools (default: kali-linux)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			mgr := wsl.NewManager(nil)
			distro := "kali-linux"
			if len(args) > 0 {
				distro = args[0]
			}
			fmt.Printf("Setting up %s with security tools...\n", distro)
			if err := mgr.EnsureDistro(cmd.Context(), distro); err != nil {
				return err
			}
			return mgr.SetupKaliTools(cmd.Context(), distro)
		},
	}
	return cmd
}

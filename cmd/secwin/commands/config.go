package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/secwin/secwin/internal/config"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

func NewConfigCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Manage SecWin configuration",
		Long:  `View and modify SecWin configuration.`,
	}

	cmd.AddCommand(
		newConfigShowCommand(),
		newConfigSetCommand(),
		newConfigPathCommand(),
	)

	return cmd
}

func newConfigShowCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "show",
		Short: "Show current configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := config.Load()
			data, _ := yaml.Marshal(cfg)
			fmt.Println(string(data))
			return nil
		},
	}
}

func newConfigSetCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "set <key> <value>",
		Short: "Set a configuration value",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]
			value := args[1]

			cfg := config.Load()
			if err := cfg.Set(key, value); err != nil {
				return err
			}
			return cfg.Save()
		},
	}
	return cmd
}

func newConfigPathCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "path",
		Short: "Show configuration file path",
		RunE: func(cmd *cobra.Command, args []string) error {
			path := config.ConfigPath()
			fmt.Println(path)
			return nil
		},
	}
}

func Initialize(cmd *cobra.Command) error {
	cfg := config.Load()
	if cfg.FirstRun {
		cfg.FirstRun = false
		if err := cfg.Save(); err != nil {
			return err
		}
		fmt.Println("SecWin initialized. Run 'secwin install @core' to install the core toolset.")
	}
	return nil
}

func init() {
	configDir := filepath.Join(os.Getenv("USERPROFILE"), ".secwin")
	os.MkdirAll(configDir, 0755)
}

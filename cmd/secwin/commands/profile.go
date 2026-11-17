package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/secwin/secwin/internal/config"
	"github.com/secwin/secwin/internal/opsec"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

func NewProfileCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "profile",
		Short: "Manage OpSec profiles",
		Long:  `OpSec profiles isolate engagement settings (VPN, MAC, hostname, timezone).`,
	}

	cmd.AddCommand(
		newProfileCreateCommand(),
		newProfileListCommand(),
		newProfileEngageCommand(),
		newProfileDisengageCommand(),
		newProfileShowCommand(),
		newProfileDeleteCommand(),
		newProfileStatusCommand(),
	)

	return cmd
}

func newProfileCreateCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create <name>",
		Short: "Create a new OpSec profile",
		Args:  cobra.ExactArgs(1),
		RunE:  runProfileCreate,
	}

	cmd.Flags().String("vpn", "", "VPN config file (WireGuard/OpenVPN)")
	cmd.Flags().Bool("mac-spoof", false, "Enable MAC address spoofing")
	cmd.Flags().String("hostname", "", "Custom hostname")
	cmd.Flags().String("timezone", "", "Custom timezone")
	cmd.Flags().String("dns", "", "Custom DNS servers")
	cmd.Flags().String("proxy", "", "Proxy URL")

	return cmd
}

func runProfileCreate(cmd *cobra.Command, args []string) error {
	name := args[0]
	vpn, _ := cmd.Flags().GetString("vpn")
	macSpoof, _ := cmd.Flags().GetBool("mac-spoof")
	hostname, _ := cmd.Flags().GetString("hostname")
	timezone, _ := cmd.Flags().GetString("timezone")
	dns, _ := cmd.Flags().GetString("dns")
	proxy, _ := cmd.Flags().GetString("proxy")

	cfg := config.Load()
	if cfg.Profiles == nil {
		cfg.Profiles = make(map[string]config.Profile)
	}

	profile := config.Profile{
		Name:      name,
		VPNConfig: vpn,
		MACspoof:  macSpoof,
		Hostname:  hostname,
		Timezone:  timezone,
		DNS:       dns,
		Proxy:     proxy,
	}

	cfg.Profiles[name] = profile
	if err := cfg.Save(); err != nil {
		return err
	}

	fmt.Printf("Created profile: %s\n", name)
	return nil
}

func newProfileListCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List OpSec profiles",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := config.Load()
			if len(cfg.Profiles) == 0 {
				fmt.Println("No profiles configured")
				return nil
			}
			fmt.Println("OpSec Profiles:")
			for name, p := range cfg.Profiles {
				active := ""
				if cfg.ActiveProfile == name {
					active = " (active)"
				}
				fmt.Printf("  %s%s\n", name, active)
				if p.VPNConfig != "" {
					fmt.Printf("    VPN: %s\n", p.VPNConfig)
				}
				if p.MACspoof {
					fmt.Printf("    MAC Spoof: enabled\n")
				}
				if p.Hostname != "" {
					fmt.Printf("    Hostname: %s\n", p.Hostname)
				}
				if p.Timezone != "" {
					fmt.Printf("    Timezone: %s\n", p.Timezone)
				}
			}
			return nil
		},
	}
}

func newProfileEngageCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "engage <name>",
		Short: "Activate an OpSec profile (applies VPN, MAC, hostname, timezone, DNS, proxy)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]
			cfg := config.Load()
			profile, ok := cfg.Profiles[name]
			if !ok {
				return fmt.Errorf("profile not found: %s", name)
			}

			mgr := opsec.NewManager()
			if err := mgr.Engage(&profile); err != nil {
				return fmt.Errorf("failed to engage profile: %w", err)
			}

			cfg.ActiveProfile = name
			if err := cfg.Save(); err != nil {
				return err
			}

			fmt.Printf("Engaged profile: %s\n", name)
			return nil
		},
	}
}

func newProfileDisengageCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "disengage",
		Short: "Deactivate current OpSec profile (restores original settings)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := config.Load()
			if cfg.ActiveProfile == "" {
				fmt.Println("No active profile")
				return nil
			}

			mgr := opsec.NewManager()
			if err := mgr.Disengage(); err != nil {
				return fmt.Errorf("failed to disengage profile: %w", err)
			}

			fmt.Printf("Disengaged profile: %s\n", cfg.ActiveProfile)
			cfg.ActiveProfile = ""
			return cfg.Save()
		},
	}
}

func newProfileShowCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "show <name>",
		Short: "Show profile details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]
			cfg := config.Load()
			profile, ok := cfg.Profiles[name]
			if !ok {
				return fmt.Errorf("profile not found: %s", name)
			}
			data, _ := yaml.Marshal(profile)
			fmt.Println(string(data))
			return nil
		},
	}
	return cmd
}

func newProfileDeleteCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "delete <name>",
		Short: "Delete an OpSec profile",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]
			cfg := config.Load()
			if _, ok := cfg.Profiles[name]; !ok {
				return fmt.Errorf("profile not found: %s", name)
			}
			if cfg.ActiveProfile == name {
				cfg.ActiveProfile = ""
			}
			delete(cfg.Profiles, name)
			return cfg.Save()
		},
	}
	return cmd
}

func newProfileStatusCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show current OpSec status",
		RunE: func(cmd *cobra.Command, args []string) error {
			status := opsec.CheckOpSecStatus()
			fmt.Println("Current OpSec Status:")
			for k, v := range status {
				fmt.Printf("  %s: %s\n", k, v)
			}

			cfg := config.Load()
			if cfg.ActiveProfile != "" {
				fmt.Printf("\nActive Profile: %s\n", cfg.ActiveProfile)
				if p, ok := cfg.Profiles[cfg.ActiveProfile]; ok {
					if p.VPNConfig != "" {
						fmt.Printf("  VPN Config: %s\n", p.VPNConfig)
					}
					if p.MACspoof {
						fmt.Println("  MAC Spoofing: enabled")
					}
					if p.Hostname != "" {
						fmt.Printf("  Target Hostname: %s\n", p.Hostname)
					}
					if p.Timezone != "" {
						fmt.Printf("  Target Timezone: %s\n", p.Timezone)
					}
					if p.DNS != "" {
						fmt.Printf("  Target DNS: %s\n", p.DNS)
					}
					if p.Proxy != "" {
						fmt.Printf("  Target Proxy: %s\n", p.Proxy)
					}
				}
			} else {
				fmt.Println("\nNo active profile")
			}
			return nil
		},
	}
}

func ProfileConfigDir() string {
	return filepath.Join(os.Getenv("USERPROFILE"), ".secwin", "profiles")
}

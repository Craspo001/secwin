package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/secwin/secwin/internal/installer"
	"github.com/secwin/secwin/internal/manifest"
	"github.com/secwin/secwin/internal/playbook"
	"github.com/secwin/secwin/internal/wsl"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

func NewPlaybookCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "playbook",
		Short: "Manage and run playbooks",
		Long:  `Playbooks automate security engagements. Run built-in or custom playbooks.`,
	}

	cmd.AddCommand(
		newPlaybookRunCommand(),
		newPlaybookListCommand(),
		newPlaybookValidateCommand(),
		newPlaybookInitCommand(),
	)

	return cmd
}

func newPlaybookRunCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "run <playbook> [flags]",
		Short: "Run a playbook",
		Args:  cobra.ExactArgs(1),
		RunE:  runPlaybookRun,
	}

	cmd.Flags().StringSlice("var", nil, "Set variables (key=value)")
	cmd.Flags().String("output", "", "Output directory")
	cmd.Flags().String("config", "", "Config file with variables")
	cmd.Flags().Bool("dry-run", false, "Validate and show execution plan without running")

	return cmd
}

func runPlaybookRun(cmd *cobra.Command, args []string) error {
	playbookName := args[0]
	varSlice, _ := cmd.Flags().GetStringSlice("var")
	outputDir, _ := cmd.Flags().GetString("output")
	configFile, _ := cmd.Flags().GetString("config")
	dryRun, _ := cmd.Flags().GetBool("dry-run")

	vars := make(map[string]interface{})
	for _, v := range varSlice {
		parts := strings.SplitN(v, "=", 2)
		if len(parts) == 2 {
			vars[parts[0]] = parts[1]
		}
	}

	if configFile != "" {
		data, err := os.ReadFile(configFile)
		if err != nil {
			return fmt.Errorf("read config: %w", err)
		}
		var fileVars map[string]interface{}
		if err := yaml.Unmarshal(data, &fileVars); err != nil {
			return fmt.Errorf("parse config: %w", err)
		}
		for k, v := range fileVars {
			vars[k] = v
		}
	}

	pb, err := loadPlaybook(playbookName)
	if err != nil {
		return err
	}

	if err := pb.Validate(); err != nil {
		return fmt.Errorf("invalid playbook: %w", err)
	}

	if outputDir == "" {
		outputDir = filepath.Join(".", "engagements", pb.Metadata.Name)
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}
	vars["output_dir"] = outputDir

	loader := manifest.NewLoader()
	reg := installer.NewRegistry()
	reg.Register(installer.NewScoopInstaller())
	reg.Register(installer.NewChocolateyInstaller())
	reg.Register(installer.NewBinaryInstaller())
	reg.Register(installer.NewGitHubInstaller())
	reg.Register(installer.NewScriptInstaller())

	wslManager := wsl.NewManager(nil)
	executor := playbook.NewExecutor(pb, loader, reg, wslManager, outputDir)

	if dryRun {
		fmt.Printf("Dry run for playbook: %s\n", pb.Metadata.Name)
		fmt.Printf("Steps: %d\n", len(pb.Steps))
		for _, step := range pb.Steps {
			fmt.Printf("  - %s (%s)\n", step.ID, step.Name)
		}
		return nil
	}

	fmt.Printf("Running playbook: %s\n", pb.Metadata.Name)
	result := executor.Execute(vars)

	if result.Success {
		fmt.Printf("Playbook completed successfully in %v\n", result.Duration)
		if result.ReportPath != "" {
			fmt.Printf("Report: %s\n", result.ReportPath)
		}
	} else {
		fmt.Printf("Playbook failed: %s\n", result.Error)
		return fmt.Errorf("playbook failed")
	}

	return nil
}

func newPlaybookListCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List available playbooks",
		RunE: func(cmd *cobra.Command, args []string) error {
			playbooksDir := "playbooks"
			entries, err := os.ReadDir(playbooksDir)
			if err != nil {
				return err
			}
			fmt.Println("Available playbooks:")
			for _, entry := range entries {
				if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".yaml") {
					name := strings.TrimSuffix(entry.Name(), ".yaml")
					fmt.Printf("  %s\n", name)
				}
			}
			return nil
		},
	}
}

func newPlaybookValidateCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "validate <playbook>",
		Short: "Validate a playbook file",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			pb, err := loadPlaybook(args[0])
			if err != nil {
				return err
			}
			if err := pb.Validate(); err != nil {
				return err
			}
			fmt.Println("Playbook is valid")
			return nil
		},
	}
	return cmd
}

func newPlaybookInitCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "init <name>",
		Short: "Create a new playbook scaffold",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]
			pb := &playbook.Playbook{
				Metadata: playbook.Metadata{
					Name:        name,
					Version:     "1.0",
					Description: "Custom playbook",
				},
				Variables: map[string]playbook.Variable{
					"target": {Type: "string", Required: true, Description: "Target domain or IP"},
				},
				Steps: []playbook.Step{
					{ID: "recon", Name: "Reconnaissance", Tool: "nuclei", Args: []string{"-target", "{{.target}}"}},
				},
			}
			data, _ := yaml.Marshal(pb)
			path := filepath.Join("playbooks", name+".yaml")
			if err := os.MkdirAll("playbooks", 0755); err != nil {
				return err
			}
			return os.WriteFile(path, data, 0644)
		},
	}
	return cmd
}

func loadPlaybook(name string) (*playbook.Playbook, error) {
	paths := []string{
		name + ".yaml",
		name + ".yml",
		filepath.Join("playbooks", name+".yaml"),
		filepath.Join("playbooks", name+".yml"),
	}

	var data []byte
	var err error
	for _, path := range paths {
		data, err = os.ReadFile(path)
		if err == nil {
			break
		}
	}
	if err != nil {
		return nil, fmt.Errorf("playbook not found: %s", name)
	}

	var pb playbook.Playbook
	if err := yaml.Unmarshal(data, &pb); err != nil {
		return nil, fmt.Errorf("parse playbook: %w", err)
	}
	return &pb, nil
}

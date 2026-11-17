package commands

import (
	"fmt"

	"github.com/rodaine/table"
	"github.com/secwin/secwin/internal/manifest"
	"github.com/spf13/cobra"
)

func NewListCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list [category]",
		Short: "List available tools",
		Args:  cobra.MaximumNArgs(1),
		RunE:  runList,
	}

	cmd.Flags().Bool("installed", false, "Show only installed tools")
	cmd.Flags().String("category", "", "Filter by category")
	cmd.Flags().Bool("verbose", false, "Show detailed information")

	return cmd
}

func runList(cmd *cobra.Command, args []string) error {
	installedOnly, _ := cmd.Flags().GetBool("installed")
	category, _ := cmd.Flags().GetString("category")
	verbose, _ := cmd.Flags().GetBool("verbose")

	if category == "" && len(args) > 0 {
		category = args[0]
	}

	loader := manifest.NewLoader()
	tools := loader.List(category)

	if len(tools) == 0 {
		fmt.Println("No tools found")
		return nil
	}

	tbl := table.New("Name", "Version", "Category", "Description")

	for _, tm := range tools {
		if installedOnly {
			continue
		}
		desc := tm.Description
		if len(desc) > 60 {
			desc = desc[:57] + "..."
		}
		tbl.AddRow(tm.Name, tm.Version, tm.Category, desc)
	}

	tbl.Print()

	if verbose {
		for _, tm := range tools {
			fmt.Printf("\n%s (%s)\n", tm.Name, tm.Version)
			fmt.Printf("  Category: %s\n", tm.Category)
			fmt.Printf("  Description: %s\n", tm.Description)
			fmt.Printf("  Homepage: %s\n", tm.Homepage)
			fmt.Printf("  License: %s\n", tm.License)
			fmt.Printf("  Install Methods:\n")
			for _, im := range tm.InstallMethods {
				fmt.Printf("    - %s (priority: %d)\n", im.Method, im.Priority)
			}
		}
	}

	return nil
}

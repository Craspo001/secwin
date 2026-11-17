package commands

import (
	"fmt"

	"github.com/rodaine/table"
	"github.com/secwin/secwin/internal/manifest"
	"github.com/spf13/cobra"
)

func NewSearchCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "search <query>",
		Short: "Search for tools",
		Args:  cobra.ExactArgs(1),
		RunE:  runSearch,
	}

	cmd.Flags().Bool("verbose", false, "Show detailed information")

	return cmd
}

func runSearch(cmd *cobra.Command, args []string) error {
	query := args[0]
	verbose, _ := cmd.Flags().GetBool("verbose")

	loader := manifest.NewLoader()
	results := loader.Search(query)

	if len(results) == 0 {
		fmt.Printf("No tools found matching: %s\n", query)
		return nil
	}

	tbl := table.New("Name", "Version", "Category", "Description")
	for _, tm := range results {
		desc := tm.Description
		if len(desc) > 60 {
			desc = desc[:57] + "..."
		}
		tbl.AddRow(tm.Name, tm.Version, tm.Category, desc)
	}
	tbl.Print()

	if verbose {
		for _, tm := range results {
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

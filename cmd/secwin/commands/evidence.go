package commands

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/secwin/secwin/internal/playbook"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

func NewEvidenceCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "evidence",
		Short: "Manage evidence locker",
		Long:  `Evidence locker commands for verifying and managing collected artifacts.`,
	}

	cmd.AddCommand(
		newEvidenceVerifyCommand(),
		newEvidenceListCommand(),
		newEvidenceShowCommand(),
		newEvidenceExportCommand(),
	)

	return cmd
}

func newEvidenceVerifyCommand() *cobra.Command {
	var (
		evidenceDir string
		manifest    string
		strict      bool
	)

	cmd := &cobra.Command{
		Use:   "verify [path]",
		Short: "Verify evidence integrity via SHA256",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if evidenceDir == "" {
				if len(args) > 0 {
					evidenceDir = args[0]
				} else {
					home, _ := os.UserHomeDir()
					evidenceDir = filepath.Join(home, ".secwin", "evidence")
				}
			}

			fmt.Printf("Verifying evidence in: %s\n\n", evidenceDir)

			verified := 0
			failed := 0
			missing := 0

			err := filepath.WalkDir(evidenceDir, func(path string, d os.DirEntry, err error) error {
				if err != nil {
					return err
				}
				if d.IsDir() {
					return nil
				}

				// Skip manifest files
				if strings.HasSuffix(path, ".manifest") || strings.HasSuffix(path, ".json") {
					return nil
				}

				// Compute SHA256
				hash := sha256.New()
				f, err := os.Open(path)
				if err != nil {
					fmt.Printf("  ❌ %s: cannot open - %v\n", path, err)
					failed++
					return nil
				}
				defer f.Close()

				if _, err := io.Copy(hash, f); err != nil {
					fmt.Printf("  ❌ %s: hash failed - %v\n", path, err)
					failed++
					return nil
				}

				sha256sum := hex.EncodeToString(hash.Sum(nil))

				// Check for companion .sha256 file
				shaFile := path + ".sha256"
				if _, err := os.Stat(shaFile); err == nil {
					expectedBytes, _ := os.ReadFile(shaFile)
					expected := strings.TrimSpace(string(expectedBytes))
					if strings.HasPrefix(expected, "sha256:") {
						expected = expected[7:]
					}
					if strings.EqualFold(sha256sum, expected) {
						fmt.Printf("  ✅ %s: %s...\n", filepath.Base(path), sha256sum[:16])
						verified++
					} else {
						fmt.Printf("  ❌ %s: MISMATCH (expected %s..., got %s...)\n",
							filepath.Base(path), expected[:16], sha256sum[:16])
						failed++
					}
				} else {
					fmt.Printf("  ⚠️  %s: %s... (no checksum file)\n", filepath.Base(path), sha256sum[:16])
					if strict {
						failed++
					} else {
						verified++
					}
				}

				return nil
			})

			if err != nil {
				return err
			}

			fmt.Printf("\nSummary: %d verified, %d failed, %d missing checksums\n", verified, failed, missing)
			if failed > 0 {
				return fmt.Errorf("verification failed: %d artifacts failed", failed)
			}
			return nil
		},
	}

	cmd.Flags().StringVarP(&evidenceDir, "dir", "d", "", "Evidence directory (default: ~/.secwin/evidence)")
	cmd.Flags().StringVarP(&manifest, "manifest", "m", "", "Manifest file to verify against")
	cmd.Flags().BoolVar(&strict, "strict", false, "Fail on missing checksum files")

	return cmd
}

func newEvidenceListCommand() *cobra.Command {
	var evidenceDir string

	cmd := &cobra.Command{
		Use:   "list [path]",
		Short: "List evidence artifacts",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if evidenceDir == "" {
				if len(args) > 0 {
					evidenceDir = args[0]
				} else {
					home, _ := os.UserHomeDir()
					evidenceDir = filepath.Join(home, ".secwin", "evidence")
				}
			}

			fmt.Printf("Evidence in: %s\n\n", evidenceDir)

			return filepath.WalkDir(evidenceDir, func(path string, d os.DirEntry, err error) error {
				if err != nil {
					return err
				}
				if d.IsDir() {
					return nil
				}

				if strings.HasSuffix(path, ".sha256") || strings.HasSuffix(path, ".manifest") {
					return nil
				}

				info, _ := d.Info()
				ext := filepath.Ext(path)
				fmt.Printf("  %s (%s, %d bytes)\n", filepath.Base(path), ext, info.Size())
				return nil
			})
		},
	}

	cmd.Flags().StringVarP(&evidenceDir, "dir", "d", "", "Evidence directory")

	return cmd
}

func newEvidenceShowCommand() *cobra.Command {
	var evidenceDir string

	cmd := &cobra.Command{
		Use:   "show <artifact>",
		Short: "Show artifact details including SHA256",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if evidenceDir == "" {
				home, _ := os.UserHomeDir()
				evidenceDir = filepath.Join(home, ".secwin", "evidence")
			}

			artifactName := args[0]
			artifactPath := filepath.Join(evidenceDir, artifactName)

			if _, err := os.Stat(artifactPath); err != nil {
				return fmt.Errorf("artifact not found: %s", artifactPath)
			}

			// Compute SHA256
			hash := sha256.New()
			f, err := os.Open(artifactPath)
			if err != nil {
				return err
			}
			defer f.Close()
			io.Copy(hash, f)
			sha256sum := hex.EncodeToString(hash.Sum(nil))

			info, _ := os.Stat(artifactPath)

			fmt.Printf("Artifact: %s\n", artifactName)
			fmt.Printf("Path: %s\n", artifactPath)
			fmt.Printf("Size: %d bytes\n", info.Size())
			fmt.Printf("Modified: %s\n", info.ModTime().Format("2006-01-02 15:04:05"))
			fmt.Printf("SHA256: %s\n", sha256sum)

			// Check for manifest
			manifestPath := artifactPath + ".manifest"
			if data, err := os.ReadFile(manifestPath); err == nil {
				fmt.Printf("\nManifest:\n%s\n", string(data))
			}

			return nil
		},
	}

	cmd.Flags().StringVarP(&evidenceDir, "dir", "d", "", "Evidence directory")

	return cmd
}

func newEvidenceExportCommand() *cobra.Command {
	var (
		evidenceDir string
		output      string
		format      string
	)

	cmd := &cobra.Command{
		Use:   "export",
		Short: "Export evidence manifest",
		RunE: func(cmd *cobra.Command, args []string) error {
			if evidenceDir == "" {
				home, _ := os.UserHomeDir()
				evidenceDir = filepath.Join(home, ".secwin", "evidence")
			}

			if output == "" {
				output = filepath.Join(evidenceDir, "manifest.json")
			}

			manifest := playbook.EvidenceManifest{
				GeneratedAt: time.Now().Format(time.RFC3339),
				EvidenceDir: evidenceDir,
				Artifacts:   []playbook.EvidenceArtifact{},
			}

			filepath.WalkDir(evidenceDir, func(path string, d os.DirEntry, err error) error {
				if err != nil || d.IsDir() {
					return err
				}
				if strings.HasSuffix(path, ".sha256") || strings.HasSuffix(path, ".manifest") {
					return nil
				}

				hash := sha256.New()
				f, _ := os.Open(path)
				io.Copy(hash, f)
				f.Close()
				sha256sum := hex.EncodeToString(hash.Sum(nil))

				info, _ := d.Info()
				manifest.Artifacts = append(manifest.Artifacts, playbook.EvidenceArtifact{
					Name:      filepath.Base(path),
					Path:      path,
					SHA256:    sha256sum,
					Size:      info.Size(),
					Timestamp: info.ModTime(),
				})
				return nil
			})

			// Write manifest
			var data []byte
			var err error
			switch format {
			case "yaml", "yml":
				data, err = yaml.Marshal(manifest)
			case "json":
				fallthrough
			default:
				data, err = json.MarshalIndent(manifest, "", "  ")
			}

			if err != nil {
				return fmt.Errorf("marshal manifest: %w", err)
			}

			if err := os.WriteFile(output, data, 0644); err != nil {
				return fmt.Errorf("write manifest: %w", err)
			}

			fmt.Printf("Exported manifest to: %s (%d artifacts)\n", output, len(manifest.Artifacts))
			return nil
		},
	}

	cmd.Flags().StringVarP(&evidenceDir, "dir", "d", "", "Evidence directory")
	cmd.Flags().StringVarP(&output, "output", "o", "", "Output manifest file")
	cmd.Flags().StringVarP(&format, "format", "f", "json", "Output format (json, yaml)")

	return cmd
}

package installer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/secwin/secwin/internal/manifest"
)

type GitHubInstaller struct{}

func NewGitHubInstaller() *GitHubInstaller {
	return &GitHubInstaller{}
}

func (g *GitHubInstaller) Name() string {
	return string(manifest.InstallMethodGitHub)
}

func (g *GitHubInstaller) IsAvailable(ctx context.Context) bool {
	_, err := RunCommandOutput(ctx, "git", "--version")
	return err == nil
}

func (g *GitHubInstaller) Install(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	if im.Source == "" {
		return fmt.Errorf("source (repo URL) required for github install")
	}

	toolDir := ToolDir(tm.Name)
	if err := EnsureDir(toolDir); err != nil {
		return err
	}

	repoURL := im.Source
	if !strings.HasPrefix(repoURL, "http") {
		repoURL = "https://github.com/" + repoURL
	}

	cloneOpts := &git.CloneOptions{
		URL:               repoURL,
		Depth:             1,
		RecurseSubmodules: git.DefaultSubmoduleRecursionDepth,
	}

	if im.Version != "" {
		cloneOpts.ReferenceName = plumbing.ReferenceName("refs/tags/" + im.Version)
		if strings.HasPrefix(im.Version, "v") {
			cloneOpts.ReferenceName = plumbing.ReferenceName("refs/tags/" + im.Version)
		}
	}

	_, err := git.PlainCloneContext(ctx, toolDir, false, cloneOpts)
	if err != nil {
		return fmt.Errorf("git clone failed: %w", err)
	}

	if im.PostCommands != nil {
		for _, cmd := range im.PostCommands {
			if err := RunCommandWithEnv(ctx, im.Env, "powershell", "-Command", cmd); err != nil {
				return fmt.Errorf("post-command failed: %w", err)
			}
		}
	}

	if im.ExtractPath != "" {
		binaryPath := filepath.Join(toolDir, im.ExtractPath)
		binDir := BinDir()
		if err := EnsureDir(binDir); err != nil {
			return err
		}
		entries, err := os.ReadDir(binaryPath)
		if err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					continue
				}
				src := filepath.Join(binaryPath, entry.Name())
				dst := filepath.Join(binDir, entry.Name())
				if err := copyFile(src, dst); err != nil {
					continue
				}
				os.Chmod(dst, 0755)
			}
		}
	}

	return nil
}

func (g *GitHubInstaller) Uninstall(ctx context.Context, tm *manifest.ToolManifest) error {
	toolDir := ToolDir(tm.Name)
	return os.RemoveAll(toolDir)
}

func (g *GitHubInstaller) Update(ctx context.Context, tm *manifest.ToolManifest, im *manifest.InstallMethodEntry) error {
	toolDir := ToolDir(tm.Name)
	if _, err := os.Stat(toolDir); os.IsNotExist(err) {
		return g.Install(ctx, tm, im)
	}

	repo, err := git.PlainOpen(toolDir)
	if err != nil {
		return fmt.Errorf("open repo failed: %w", err)
	}

	w, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("worktree failed: %w", err)
	}

	if err := w.PullContext(ctx, &git.PullOptions{RemoteName: "origin"}); err != nil && err != git.NoErrAlreadyUpToDate {
		return fmt.Errorf("git pull failed: %w", err)
	}

	if im.Version != "" {
		tagRef := plumbing.ReferenceName("refs/tags/" + im.Version)
		if strings.HasPrefix(im.Version, "v") {
			tagRef = plumbing.ReferenceName("refs/tags/" + im.Version)
		}
		hash, err := repo.Reference(tagRef, true)
		if err == nil {
			w.Checkout(&git.CheckoutOptions{Hash: hash.Hash()})
		}
	}

	return nil
}

func (g *GitHubInstaller) GetInstalledVersion(ctx context.Context, tm *manifest.ToolManifest) (string, error) {
	toolDir := ToolDir(tm.Name)
	repo, err := git.PlainOpen(toolDir)
	if err != nil {
		return "", ErrToolNotFound
	}

	head, err := repo.Head()
	if err != nil {
		return "", err
	}

	tags, err := repo.Tags()
	if err != nil {
		return head.Hash().String()[:8], nil
	}

	var latestTag string
	tags.ForEach(func(ref *plumbing.Reference) error {
		name := ref.Name().Short()
		if latestTag == "" || name > latestTag {
			latestTag = name
		}
		return nil
	})

	if latestTag != "" {
		return latestTag, nil
	}
	return head.Hash().String()[:8], nil
}

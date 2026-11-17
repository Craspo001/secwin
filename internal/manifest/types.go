package manifest

import (
	"encoding/json"
	"time"
)

type InstallMethod string

const (
	InstallMethodScoop      InstallMethod = "scoop"
	InstallMethodChocolatey InstallMethod = "chocolatey"
	InstallMethodWSL        InstallMethod = "wsl"
	InstallMethodBinary     InstallMethod = "binary"
	InstallMethodScript     InstallMethod = "script"
	InstallMethodGitHub     InstallMethod = "github"
)

type Platform string

const (
	PlatformWindows Platform = "windows"
	PlatformLinux   Platform = "linux"
	PlatformDarwin  Platform = "darwin"
	PlatformAll     Platform = "all"
)

type Architecture string

const (
	ArchAMD64 Architecture = "amd64"
	ArchARM64 Architecture = "arm64"
	Arch386   Architecture = "386"
	ArchAll   Architecture = "all"
)

type ToolManifest struct {
	Name           string               `json:"name" yaml:"name"`
	Version        string               `json:"version" yaml:"version"`
	Description    string               `json:"description" yaml:"description"`
	Category       string               `json:"category" yaml:"category"`
	Homepage       string               `json:"homepage,omitempty" yaml:"homepage,omitempty"`
	Repository     string               `json:"repository,omitempty" yaml:"repository,omitempty"`
	License        string               `json:"license,omitempty" yaml:"license,omitempty"`
	Tags           []string             `json:"tags,omitempty" yaml:"tags,omitempty"`
	Aliases        []string             `json:"aliases,omitempty" yaml:"aliases,omitempty"`
	InstallMethods []InstallMethodEntry `json:"install_methods" yaml:"install_methods"`
	Dependencies   []string             `json:"dependencies,omitempty" yaml:"dependencies,omitempty"`
	Conflicts      []string             `json:"conflicts,omitempty" yaml:"conflicts,omitempty"`
	Provides       []string             `json:"provides,omitempty" yaml:"provides,omitempty"`
	PostInstall    *PostInstallSpec     `json:"post_install,omitempty" yaml:"post_install,omitempty"`
	Environment    map[string]string    `json:"environment,omitempty" yaml:"environment,omitempty"`
	WSLPreferred   bool                 `json:"wsl_preferred,omitempty" yaml:"wsl_preferred,omitempty"`
	WSLDistro      string               `json:"wsl_distro,omitempty" yaml:"wsl_distro,omitempty"`
	Checksums      map[string]string    `json:"checksums,omitempty" yaml:"checksums,omitempty"`
	MinVersion     string               `json:"min_version,omitempty" yaml:"min_version,omitempty"`
	MaxVersion     string               `json:"max_version,omitempty" yaml:"max_version,omitempty"`
	Deprecated     bool                 `json:"deprecated,omitempty" yaml:"deprecated,omitempty"`
	Replacement    string               `json:"replacement,omitempty" yaml:"replacement,omitempty"`
	Maintainers    []string             `json:"maintainers,omitempty" yaml:"maintainers,omitempty"`
	CreatedAt      time.Time            `json:"created_at,omitempty" yaml:"created_at,omitempty"`
	UpdatedAt      time.Time            `json:"updated_at,omitempty" yaml:"updated_at,omitempty"`
}

type InstallMethodEntry struct {
	Method        InstallMethod     `json:"method" yaml:"method"`
	Priority      int               `json:"priority,omitempty" yaml:"priority,omitempty"`
	Platforms     []Platform        `json:"platforms,omitempty" yaml:"platforms,omitempty"`
	Architectures []Architecture    `json:"architectures,omitempty" yaml:"architectures,omitempty"`
	Source        string            `json:"source,omitempty" yaml:"source,omitempty"`
	Version       string            `json:"version,omitempty" yaml:"version,omitempty"`
	Checksum      string            `json:"checksum,omitempty" yaml:"checksum,omitempty"`
	ExtractPath   string            `json:"extract_path,omitempty" yaml:"extract_path,omitempty"`
	BinaryName    string            `json:"binary_name,omitempty" yaml:"binary_name,omitempty"`
	Args          []string          `json:"args,omitempty" yaml:"args,omitempty"`
	Script        string            `json:"script,omitempty" yaml:"script,omitempty"`
	Env           map[string]string `json:"env,omitempty" yaml:"env,omitempty"`
	PreCommands   []string          `json:"pre_commands,omitempty" yaml:"pre_commands,omitempty"`
	PostCommands  []string          `json:"post_commands,omitempty" yaml:"post_commands,omitempty"`
	Condition     string            `json:"condition,omitempty" yaml:"condition,omitempty"`
}

type PostInstallSpec struct {
	Commands      []string          `json:"commands,omitempty" yaml:"commands,omitempty"`
	Environment   map[string]string `json:"environment,omitempty" yaml:"environment,omitempty"`
	PathAdditions []string          `json:"path_additions,omitempty" yaml:"path_additions,omitempty"`
	VerifyCommand string            `json:"verify_command,omitempty" yaml:"verify_command,omitempty"`
}

type ManifestIndex struct {
	Version     string                   `json:"version" yaml:"version"`
	GeneratedAt time.Time                `json:"generated_at" yaml:"generated_at"`
	Tools       map[string]*ToolManifest `json:"tools" yaml:"tools"`
	Categories  map[string][]string      `json:"categories,omitempty" yaml:"categories,omitempty"`
}

func (m *ToolManifest) GetInstallMethod(platform Platform, arch Architecture) *InstallMethodEntry {
	best := &InstallMethodEntry{Priority: -1}
	for i := range m.InstallMethods {
		im := &m.InstallMethods[i]
		if im.Priority <= best.Priority {
			continue
		}
		if len(im.Platforms) > 0 {
			found := false
			for _, p := range im.Platforms {
				if p == platform || p == PlatformAll {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		if len(im.Architectures) > 0 {
			found := false
			for _, a := range im.Architectures {
				if a == arch || a == ArchAll {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		if im.Condition != "" {
			// TODO: evaluate condition
		}
		best = im
	}
	if best.Priority == -1 {
		return nil
	}
	return best
}

func (m *ToolManifest) MarshalJSON() ([]byte, error) {
	type Alias ToolManifest
	return json.Marshal(&struct {
		*Alias
		CreatedAt string `json:"created_at,omitempty"`
		UpdatedAt string `json:"updated_at,omitempty"`
	}{
		Alias:     (*Alias)(m),
		CreatedAt: m.CreatedAt.Format(time.RFC3339),
		UpdatedAt: m.UpdatedAt.Format(time.RFC3339),
	})
}

func (m *ToolManifest) UnmarshalJSON(data []byte) error {
	type Alias ToolManifest
	aux := &struct {
		*Alias
		CreatedAt string `json:"created_at,omitempty"`
		UpdatedAt string `json:"updated_at,omitempty"`
	}{
		Alias: (*Alias)(m),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	if aux.CreatedAt != "" {
		t, err := time.Parse(time.RFC3339, aux.CreatedAt)
		if err != nil {
			return err
		}
		m.CreatedAt = t
	}
	if aux.UpdatedAt != "" {
		t, err := time.Parse(time.RFC3339, aux.UpdatedAt)
		if err != nil {
			return err
		}
		m.UpdatedAt = t
	}
	return nil
}

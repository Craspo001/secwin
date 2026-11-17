package manifest

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

type Loader struct {
	mu           sync.RWMutex
	index        *ManifestIndex
	manifestDirs []string
	cache        map[string]*ToolManifest
}

func NewLoader(customDirs ...string) *Loader {
	l := &Loader{
		manifestDirs: append([]string{"manifests"}, customDirs...),
		cache:        make(map[string]*ToolManifest),
	}
	l.loadEmbedded()
	for _, dir := range customDirs {
		l.loadDirectory(dir)
	}
	l.buildIndex()
	return l
}

func (l *Loader) loadEmbedded() {
	// Try to load from manifests directory relative to binary or working directory
	dirs := []string{
		"manifests",
		filepath.Join("..", "manifests"),
		filepath.Join("..", "..", "manifests"),
	}
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".yaml") {
				continue
			}
			data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
			if err != nil {
				continue
			}
			var tm ToolManifest
			if err := yaml.Unmarshal(data, &tm); err != nil {
				continue
			}
			l.cache[tm.Name] = &tm
		}
		return // Found and loaded from one directory
	}
}

func (l *Loader) loadDirectory(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".yaml") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		var tm ToolManifest
		if err := yaml.Unmarshal(data, &tm); err != nil {
			continue
		}
		l.cache[tm.Name] = &tm
	}
}

func (l *Loader) buildIndex() {
	l.mu.Lock()
	defer l.mu.Unlock()

	index := &ManifestIndex{
		Version:     "1.0",
		GeneratedAt: time.Now(),
		Tools:       make(map[string]*ToolManifest),
		Categories:  make(map[string][]string),
	}

	for name, tm := range l.cache {
		index.Tools[name] = tm
		if tm.Category != "" {
			index.Categories[tm.Category] = append(index.Categories[tm.Category], name)
		}
		for _, alias := range tm.Aliases {
			index.Tools[alias] = tm
		}
	}
	l.index = index
}

func (l *Loader) Get(name string) (*ToolManifest, bool) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	tm, ok := l.cache[strings.ToLower(name)]
	return tm, ok
}

func (l *Loader) GetByAlias(alias string) (*ToolManifest, bool) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	for _, tm := range l.cache {
		for _, a := range tm.Aliases {
			if strings.EqualFold(a, alias) {
				return tm, true
			}
		}
	}
	return nil, false
}

func (l *Loader) List(category string) []*ToolManifest {
	l.mu.RLock()
	defer l.mu.RUnlock()

	var result []*ToolManifest
	if category != "" {
		for _, name := range l.index.Categories[category] {
			if tm, ok := l.cache[name]; ok {
				result = append(result, tm)
			}
		}
	} else {
		seen := make(map[string]bool)
		for _, tm := range l.cache {
			if !seen[tm.Name] {
				result = append(result, tm)
				seen[tm.Name] = true
			}
		}
	}
	return result
}

func (l *Loader) Search(query string) []*ToolManifest {
	l.mu.RLock()
	defer l.mu.RUnlock()

	query = strings.ToLower(query)
	var result []*ToolManifest
	for _, tm := range l.cache {
		if strings.Contains(strings.ToLower(tm.Name), query) ||
			strings.Contains(strings.ToLower(tm.Description), query) ||
			strings.Contains(strings.ToLower(tm.Category), query) {
			result = append(result, tm)
		}
	}
	return result
}

func (l *Loader) GetIndex() *ManifestIndex {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.index
}

func (l *Loader) ValidateAll() []error {
	l.mu.RLock()
	defer l.mu.RUnlock()

	var errors []error
	for name, tm := range l.cache {
		if err := tm.Validate(); err != nil {
			errors = append(errors, fmt.Errorf("%s: %w", name, err))
		}
	}
	return errors
}

func (tm *ToolManifest) Validate() error {
	if tm.Name == "" {
		return fmt.Errorf("name is required")
	}
	if tm.Version == "" {
		return fmt.Errorf("version is required")
	}
	if len(tm.InstallMethods) == 0 {
		return fmt.Errorf("at least one install method required")
	}
	for i, im := range tm.InstallMethods {
		if im.Method == "" {
			return fmt.Errorf("install_method[%d]: method required", i)
		}
		if im.Method == InstallMethodBinary && im.Source == "" {
			return fmt.Errorf("install_method[%d]: source required for binary", i)
		}
		if im.Method == InstallMethodGitHub && im.Source == "" {
			return fmt.Errorf("install_method[%d]: source required for github", i)
		}
		if im.Method == InstallMethodScoop && im.Source == "" {
			return fmt.Errorf("install_method[%d]: source required for scoop", i)
		}
		if im.Method == InstallMethodChocolatey && im.Source == "" {
			return fmt.Errorf("install_method[%d]: source required for chocolatey", i)
		}
		if im.Method == InstallMethodWSL && im.Source == "" {
			return fmt.Errorf("install_method[%d]: source required for wsl", i)
		}
	}
	return nil
}

func (l *Loader) ExportIndex(path string) error {
	l.mu.RLock()
	defer l.mu.RUnlock()

	data, err := json.MarshalIndent(l.index, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func LoadManifestFile(path string) (*ToolManifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var tm ToolManifest
	if strings.HasSuffix(path, ".json") {
		err = json.Unmarshal(data, &tm)
	} else {
		err = yaml.Unmarshal(data, &tm)
	}
	return &tm, err
}

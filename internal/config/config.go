package config

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	FirstRun      bool               `mapstructure:"first_run"`
	ToolDir       string             `mapstructure:"tool_dir"`
	BinDir        string             `mapstructure:"bin_dir"`
	ManifestDirs  []string           `mapstructure:"manifest_dirs"`
	WSL           *WSLConfig         `mapstructure:"wsl"`
	Profiles      map[string]Profile `mapstructure:"profiles"`
	ActiveProfile string             `mapstructure:"active_profile"`
	Network       *NetworkConfig     `mapstructure:"network"`
	Reporting     *ReportingConfig   `mapstructure:"reporting"`
}

type WSLConfig struct {
	DefaultDistro string            `mapstructure:"default_distro"`
	Environment   map[string]string `mapstructure:"environment"`
	MountDrives   []string          `mapstructure:"mount_drives"`
}

type NetworkConfig struct {
	DefaultInterface string `mapstructure:"default_interface"`
	ProxyURL         string `mapstructure:"proxy_url"`
	NoProxy          string `mapstructure:"no_proxy"`
}

type ReportingConfig struct {
	DefaultTemplate       string   `mapstructure:"default_template"`
	OutputFormats         []string `mapstructure:"output_formats"`
	EvidenceRetentionDays int      `mapstructure:"evidence_retention_days"`
	OllamaURL             string   `mapstructure:"ollama_url"`
	OllamaModel           string   `mapstructure:"ollama_model"`
}

type Profile struct {
	Name      string `mapstructure:"name"`
	VPNConfig string `mapstructure:"vpn_config"`
	MACspoof  bool   `mapstructure:"mac_spoof"`
	Hostname  string `mapstructure:"hostname"`
	Timezone  string `mapstructure:"timezone"`
	DNS       string `mapstructure:"dns"`
	Proxy     string `mapstructure:"proxy"`
}

var cfg *Config

func Load() *Config {
	if cfg != nil {
		return cfg
	}

	// Ensure config directory exists
	EnsureDirs()

	configPath := ConfigPath()
	// Create default config file if it doesn't exist
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		defaultCfg := &Config{
			FirstRun:      true,
			ToolDir:       ToolDir(),
			BinDir:        BinDir(),
			ManifestDirs:  []string{"manifests"},
			WSL:           &WSLConfig{DefaultDistro: "kali-linux"},
			Network:       &NetworkConfig{NoProxy: "localhost,127.0.0.1,::1"},
			Reporting:     &ReportingConfig{
				DefaultTemplate:       "default",
				OutputFormats:         []string{"markdown", "html", "pdf"},
				EvidenceRetentionDays: 90,
				OllamaURL:             "http://localhost:11434",
				OllamaModel:           "llama3.1:8b",
			},
		}
		if err := defaultCfg.Save(); err != nil {
			// If save fails, continue with defaults
		}
	}

	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(ConfigDir())
	v.AddConfigPath(".")

	v.SetDefault("first_run", true)
	v.SetDefault("tool_dir", ToolDir())
	v.SetDefault("bin_dir", BinDir())
	v.SetDefault("manifest_dirs", []string{"manifests"})
	v.SetDefault("wsl.default_distro", "kali-linux")
	v.SetDefault("network.no_proxy", "localhost,127.0.0.1,::1")
	v.SetDefault("reporting.default_template", "default")
	v.SetDefault("reporting.output_formats", []string{"markdown", "html", "pdf"})
	v.SetDefault("reporting.evidence_retention_days", 90)
	v.SetDefault("reporting.ollama_url", "http://localhost:11434")
	v.SetDefault("reporting.ollama_model", "llama3.1:8b")

	v.SetEnvPrefix("SECWIN")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			panic(err)
		}
	}

	cfg = &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		panic(err)
	}

	return cfg
}

func (c *Config) Save() error {
	vp := viper.New()
	vp.SetConfigName("config")
	vp.SetConfigType("yaml")
	vp.AddConfigPath(ConfigDir())

	for k, val := range map[string]interface{}{
		"first_run":      c.FirstRun,
		"tool_dir":       c.ToolDir,
		"bin_dir":        c.BinDir,
		"manifest_dirs":  c.ManifestDirs,
		"wsl":            c.WSL,
		"profiles":       c.Profiles,
		"active_profile": c.ActiveProfile,
		"network":        c.Network,
		"reporting":      c.Reporting,
	} {
		vp.Set(k, val)
	}

	return vp.WriteConfigAs(ConfigPath())
}

func (c *Config) Set(key, value string) error {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(ConfigDir())
	v.ReadInConfig()

	v.Set(key, value)
	return v.WriteConfigAs(ConfigPath())
}

func ConfigDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".secwin")
}

func ConfigPath() string {
	return filepath.Join(ConfigDir(), "config.yaml")
}

func ToolDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".secwin", "tools")
}

func BinDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".secwin", "bin")
}

func EnsureDirs() error {
	dirs := []string{
		ConfigDir(),
		ToolDir(),
		BinDir(),
		filepath.Join(ConfigDir(), "profiles"),
		filepath.Join(ConfigDir(), "playbooks"),
		filepath.Join(ConfigDir(), "cache"),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

func ProfileConfigDir() string {
	return filepath.Join(ConfigDir(), "profiles")
}

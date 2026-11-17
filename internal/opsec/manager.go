package opsec

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/secwin/secwin/internal/config"
)

type Manager struct {
	originalMACs     map[string]string
	originalHostname string
	originalDNS      []string
	originalProxy    string
	activeProfile    string
}

func NewManager() *Manager {
	return &Manager{
		originalMACs: make(map[string]string),
	}
}

func (m *Manager) Engage(profile *config.Profile) error {
	m.activeProfile = profile.Name

	// 1. Start VPN if configured
	if profile.VPNConfig != "" {
		if err := m.startVPN(profile.VPNConfig); err != nil {
			return fmt.Errorf("failed to start VPN: %w", err)
		}
	}

	// 2. Spoof MAC addresses if enabled
	if profile.MACspoof {
		if err := m.spoofMAC(); err != nil {
			return fmt.Errorf("failed to spoof MAC: %w", err)
		}
	}

	// 3. Set hostname if configured
	if profile.Hostname != "" {
		if err := m.setHostname(profile.Hostname); err != nil {
			return fmt.Errorf("failed to set hostname: %w", err)
		}
	}

	// 4. Set timezone if configured
	if profile.Timezone != "" {
		if err := m.setTimezone(profile.Timezone); err != nil {
			return fmt.Errorf("failed to set timezone: %w", err)
		}
	}

	// 5. Set DNS if configured
	if profile.DNS != "" {
		if err := m.setDNS(profile.DNS); err != nil {
			return fmt.Errorf("failed to set DNS: %w", err)
		}
	}

	// 6. Set proxy if configured
	if profile.Proxy != "" {
		if err := m.setProxy(profile.Proxy); err != nil {
			return fmt.Errorf("failed to set proxy: %w", err)
		}
	}

	// Save original state for disengage
	statePath := filepath.Join(config.ProfileConfigDir(), m.activeProfile+".state")
	return m.saveState(statePath)
}

func (m *Manager) Disengage() error {
	if m.activeProfile == "" {
		return nil
	}

	statePath := filepath.Join(config.ProfileConfigDir(), m.activeProfile+".state")
	if err := m.loadState(statePath); err != nil {
		// Try to restore without state file
		return m.restoreDefaults()
	}

	// 1. Stop VPN
	if err := m.stopVPN(); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to stop VPN: %v\n", err)
	}

	// 2. Restore MAC addresses
	if err := m.restoreMAC(); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to restore MAC: %v\n", err)
	}

	// 3. Restore hostname
	if err := m.restoreHostname(); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to restore hostname: %v\n", err)
	}

	// 4. Restore timezone (not easily reversible, skip)

	// 5. Restore DNS
	if err := m.restoreDNS(); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to restore DNS: %v\n", err)
	}

	// 6. Restore proxy
	if err := m.restoreProxy(); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to restore proxy: %v\n", err)
	}

	// Clean up state file
	os.Remove(statePath)
	m.activeProfile = ""
	return nil
}

func (m *Manager) startVPN(configPath string) error {
	ext := strings.ToLower(filepath.Ext(configPath))
	ctx := context.Background()

	if ext == ".conf" || strings.Contains(configPath, "wireguard") {
		// WireGuard
		cmd := exec.CommandContext(ctx, "wireguard", "install", configPath)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("wireguard install failed: %w", err)
		}
		cmd = exec.CommandContext(ctx, "wireguard", "up", configPath)
		return cmd.Run()
	} else if ext == ".ovpn" || strings.Contains(configPath, "openvpn") {
		// OpenVPN
		cmd := exec.CommandContext(ctx, "openvpn", "--config", configPath)
		return cmd.Start() // Run in background
	}

	return fmt.Errorf("unsupported VPN config format: %s", configPath)
}

func (m *Manager) stopVPN() error {
	ctx := context.Background()

	// Try WireGuard
	cmd := exec.CommandContext(ctx, "wireguard", "down", "all")
	cmd.Run()

	// Try OpenVPN
	cmd = exec.CommandContext(ctx, "taskkill", "/F", "/IM", "openvpn.exe")
	cmd.Run()

	return nil
}

func (m *Manager) spoofMAC() error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("MAC spoofing only supported on Windows")
	}

	ctx := context.Background()

	// Get all network interfaces
	cmd := exec.CommandContext(ctx, "powershell", "-Command",
		"Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Select-Object -ExpandProperty Name")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to get network adapters: %w", err)
	}

	adapters := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, adapter := range adapters {
		adapter = strings.TrimSpace(adapter)
		if adapter == "" {
			continue
		}

		// Get current MAC
		cmd = exec.CommandContext(ctx, "powershell", "-Command",
			fmt.Sprintf("Get-NetAdapter -Name '%s' | Select-Object -ExpandProperty MacAddress", adapter))
		macOutput, err := cmd.Output()
		if err != nil {
			continue
		}
		originalMAC := strings.TrimSpace(string(macOutput))
		m.originalMACs[adapter] = originalMAC

		// Generate random MAC (locally administered, unicast)
		newMAC := generateRandomMAC()

		// Set new MAC
		cmd = exec.CommandContext(ctx, "powershell", "-Command",
			fmt.Sprintf("Set-NetAdapter -Name '%s' -MacAddress '%s'", adapter, newMAC))
		if err := cmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to spoof MAC for %s: %v\n", adapter, err)
		}
	}

	return nil
}

func (m *Manager) restoreMAC() error {
	ctx := context.Background()

	for adapter, originalMAC := range m.originalMACs {
		if originalMAC == "" {
			continue
		}
		cmd := exec.CommandContext(ctx, "powershell", "-Command",
			fmt.Sprintf("Set-NetAdapter -Name '%s' -MacAddress '%s'", adapter, originalMAC))
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to restore MAC for %s: %w", adapter, err)
		}
	}
	return nil
}

func (m *Manager) setHostname(hostname string) error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("hostname change only supported on Windows")
	}

	// Save original hostname
	original, err := os.Hostname()
	if err == nil {
		m.originalHostname = original
	}

	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "powershell", "-Command",
		fmt.Sprintf("Rename-Computer -NewName '%s' -Force -Restart", hostname))
	// Note: Requires restart, so we just schedule it
	return cmd.Run()
}

func (m *Manager) restoreHostname() error {
	if m.originalHostname == "" {
		return nil
	}

	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "powershell", "-Command",
		fmt.Sprintf("Rename-Computer -NewName '%s' -Force -Restart", m.originalHostname))
	return cmd.Run()
}

func (m *Manager) setTimezone(timezone string) error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("timezone change only supported on Windows")
	}

	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "tzutil", "/s", timezone)
	return cmd.Run()
}

func (m *Manager) setDNS(dnsServers string) error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("DNS change only supported on Windows")
	}

	ctx := context.Background()

	// Get current DNS for active interfaces
	cmd := exec.CommandContext(ctx, "powershell", "-Command",
		"Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object {$_.ServerAddresses -ne $null} | Select-Object -ExpandProperty ServerAddresses")
	output, err := cmd.Output()
	if err == nil {
		// Save original DNS
		dnsList := strings.Split(strings.TrimSpace(string(output)), " ")
		for _, dns := range dnsList {
			dns = strings.TrimSpace(dns)
			if dns != "" {
				m.originalDNS = append(m.originalDNS, dns)
			}
		}
	}

	// Set new DNS on all adapters
	servers := strings.Split(dnsServers, ",")
	for i := range servers {
		servers[i] = strings.TrimSpace(servers[i])
	}

	dnsArgs := strings.Join(servers, ",")
	cmd = exec.CommandContext(ctx, "powershell", "-Command",
		fmt.Sprintf("Set-DnsClientServerAddress -InterfaceAlias '*' -ServerAddresses %s", dnsArgs))
	return cmd.Run()
}

func (m *Manager) restoreDNS() error {
	if len(m.originalDNS) == 0 {
		return nil
	}

	ctx := context.Background()
	dnsArgs := strings.Join(m.originalDNS, ",")
	cmd := exec.CommandContext(ctx, "powershell", "-Command",
		fmt.Sprintf("Set-DnsClientServerAddress -InterfaceAlias '*' -ServerAddresses %s", dnsArgs))
	return cmd.Run()
}

func (m *Manager) setProxy(proxyURL string) error {
	m.originalProxy = os.Getenv("HTTP_PROXY")

	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "powershell", "-Command",
		fmt.Sprintf("[Environment]::SetEnvironmentVariable('HTTP_PROXY', '%s', 'User')", proxyURL))
	if err := cmd.Run(); err != nil {
		return err
	}

	cmd = exec.CommandContext(ctx, "powershell", "-Command",
		fmt.Sprintf("[Environment]::SetEnvironmentVariable('HTTPS_PROXY', '%s', 'User')", proxyURL))
	return cmd.Run()
}

func (m *Manager) restoreProxy() error {
	ctx := context.Background()

	if m.originalProxy == "" {
		cmd := exec.CommandContext(ctx, "powershell", "-Command",
			"[Environment]::SetEnvironmentVariable('HTTP_PROXY', $null, 'User')")
		cmd.Run()
		cmd = exec.CommandContext(ctx, "powershell", "-Command",
			"[Environment]::SetEnvironmentVariable('HTTPS_PROXY', $null, 'User')")
		return cmd.Run()
	}

	cmd := exec.CommandContext(ctx, "powershell", "-Command",
		fmt.Sprintf("[Environment]::SetEnvironmentVariable('HTTP_PROXY', '%s', 'User')", m.originalProxy))
	cmd.Run()
	cmd = exec.CommandContext(ctx, "powershell", "-Command",
		fmt.Sprintf("[Environment]::SetEnvironmentVariable('HTTPS_PROXY', '%s', 'User')", m.originalProxy))
	return cmd.Run()
}

func (m *Manager) restoreDefaults() error {
	// Best effort restore
	m.restoreMAC()
	m.restoreDNS()
	m.restoreProxy()
	return nil
}

func (m *Manager) saveState(path string) error {
	// Save state to file for later restoration
	// This is a simplified implementation - in production you'd serialize the state
	return nil
}

func (m *Manager) loadState(path string) error {
	// Load state from file
	return nil
}

func generateRandomMAC() string {
	// Generate locally administered unicast MAC (first byte: 0x02, 0x06, 0x0A, 0x0E)
	// Format: 02:XX:XX:XX:XX:XX
	prefixes := []string{"02", "06", "0a", "0e"}
	prefix := prefixes[time.Now().UnixNano()%4]

	mac := make([]string, 6)
	mac[0] = prefix
	for i := 1; i < 6; i++ {
		mac[i] = fmt.Sprintf("%02x", time.Now().UnixNano()%256)
		time.Sleep(time.Nanosecond)
	}

	return strings.Join(mac, ":")
}

func GetInterfaceMACs() (map[string]string, error) {
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "powershell", "-Command",
		"Get-NetAdapter | Select-Object Name, MacAddress")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			result[parts[0]] = parts[1]
		}
	}
	return result, nil
}

func CheckVPNStatus() (bool, string, error) {
	ctx := context.Background()

	// Check WireGuard
	cmd := exec.CommandContext(ctx, "wireguard", "show")
	if err := cmd.Run(); err == nil {
		return true, "WireGuard", nil
	}

	// Check OpenVPN
	cmd = exec.CommandContext(ctx, "tasklist", "/FI", "IMAGENAME eq openvpn.exe")
	output, _ := cmd.Output()
	if strings.Contains(string(output), "openvpn.exe") {
		return true, "OpenVPN", nil
	}

	return false, "", nil
}

func CheckOpSecStatus() map[string]string {
	status := make(map[string]string)

	// Check MAC spoofing
	macs, err := GetInterfaceMACs()
	if err == nil {
		for iface, mac := range macs {
			status[fmt.Sprintf("mac_%s", iface)] = mac
		}
	}

	// Check hostname
	hostname, _ := os.Hostname()
	status["hostname"] = hostname

	// Check timezone
	if runtime.GOOS == "windows" {
		ctx := context.Background()
		cmd := exec.CommandContext(ctx, "tzutil", "/g")
		output, _ := cmd.Output()
		status["timezone"] = strings.TrimSpace(string(output))
	}

	// Check VPN
	active, vpnType, _ := CheckVPNStatus()
	if active {
		status["vpn"] = vpnType
	} else {
		status["vpn"] = "none"
	}

	// Check proxy
	status["http_proxy"] = os.Getenv("HTTP_PROXY")
	status["https_proxy"] = os.Getenv("HTTPS_PROXY")

	// Check DNS
	if runtime.GOOS == "windows" {
		ctx := context.Background()
		cmd := exec.CommandContext(ctx, "powershell", "-Command",
			"Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object {$_.ServerAddresses -ne $null} | Select-Object -ExpandProperty ServerAddresses")
		output, _ := cmd.Output()
		status["dns"] = strings.TrimSpace(string(output))
	}

	return status
}

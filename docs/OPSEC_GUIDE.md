# OpSec Guide

Operational Security (OpSec) profiles isolate engagement settings to prevent cross-contamination and maintain attribution control.

## Overview

Each engagement gets a **profile** that configures:

- **VPN**: WireGuard/OpenVPN connection
- **MAC address**: Spoofing for network anonymity
- **Hostname**: Custom hostname per engagement
- **Timezone**: Target-appropriate timezone
- **DNS**: Custom resolvers
- **Proxy**: HTTP/SOCKS proxy for traffic routing

## Profile Management

### Create a Profile

```bash
secwin profile create client-a \
  --vpn wireguard/client-a.conf \
  --mac-spoof \
  --hostname "ws-client-a" \
  --timezone "America/New_York" \
  --dns "1.1.1.1,8.8.8.8" \
  --proxy "socks5://127.0.0.1:1080"
```

### List Profiles

```bash
secwin profile list
```

Output:
```
OpSec Profiles:
  client-a (active)
    VPN: wireguard/client-a.conf
    MAC Spoof: enabled
    Hostname: ws-client-a
    Timezone: America/New_York
  client-b
    VPN: openvpn/client-b.ovpn
    MAC Spoof: disabled
```

### Engage Profile

```bash
secwin profile engage client-a
```

This:
1. Starts the VPN connection
2. Spoofs MAC address (requires admin)
3. Sets hostname (requires admin)
4. Configures DNS
5. Sets proxy environment variables
6. Updates `config.active_profile`

### Disengage Profile

```bash
secwin profile disengage
```

This:
1. Stops VPN
2. Restores original MAC
3. Restores original hostname
4. Restores DNS
5. Clears proxy
6. Clears `config.active_profile`

### Show Profile Details

```bash
secwin profile show client-a
```

### Delete Profile

```bash
secwin profile delete client-a
```

## Profile Configuration

Profiles stored in `~/.secwin/profiles/<name>.yaml`:

```yaml
name: client-a
vpn_config: "wireguard/client-a.conf"
mac_spoof: true
hostname: "ws-client-a"
timezone: "America/New_York"
dns: "1.1.1.1,8.8.8.8"
proxy: "socks5://127.0.0.1:1080"
```

## VPN Integration

### WireGuard

```bash
# Profile with WireGuard
secwin profile create client-a --vpn wireguard/client-a.conf

# WireGuard config must be in ~/.secwin/vpn/
# SecWin runs: wireguard-client-a.conf up/down
```

### OpenVPN

```bash
# Profile with OpenVPN
secwin profile create client-b --vpn openvpn/client-b.ovpn

# OpenVPN config must be in ~/.secwin/vpn/
# SecWin runs: openvpn --config client-b.ovpn
```

### VPN Directory Structure

```
~/.secwin/vpn/
├── wireguard/
│   ├── client-a.conf
│   └── client-b.conf
└── openvpn/
    ├── client-a.ovpn
    └── client-b.ovpn
```

## MAC Address Spoofing

Requires **Administrator privileges**.

```bash
# Enable in profile
secwin profile create client-a --mac-spoof

# Or toggle manually (admin required)
secwin profile engage client-a  # Spoofs MAC
secwin profile disengage       # Restores original MAC
```

Implementation:
- Windows: `netsh interface set interface "Ethernet" newmac=<random>`
- Linux/WSL: `macchanger -r eth0`

Original MAC stored in profile for restoration.

## Hostname Management

Requires **Administrator privileges**.

```bash
secwin profile create client-a --hostname "ws-client-a"
```

Windows: `Rename-Computer -NewName "ws-client-a" -Force -Restart`
Linux/WSL: `hostnamectl set-hostname "ws-client-a"`

**Note**: Windows hostname change requires restart. SecWin will prompt.

## Timezone Configuration

```bash
secwin profile create client-a --timezone "America/New_York"
```

Windows: `tzutil /s "Eastern Standard Time"`
Linux/WSL: `timedatectl set-timezone America/New_York`

Common timezones:
- `UTC`
- `America/New_York` (EST/EDT)
- `America/Chicago` (CST/CDT)
- `America/Denver` (MST/MDT)
- `America/Los_Angeles` (PST/PDT)
- `Europe/London` (GMT/BST)
- `Europe/Berlin` (CET/CEST)
- `Asia/Tokyo` (JST)
- `Asia/Singapore` (SGT)

## DNS Configuration

```bash
secwin profile create client-a --dns "1.1.1.1,8.8.8.8"
```

Windows: `Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses 1.1.1.1,8.8.8.8`
Linux/WSL: Updates `/etc/resolv.conf` (or uses `resolvectl`)

## Proxy Configuration

```bash
secwin profile create client-a --proxy "socks5://127.0.0.1:1080"
```

Sets environment variables:
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `ALL_PROXY`
- `NO_PROXY=localhost,127.0.0.1,::1`

Supports:
- `http://host:port`
- `https://host:port`
- `socks5://host:port`
- `socks5h://host:port` (remote DNS)

## Evidence Locker

Each engagement gets an isolated evidence directory:

```
~/.secwin/evidence/
├── client-a/
│   ├── 2024-01-15_10-30-00_external-recon/
│   │   ├── artifacts/
│   │   ├── findings.json
│   │   ├── report.html
│   │   └── manifest.json
│   └── 2024-01-16_14-22-00_internal-ad-enum/
│       └── ...
└── client-b/
    └── ...
```

### Artifact Integrity

Every artifact gets a SHA256 hash recorded in `manifest.json`:

```json
{
  "artifacts": [
    {
      "path": "artifacts/subdomains.txt",
      "sha256": "abc123...",
      "size": 2048,
      "timestamp": "2024-01-15T10:30:00Z",
      "step": "subdomain_enum"
    }
  ]
}
```

### Chain of Custody

Playbook execution logs:

```json
{
  "playbook": "external-recon",
  "version": "1.0",
  "profile": "client-a",
  "started_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T11:15:00Z",
  "steps": [
    {
      "id": "subdomain_enum",
      "started_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T10:32:00Z",
      "success": true,
      "artifacts": ["subdomains.txt"]
    }
  ]
}
```

## Network Isolation

### Per-Profile Network Namespace (Linux/WSL)

```bash
# Planned: network namespace per profile
secwin profile engage client-a --network-isolate
```

Creates isolated network namespace with:
- Own routing table
- Own DNS
- VPN as default route
- No access to host network

### Windows Network Isolation

Uses Windows Filtering Platform (WFP) or separate network adapter.

## Reporting with OpSec Context

Reports include OpSec metadata:

```markdown
# Engagement Report

**Client**: client-a
**Profile**: client-a
**VPN**: wireguard/client-a.conf (connected)
**MAC**: aa:bb:cc:dd:ee:ff (spoofed from 00:11:22:33:44:55)
**Hostname**: ws-client-a
**Timezone**: America/New_York
**DNS**: 1.1.1.1, 8.8.8.8
**Proxy**: socks5://127.0.0.1:1080

**Playbook**: external-recon v1.0
**Started**: 2024-01-15 10:30:00 EST
**Completed**: 2024-01-15 11:15:00 EST
**Duration**: 45m
```

## Best Practices

1. **One profile per client/engagement** — Never reuse
2. **Always engage before starting** — `secwin profile engage client-a`
3. **Disengage after** — `secwin profile disengage`
4. **Use dedicated VPN per client** — No shared infrastructure
5. **Spoof MAC on physical interfaces** — Not needed for pure WSL
6. **Set timezone to client locale** — Timestamps match their logs
7. **Use client-approved DNS** — Or privacy-respecting (1.1.1.1, 9.9.9.9)
8. **Route all traffic through proxy** — `secwin config set network.proxy "socks5://..."`
9. **Verify evidence integrity** — `secwin evidence verify client-a/2024-01-15...`
10. **Archive evidence offline** — After engagement, move to cold storage

## Automation

### Pre-Engagement Script

```bash
#!/bin/bash
# engage.sh
secwin profile engage "$1"
secwin install @core  # Ensure tools available
```

### Post-Engagement Script

```bash
#!/bin/bash
# disengage.sh
secwin evidence verify "$1"
secwin profile disengage
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| VPN won't connect | Check config syntax, credentials, firewall |
| MAC spoof fails | Run as Administrator, check interface name |
| Hostname won't change | Windows requires restart; Linux needs systemd |
| DNS not updating | Flush DNS cache: `ipconfig /flushdns` |
| Proxy not working | Check `NO_PROXY` includes local addresses |
| Evidence verification fails | Check file permissions, re-run playbook step |

## Compliance

OpSec profiles support compliance requirements:

- **PCI DSS**: Network segmentation via VPN/proxy
- **HIPAA**: Audit trail via evidence locker
- **SOC 2**: Access controls, logging, encryption
- **GDPR**: Data minimization, purpose limitation

Document profile usage in engagement letter.
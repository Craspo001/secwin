'use client';

import { useState, useEffect } from 'react';
import { useSecWin } from '../hooks/useSecWin';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge, BadgeProps } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import {
  Shield,
  RefreshCw,
  Wifi,
  WifiOff,
  Monitor,
  Database,
  Globe,
  Key,
  Terminal,
  Network,
  Cpu,
  ExternalLink,
  ChevronDown,
  Play,
} from 'lucide-react';

export function OpSec() {
  const { opsecStatus, loadOpSecStatus, activeProfile, profiles, isLoading } = useSecWin();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['network', 'system', 'vpn']));

  useEffect(() => {
    loadOpSecStatus();
  }, [loadOpSecStatus]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const vpnActive = opsecStatus?.vpn && opsecStatus.vpn !== 'none';
  const hasProxy = !!opsecStatus?.httpProxy;
  // const hasDNS = !!opsecStatus?.dns; // unused

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            OpSec Status
          </h1>
          <p className="text-muted-foreground mt-1">Current operational security posture</p>
        </div>
        <Button variant="outline" onClick={loadOpSecStatus} disabled={isLoading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card className={cn('border-2', vpnActive ? 'border-green-500' : 'border-yellow-500')}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-xl', vpnActive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30')}>
                {vpnActive ? (
                  <Wifi className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <WifiOff className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {vpnActive ? 'Protected' : 'Exposed'}
                </h3>
                <p className="text-muted-foreground">
                  {vpnActive
                    ? `VPN active: ${opsecStatus?.vpn}`
                    : 'No VPN connection - traffic is visible'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right sm:text-left">
              <div className="text-sm">
                <span className="text-muted-foreground">Active Profile: </span>
                <span className={cn('font-medium', activeProfile ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {activeProfile || 'None'}
                </span>
              </div>
              {activeProfile && (
                <Badge variant={vpnActive ? 'success' : 'warning'} className="whitespace-nowrap">
                  {vpnActive ? 'Engaged' : 'Partial'}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          title="VPN"
          value={vpnActive ? opsecStatus?.vpn || 'Connected' : 'Disconnected'}
          icon={vpnActive ? Wifi : WifiOff}
          color={vpnActive ? 'green' : 'red'}
          status={vpnActive ? 'success' : 'error'}
        />
        <StatusCard
          title="Hostname"
          value={opsecStatus?.hostname || 'Unknown'}
          icon={Monitor}
          color="blue"
          status="info"
        />
        <StatusCard
          title="Timezone"
          value={opsecStatus?.timezone || 'UTC'}
          icon={Globe}
          color="purple"
          status="info"
        />
        <StatusCard
          title="Proxy"
          value={hasProxy ? 'Configured' : 'None'}
          icon={Key}
          color={hasProxy ? 'green' : 'gray'}
          status={hasProxy ? 'success' : 'default'}
        />
      </div>

      {/* Detailed Sections */}
      <div className="space-y-4">
        {/* Network Section */}
        <SectionCard
          title="Network Configuration"
          icon={Network}
          expanded={expandedSections.has('network')}
          onToggle={() => toggleSection('network')}
        >
          <div className="space-y-3">
            <DetailRow label="HTTP Proxy" value={opsecStatus?.httpProxy || 'Not set'} />
            <DetailRow label="HTTPS Proxy" value={opsecStatus?.httpsProxy || 'Not set'} />
            <DetailRow label="DNS Servers" value={opsecStatus?.dns || 'System default'} />
            <DetailRow label="No Proxy" value="localhost,127.0.0.1,::1" />
          </div>
        </SectionCard>

        {/* MAC Addresses */}
        <SectionCard
          title="MAC Addresses"
          icon={Database}
          expanded={expandedSections.has('mac')}
          onToggle={() => toggleSection('mac')}
        >
          {opsecStatus?.macAddresses && Object.keys(opsecStatus.macAddresses).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(opsecStatus.macAddresses).map(([iface, mac]) => (
                <DetailRow key={iface} label={iface} value={mac} monospace />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No network interfaces found</p>
          )}
        </SectionCard>

        {/* System Section */}
        <SectionCard
          title="System Information"
          icon={Cpu}
          expanded={expandedSections.has('system')}
          onToggle={() => toggleSection('system')}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Hostname" value={opsecStatus?.hostname || 'Unknown'} monospace />
            <DetailRow label="Timezone" value={opsecStatus?.timezone || 'UTC'} />
            <DetailRow label="OS" value={`${navigator.platform}`} />
            <DetailRow label="User Agent" value={navigator.userAgent.slice(0, 50)} monospace />
          </div>
        </SectionCard>

        {/* Active Profile Details */}
        {activeProfile && (
          <SectionCard
            title={`Active Profile: ${activeProfile}`}
            icon={Shield}
            expanded={expandedSections.has('profile')}
            onToggle={() => toggleSection('profile')}
          >
            {(() => {
              const profile = profiles.find(p => p.name === activeProfile);
              if (!profile) return <p className="text-muted-foreground">Profile not found</p>;
              return (
                <div className="space-y-3">
                  {profile.vpnConfig && (
                    <DetailRow label="VPN Config" value={profile.vpnConfig} />
                  )}
                  {profile.macSpoof && (
                    <DetailRow label="MAC Spoofing" value="Enabled" />
                  )}
                  {profile.hostname && (
                    <DetailRow label="Target Hostname" value={profile.hostname} />
                  )}
                  {profile.timezone && (
                    <DetailRow label="Target Timezone" value={profile.timezone} />
                  )}
                  {profile.dns && (
                    <DetailRow label="Target DNS" value={profile.dns} />
                  )}
                  {profile.proxy && (
                    <DetailRow label="Target Proxy" value={profile.proxy} />
                  )}
                  {!profile.vpnConfig && !profile.macSpoof && !profile.hostname && !profile.timezone && !profile.dns && !profile.proxy && (
                    <p className="text-muted-foreground text-sm">No settings configured</p>
                  )}
                </div>
              );
            })()}
          </SectionCard>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <a href="/profiles" target="_blank" rel="noopener">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Manage Profiles
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/playbooks" target="_blank" rel="noopener">
                  <Play className="mr-2 h-4 w-4" />
                  Run Playbook
                </a>
              </Button>
              <Button variant="ghost" onClick={loadOpSecStatus} disabled={isLoading}>
                <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusCard({ title, value, icon: Icon, color, status }: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  status: 'success' | 'error' | 'warning' | 'info' | 'default';
}) {
  const colors = {
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400',
  };

  const statusVariants = {
    success: 'success',
    error: 'destructive',
    warning: 'warning',
    info: 'info',
    default: 'default',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 font-medium text-lg truncate">{value}</p>
          </div>
          <div className={cn('p-2 rounded-xl', colors[color as keyof typeof colors] || colors.gray)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <Badge variant={statusVariants[status] as BadgeProps['variant']} className="mt-3">
          {status}
        </Badge>
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, icon: Icon, expanded, onToggle, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="p-4 bg-muted/50 border-b cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">{title}</h3>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </div>
      </div>
      {expanded && (
        <CardContent className="p-4 animate-slide-down">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function DetailRow({ label, value, monospace }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <span className="text-sm font-medium text-muted-foreground min-w-[150px]">{label}</span>
      <code className={cn('font-mono text-sm truncate flex-1', monospace && 'bg-background px-2 py-1 rounded')}>
        {value}
      </code>
    </div>
  );
}


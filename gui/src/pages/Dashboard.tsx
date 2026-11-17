'use client';

import React from 'react';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Separator } from '../components/ui/Separator';
import { Shield, ShieldCheck, AlertTriangle, Box, FileText, Clock, TrendingUp, Target, Check, X } from 'lucide-react';
import { clsx } from 'clsx';

export function Dashboard() {
  const {
    secwinAvailable,
    secwinVersion,
    activeProfile,
    opsecStatus,
    profiles,
    tools,
    playbooks,
    evidenceArtifacts,
    findings,
    loadProfiles,
    loadTools,
    refreshOpSecStatus
  } = useStore();

  const stats = [
    {
      name: 'OpSec Profiles',
      value: profiles.length,
      change: activeProfile ? 1 : 0,
      icon: Shield,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      name: 'Tools Installed',
      value: tools.filter(t => t.installed).length || 0,
      change: tools.length,
      icon: Box,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      name: 'Playbooks',
      value: playbooks.length,
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      name: 'Evidence Artifacts',
      value: evidenceArtifacts.length,
      icon: Target,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ];

  const recentActivity = [
    { action: 'Profile engaged', target: activeProfile || 'none', time: 'Just now', type: 'success' },
    { action: 'Tool installed', target: 'nmap', time: '2 hours ago', type: 'info' },
    { action: 'Playbook executed', target: 'external-recon', time: 'Yesterday', type: 'success' },
    { action: 'Evidence verified', target: 'manifest.json', time: '3 days ago', type: 'info' },
  ];

  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    info: findings.filter(f => f.severity === 'info').length,
  };

  if (!secwinAvailable) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="mb-2 text-3xl font-bold">SecWin CLI Not Found</h1>
        <p className="mb-6 text-muted-foreground max-w-md">
          The SecWin command-line interface is not installed or not in your PATH.
          Please install it first to use the GUI.
        </p>
        <div className="space-y-2 text-sm font-mono bg-muted p-4 rounded-lg text-left max-w-md">
          <p># Install via Go</p>
          <p>go install github.com/secwin/secwin@latest</p>
          <p className="mt-2"># Or download from GitHub Releases</p>
        </div>
        <Button onClick={() => { loadProfiles(); loadTools(); refreshOpSecStatus(); }} className="mt-6">
          Retry Detection
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your SecWin environment and active engagement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            SecWin v{secwinVersion || 'unknown'}
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  {stat.change !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.change > 0 ? '+' : ''}{stat.change} total
                    </p>
                  )}
                </div>
                <div className={clsx('flex h-12 w-12 items-center justify-center rounded-lg', stat.bg)}>
                  <stat.icon className={clsx('h-6 w-6', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Profile & OpSec Status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Active OpSec Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeProfile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                    <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-200">{activeProfile}</p>
                    <p className="text-sm text-green-600 dark:text-green-400">Profile is actively engaged</p>
                  </div>
                </div>

                {opsecStatus && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">VPN Status</p>
                        <p className="font-medium capitalize">{opsecStatus.vpn || 'none'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hostname</p>
                        <p className="font-medium font-mono">{opsecStatus.hostname}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Timezone</p>
                        <p className="font-medium">{opsecStatus.timezone || 'system default'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">DNS</p>
                        <p className="font-medium font-mono text-xs">{opsecStatus.dns || 'auto'}</p>
                      </div>
                    </div>

                    {Object.keys(opsecStatus.mac_addresses || {}).length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">MAC Addresses (Spoofed)</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(opsecStatus.mac_addresses).map(([iface, mac]) => (
                            <Badge key={iface} variant="outline" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              <span className="font-mono text-xs">{iface}: {mac}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-1">No Active Profile</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create and engage an OpSec profile to isolate your engagement settings.
                </p>
                <Button onClick={() => {/* navigate to profiles */}}>Manage Profiles</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Finding Severity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {findings.length > 0 ? (
              <div className="space-y-3">
                {[
                  { key: 'critical', label: 'Critical', color: 'bg-red-500', count: severityCounts.critical },
                  { key: 'high', label: 'High', color: 'bg-orange-500', count: severityCounts.high },
                  { key: 'medium', label: 'Medium', color: 'bg-yellow-500', count: severityCounts.medium },
                  { key: 'low', label: 'Low', color: 'bg-blue-500', count: severityCounts.low },
                  { key: 'info', label: 'Info', color: 'bg-gray-500', count: severityCounts.info },
                ].map(({ label, color, count }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all', color)}
                        style={{ width: findings.length > 0 ? `${(count / findings.length) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-sm font-medium w-16">{label}</span>
                    <span className="text-sm font-mono text-muted-foreground w-10 text-right">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No findings recorded yet</p>
                <p className="text-sm">Run a playbook to generate findings</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full',
                    activity.type === 'success' && 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
                    activity.type === 'info' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                    activity.type === 'warning' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
                    activity.type === 'error' && 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  )}>
                    {activity.type === 'success' && <Check className="h-4 w-4" />}
                    {activity.type === 'info' && <FileText className="h-4 w-4" />}
                    {activity.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                    {activity.type === 'error' && <X className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground font-mono">{activity.target}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start gap-2" variant="outline">
              <Box className="h-4 w-4" />
              Install Tools
            </Button>
            <Button className="w-full justify-start gap-2" variant="outline">
              <FileText className="h-4 w-4" />
              Run Playbook
            </Button>
            <Button className="w-full justify-start gap-2" variant="outline">
              <Shield className="h-4 w-4" />
              Create Profile
            </Button>
            <Button className="w-full justify-start gap-2" variant="outline">
              <Target className="h-4 w-4" />
              View Evidence
            </Button>
            <Button className="w-full justify-start gap-2" variant="outline">
              <FileText className="h-4 w-4" />
              Generate Report
            </Button>
            <Separator />
            <Button className="w-full justify-start gap-2" variant="ghost">
              <Shield className="h-4 w-4" />
              Engage Profile
            </Button>
            <Button className="w-full justify-start gap-2" variant="ghost" disabled={!activeProfile}>
              <Shield className="h-4 w-4" />
              Disengage Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
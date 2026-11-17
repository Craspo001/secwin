'use client';

import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Separator } from '../components/ui/Separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Cog, Monitor, Sun, Moon, Palette, Shield, Terminal, Database, Key, Globe, Loader2, Check, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

export function Settings() {
  const { theme, setTheme, secwinPath, secwinVersion, systemInfo, secwinAvailable, checkSecwin } = useStore();

  const [config, setConfig] = useState({
    toolDir: '',
    binDir: '',
    manifestDirs: ['manifests'],
    wslDistro: 'kali-linux',
    defaultInterface: '',
    proxyUrl: '',
    noProxy: 'localhost,127.0.0.1,::1',
    defaultTemplate: 'default',
    outputFormats: ['markdown', 'html', 'pdf'],
    evidenceRetentionDays: 90,
  });

  const [saving, setSaving] = useState(false);
  const [testingSecwin, setTestingSecwin] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real implementation, this would save to the config file
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setSaving(false);
    }
  };

  const handleTestSecwin = async () => {
    setTestingSecwin(true);
    await checkSecwin();
    setTestingSecwin(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure SecWin GUI and CLI integration
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="secwin">SecWin CLI</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cog className="h-5 w-5" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tool-dir">Tool Directory</Label>
                  <Input
                    id="tool-dir"
                    value={config.toolDir}
                    onChange={(e) => setConfig({ ...config, toolDir: e.target.value })}
                    placeholder="~/.secwin/tools"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bin-dir">Binary Directory</Label>
                  <Input
                    id="bin-dir"
                    value={config.binDir}
                    onChange={(e) => setConfig({ ...config, binDir: e.target.value })}
                    placeholder="~/.secwin/bin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manifest-dirs">Manifest Directories</Label>
                  <Input
                    id="manifest-dirs"
                    value={config.manifestDirs.join(', ')}
                    onChange={(e) => setConfig({ ...config, manifestDirs: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="manifests, ./custom-manifests"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wsl-distro">WSL Distro</Label>
                  <Input
                    id="wsl-distro"
                    value={config.wslDistro}
                    onChange={(e) => setConfig({ ...config, wslDistro: e.target.value })}
                    placeholder="kali-linux"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="evidence-retention">Evidence Retention (days)</Label>
                <Input
                  id="evidence-retention"
                  type="number"
                  value={config.evidenceRetentionDays}
                  onChange={(e) => setConfig({ ...config, evidenceRetentionDays: parseInt(e.target.value) || 90 })}
                />
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save General Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'light', label: 'Light', icon: Sun },
                    { value: 'dark', label: 'Dark', icon: Moon },
                    { value: 'system', label: 'System', icon: Monitor },
                  ].map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={theme === value ? 'default' : 'outline'}
                      className="flex flex-col items-center gap-2 h-auto py-6"
                      onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
                    >
                      <Icon className="h-6 w-6" />
                      <span>{label}</span>
                      {theme === value && <Check className="h-4 w-4 text-primary" />}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Emerald', value: 'emerald' },
                    { name: 'Blue', value: 'blue' },
                    { name: 'Purple', value: 'purple' },
                    { name: 'Rose', value: 'rose' },
                    { name: 'Amber', value: 'amber' },
                    { name: 'Teal', value: 'teal' },
                  ].map(color => (
                    <Button
                      key={color.value}
                      variant="outline"
                      className="gap-2"
                      onClick={() => {}}
                    >
                      <div className={`h-4 w-4 rounded ${color.value === 'emerald' ? 'bg-emerald-500' : color.value === 'blue' ? 'bg-blue-500' : color.value === 'purple' ? 'bg-purple-500' : color.value === 'rose' ? 'bg-rose-500' : color.value === 'amber' ? 'bg-amber-500' : 'bg-teal-500'}`} />
                      {color.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SecWin CLI Settings */}
        <TabsContent value="secwin" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                SecWin CLI Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>CLI Status</Label>
                  <div className={clsx(
                    'p-4 rounded-lg border',
                    secwinAvailable ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  )}>
                    <div className="flex items-center gap-2">
                      {secwinAvailable ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{secwinAvailable ? 'Connected' : 'Not Found'}</p>
                        <p className="text-sm text-muted-foreground">{secwinPath || 'Not in PATH'}</p>
                      </div>
                    </div>
                    {secwinVersion && (
                      <p className="mt-2 text-sm font-mono text-muted-foreground">Version: {secwinVersion}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Auto-detect Path</Label>
                  <Button variant="outline" onClick={handleTestSecwin} disabled={testingSecwin} className="w-full">
                    {testingSecwin ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Installation Instructions</Label>
                <div className="p-4 rounded-lg bg-muted/50 border font-mono text-sm space-y-2">
                  <p className="font-medium">To install SecWin CLI:</p>
                  <code>go install github.com/secwin/secwin@latest</code>
                  <p className="text-muted-foreground">Or download from <a href="https://github.com/secwin/secwin/releases" target="_blank" rel="noopener noreferrer" className="underline">GitHub Releases</a></p>
                </div>
              </div>

              <Button onClick={handleTestSecwin} disabled={testingSecwin} variant="outline">
                {testingSecwin ? 'Checking...' : 'Re-detect SecWin CLI'}
              </Button>
            </CardContent>
          </Card>

          {/* System Info */}
          {systemInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">OS</p>
                    <p className="font-mono">{systemInfo.os} ({systemInfo.arch})</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Hostname</p>
                    <p className="font-mono">{systemInfo.hostname}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">CPU Cores</p>
                    <p className="font-mono">{systemInfo.cpu_count}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Memory</p>
                    <p className="font-mono">{(systemInfo.total_memory / 1024 / 1024 / 1024).toFixed(1)} GB</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Used Memory</p>
                    <p className="font-mono">{(systemInfo.used_memory / 1024 / 1024 / 1024).toFixed(1)} GB</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Available Memory</p>
                    <p className="font-mono">{(systemInfo.available_memory / 1024 / 1024 / 1024).toFixed(1)} GB</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Network Settings */}
        <TabsContent value="network" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Network Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default-interface">Default Interface</Label>
                  <Input
                    id="default-interface"
                    value={config.defaultInterface}
                    onChange={(e) => setConfig({ ...config, defaultInterface: e.target.value })}
                    placeholder="eth0, Ethernet, Wi-Fi"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proxy-url">Proxy URL</Label>
                  <Input
                    id="proxy-url"
                    value={config.proxyUrl}
                    onChange={(e) => setConfig({ ...config, proxyUrl: e.target.value })}
                    placeholder="http://proxy:8080"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="no-proxy">No Proxy</Label>
                  <Input
                    id="no-proxy"
                    value={config.noProxy}
                    onChange={(e) => setConfig({ ...config, noProxy: e.target.value })}
                    placeholder="localhost,127.0.0.1,::1,.local"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated list of hosts to bypass proxy</p>
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Network Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Reporting Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default-template">Default Template</Label>
                  <Input
                    id="default-template"
                    value={config.defaultTemplate}
                    onChange={(e) => setConfig({ ...config, defaultTemplate: e.target.value })}
                    placeholder="default"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="output-formats">Output Formats</Label>
                  <Input
                    id="output-formats"
                    value={config.outputFormats.join(', ')}
                    onChange={(e) => setConfig({ ...config, outputFormats: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="markdown, html, pdf"
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Reporting Settings'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys & Secrets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manage API keys for external services (Shodan, Censys, VirusTotal, etc.)
              </p>
              <div className="space-y-3">
                {[
                  { name: 'Shodan API Key', key: 'shodan' },
                  { name: 'Censys API ID', key: 'censys_id' },
                  { name: 'Censys API Secret', key: 'censys_secret' },
                  { name: 'VirusTotal API Key', key: 'virustotal' },
                  { name: 'SecurityTrails API Key', key: 'securitytrails' },
                  { name: 'GitHub Token', key: 'github' },
                ].map(({ name, key }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="text-sm">{name}</span>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                These actions are irreversible. Use with caution.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" onClick={() => { if (confirm('Clear all evidence artifacts?')) {} }}>
                  Clear Evidence
                </Button>
                <Button variant="destructive" onClick={() => { if (confirm('Reset all settings to defaults?')) {} }}>
                  Reset Settings
                </Button>
                <Button variant="destructive" onClick={() => { if (confirm('Delete all OpSec profiles?')) {} }}>
                  Delete Profiles
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
'use client';

import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../components/ui/DropdownMenu';
import { Shield, Plus, Play, StopCircle, Trash2, Edit, Wifi, Settings, Loader2, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

export function Profiles() {
  const {
    profiles,
    activeProfile,
    opsecStatus,
    loadProfiles,
    engageProfile,
    disengageProfile,
    createProfile,
    deleteProfile,
    refreshOpSecStatus
  } = useStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<typeof profiles[0] | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    vpn: '',
    mac_spoof: false,
    hostname: '',
    timezone: '',
    dns: '',
    proxy: '',
  });
  const [engaging, setEngaging] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProfile) {
        // Update not implemented in CLI yet, would need to delete and recreate
        await deleteProfile(editingProfile.name);
      }
      await createProfile(formData);
      setShowCreateDialog(false);
      setEditingProfile(null);
      resetForm();
      await loadProfiles();
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      vpn: '',
      mac_spoof: false,
      hostname: '',
      timezone: '',
      dns: '',
      proxy: '',
    });
  };

  const handleEngage = async (name: string) => {
    setEngaging(name);
    try {
      await engageProfile(name);
      await loadProfiles();
      await refreshOpSecStatus();
    } catch (error) {
      console.error('Failed to engage profile:', error);
    } finally {
      setEngaging(null);
    }
  };

  const handleDisengage = async () => {
    try {
      await disengageProfile();
      await loadProfiles();
      await refreshOpSecStatus();
    } catch (error) {
      console.error('Failed to disengage profile:', error);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete profile "${name}"?`)) return;
    try {
      await deleteProfile(name);
      await loadProfiles();
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  const openCreateDialog = () => {
    setEditingProfile(null);
    resetForm();
    setShowCreateDialog(true);
  };

  const openEditDialog = (profile: typeof profiles[0]) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      vpn: profile.vpn_config || '',
      mac_spoof: profile.mac_spoof,
      hostname: profile.hostname || '',
      timezone: profile.timezone || '',
      dns: profile.dns || '',
      proxy: profile.proxy || '',
    });
    setShowCreateDialog(true);
  };

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Asia/Dubai',
    'Australia/Sydney',
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OpSec Profiles</h1>
          <p className="text-muted-foreground">
            Manage operational security profiles for engagement isolation
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Profile
        </Button>
      </div>

      {/* Profile List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Configured Profiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-2">No Profiles Configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first OpSec profile to start isolating engagement settings.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create Profile
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>VPN</TableHead>
                    <TableHead>MAC Spoof</TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>DNS</TableHead>
                    <TableHead>Proxy</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.name}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-lg',
                            profile.active
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            <Shield className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{profile.name}</p>
                            {profile.active && (
                              <Badge variant="success" className="mt-1">Active</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {profile.vpn_config ? (
                          <Badge variant="outline" className="gap-1">
                            <Wifi className="h-3 w-3" />
                            {profile.vpn_config.split('/').pop() || profile.vpn_config}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Not configured</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={profile.mac_spoof ? 'success' : 'secondary'}>
                          {profile.mac_spoof ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {profile.hostname ? (
                          <span className="font-mono text-sm">{profile.hostname}</span>
                        ) : (
                          <span className="text-muted-foreground">Default</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {profile.timezone ? (
                          <span className="text-sm">{profile.timezone}</span>
                        ) : (
                          <span className="text-muted-foreground">System default</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {profile.dns ? (
                          <span className="font-mono text-xs">{profile.dns}</span>
                        ) : (
                          <span className="text-muted-foreground">Auto</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {profile.proxy ? (
                          <span className="font-mono text-xs">{profile.proxy}</span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!profile.active ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleEngage(profile.name)}
                                  disabled={engaging === profile.name}
                                >
                                  {engaging === profile.name ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Engaging...
                                    </>
                                  ) : (
                                    <>
                                      <Play className="mr-2 h-4 w-4" />
                                      Engage Profile
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={handleDisengage}>
                                  <StopCircle className="mr-2 h-4 w-4" />
                                  Disengage Profile
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => openEditDialog(profile)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(profile.name)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current OpSec Status */}
      {activeProfile && opsecStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Current OpSec Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">VPN</p>
                <p className="font-mono text-sm capitalize">{opsecStatus.vpn || 'none'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Hostname</p>
                <p className="font-mono text-sm">{opsecStatus.hostname}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Timezone</p>
                <p className="font-mono text-sm">{opsecStatus.timezone || 'system'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">DNS</p>
                <p className="font-mono text-xs truncate">{opsecStatus.dns || 'auto'}</p>
              </div>
            </div>

            {Object.keys(opsecStatus.mac_addresses || {}).length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">MAC Addresses (Spoofed)</p>
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

            {opsecStatus.http_proxy && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Proxy</p>
                <p className="font-mono text-xs">{opsecStatus.http_proxy}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Profile Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Edit Profile' : 'Create OpSec Profile'}</DialogTitle>
            <DialogDescription>
              Configure operational security settings for engagement isolation.
              Each profile can have VPN, MAC spoofing, hostname, timezone, DNS, and proxy settings.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Profile Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="client-a"
                  required
                  disabled={!!editingProfile}
                />
                <p className="text-xs text-muted-foreground">Unique identifier for this profile</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vpn">VPN Config</Label>
                <Input
                  id="vpn"
                  value={formData.vpn}
                  onChange={(e) => setFormData({ ...formData, vpn: e.target.value })}
                  placeholder="wireguard/client-a.conf"
                />
                <p className="text-xs text-muted-foreground">Path to WireGuard (.conf) or OpenVPN (.ovpn) config</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hostname">Hostname</Label>
                <Input
                  id="hostname"
                  value={formData.hostname}
                  onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                  placeholder="ws-client-a"
                />
                <p className="text-xs text-muted-foreground">Custom hostname (requires admin/restart on Windows)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">System default</option>
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Target timezone for timestamp alignment</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dns">DNS Servers</Label>
                <Input
                  id="dns"
                  value={formData.dns}
                  onChange={(e) => setFormData({ ...formData, dns: e.target.value })}
                  placeholder="1.1.1.1,8.8.8.8"
                />
                <p className="text-xs text-muted-foreground">Comma-separated DNS servers</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="proxy">Proxy URL</Label>
                <Input
                  id="proxy"
                  value={formData.proxy}
                  onChange={(e) => setFormData({ ...formData, proxy: e.target.value })}
                  placeholder="socks5://127.0.0.1:1080"
                />
                <p className="text-xs text-muted-foreground">HTTP/SOCKS proxy (http://, https://, socks5://)</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mac_spoof"
                checked={formData.mac_spoof}
                onChange={(e) => setFormData({ ...formData, mac_spoof: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="mac_spoof" className="cursor-pointer">
                Enable MAC Address Spoofing
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Randomizes MAC addresses on active interfaces (requires Administrator)
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); setEditingProfile(null); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={!formData.name}>
                {editingProfile ? 'Update Profile' : 'Create Profile'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
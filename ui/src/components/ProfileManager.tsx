import { useState } from 'react';
import { Plus, Trash2, Edit, Wifi, WifiOff, Shield, CheckCircle, Loader2, RotateCcw, AlertCircle, Info } from 'lucide-react';
import { useProfiles } from '../hooks/useSecWin';
import { cn } from '../lib/utils';

export function ProfileManager() {
  const { profiles, activeProfile, loading, error, create, engage, disengage, remove, reload } = useProfiles();
  const [showCreate, setShowCreate] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    vpn_config: '',
    mac_spoof: false,
    hostname: '',
    timezone: '',
    dns: '',
    proxy: '',
  });
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      if (editingProfile) {
        // For editing, we'd need an update API - for now just recreate
        await remove(editingProfile);
      }
      await create(formData);
      setShowCreate(false);
      setEditingProfile(null);
      resetForm();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save profile');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      vpn_config: '',
      mac_spoof: false,
      hostname: '',
      timezone: '',
      dns: '',
      proxy: '',
    });
  };

  const handleEdit = (profile: typeof profiles[0]) => {
    setFormData({
      name: profile.name,
      vpn_config: profile.vpn_config || '',
      mac_spoof: profile.mac_spoof,
      hostname: profile.hostname || '',
      timezone: profile.timezone || '',
      dns: profile.dns || '',
      proxy: profile.proxy || '',
    });
    setEditingProfile(profile.name);
    setShowCreate(true);
  };

  const handleDelete = async (name: string) => {
    if (window.confirm(`Delete profile "${name}"? This cannot be undone.`)) {
      await remove(name);
    }
  };

  const timezones = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'Pacific/Auckland',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OpSec Profiles</h1>
          <p className="text-muted-foreground mt-1">Manage operational security profiles for engagement isolation</p>
        </div>
        <button onClick={() => { resetForm(); setEditingProfile(null); setShowCreate(true); }} className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Profile
        </button>
      </div>

      {error && (
        <div className="badge badge-error text-sm p-3">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
          <button onClick={reload} className="ml-4 btn-ghost btn-sm">
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Profiles</h2>
            <p className="text-sm text-muted-foreground">{profiles.length} configured</p>
          </div>
          <div className="card-content">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No OpSec Profiles</h3>
                <p className="text-muted-foreground mb-4">Create a profile to isolate your engagement settings</p>
                <button onClick={() => { resetForm(); setShowCreate(true); }} className="btn-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Profile
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => {
                  const isActive = profile.name === activeProfile;
                  return (
                    <div
                      key={profile.name}
                      className={cn(
                        'p-4 rounded-lg border transition-all',
                        isActive ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-accent'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{profile.name}</h3>
                            {isActive && (
                              <span className="badge badge-success">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                            {profile.vpn_config && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                <Wifi className="h-3 w-3" />
                                VPN
                              </span>
                            )}
                            {profile.mac_spoof && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                <Shield className="h-3 w-3" />
                                MAC Spoof
                              </span>
                            )}
                            {profile.hostname && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                <Info className="h-3 w-3" />
                                Host: {profile.hostname}
                              </span>
                            )}
                            {profile.timezone && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                <Info className="h-3 w-3" />
                                TZ: {profile.timezone}
                              </span>
                            )}
                            {profile.dns && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                <Info className="h-3 w-3" />
                                DNS: {profile.dns}
                              </span>
                            )}
                            {profile.proxy && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                <Info className="h-3 w-3" />
                                Proxy
                              </span>
                            )}
                          </div>
                          {!profile.vpn_config && !profile.mac_spoof && !profile.hostname && !profile.timezone && !profile.dns && !profile.proxy && (
                            <p className="text-sm text-muted-foreground italic mt-2">No OpSec features enabled</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {isActive ? (
                            <button
                              onClick={disengage}
                              className="btn-outline btn-sm"
                              disabled={loading}
                            >
                              <WifiOff className="h-4 w-4 mr-1" />
                              Disengage
                            </button>
                          ) : (
                            <button
                              onClick={() => engage(profile.name)}
                              className="btn-primary btn-sm"
                              disabled={loading}
                            >
                              <Wifi className="h-4 w-4 mr-1" />
                              Engage
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(profile)}
                            className="btn-ghost btn-sm"
                            disabled={loading}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(profile.name)}
                            className="btn-ghost btn-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={loading || isActive}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Current Status</h2>
            <p className="text-sm text-muted-foreground">Real-time OpSec status</p>
          </div>
          <div className="card-content">
            {activeProfile ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-green-800 dark:text-green-200">Profile Active</span>
                  </div>
                  <p className="text-lg font-mono text-green-700 dark:text-green-300">{activeProfile}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Active Features:</h4>
                  {(() => {
                    const profile = profiles.find(p => p.name === activeProfile);
                    if (!profile) return null;
                    const features = [];
                    if (profile.vpn_config) features.push(<div key="vpn" className="flex items-center gap-2 text-sm"><Wifi className="h-4 w-4 text-blue-600" /> VPN: <code>{profile.vpn_config}</code></div>);
                    if (profile.mac_spoof) features.push(<div key="mac" className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4 text-purple-600" /> MAC Address Spoofing Enabled</div>);
                    if (profile.hostname) features.push(<div key="host" className="flex items-center gap-2 text-sm"><Info className="h-4 w-4 text-green-600" /> Hostname: <code>{profile.hostname}</code></div>);
                    if (profile.timezone) features.push(<div key="tz" className="flex items-center gap-2 text-sm"><Info className="h-4 w-4 text-yellow-600" /> Timezone: <code>{profile.timezone}</code></div>);
                    if (profile.dns) features.push(<div key="dns" className="flex items-center gap-2 text-sm"><Info className="h-4 w-4 text-orange-600" /> DNS: <code>{profile.dns}</code></div>);
                    if (profile.proxy) features.push(<div key="proxy" className="flex items-center gap-2 text-sm"><Info className="h-4 w-4 text-gray-600" /> Proxy: <code>{profile.proxy}</code></div>);
                    return features.length > 0 ? features : <p className="text-sm text-muted-foreground">No features enabled</p>;
                  })()}
                </div>
                <button onClick={disengage} className="btn-destructive w-full mt-4">
                  <WifiOff className="h-4 w-4 mr-2" />
                  Disengage Profile
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <WifiOff className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Profile</h3>
                <p className="text-muted-foreground mb-4">Engage a profile to apply OpSec settings</p>
                {profiles.length > 0 && (
                  <button
                    onClick={() => engage(profiles[0].name)}
                    className="btn-primary"
                  >
                    <Wifi className="h-4 w-4 mr-2" />
                    Engage {profiles[0].name}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">{editingProfile ? 'Edit Profile' : 'Create Profile'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {formError}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium">Name *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  required
                  disabled={editingProfile}
                />
                {editingProfile && <p className="text-xs text-muted-foreground">Name cannot be changed</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="vpn_config" className="block text-sm font-medium">VPN Config File</label>
                <input
                  id="vpn_config"
                  type="text"
                  value={formData.vpn_config}
                  onChange={(e) => setFormData(prev => ({ ...prev, vpn_config: e.target.value }))}
                  className="input"
                  placeholder="/path/to/config.ovpn or .conf"
                />
                <p className="text-xs text-muted-foreground">WireGuard (.conf) or OpenVPN (.ovpn) config file</p>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.mac_spoof}
                    onChange={(e) => setFormData(prev => ({ ...prev, mac_spoof: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <span className="text-sm font-medium">Enable MAC Address Spoofing</span>
                </label>
                <p className="text-xs text-muted-foreground ml-6">Randomize MAC addresses on all active interfaces</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="hostname" className="block text-sm font-medium">Custom Hostname</label>
                <input
                  id="hostname"
                  type="text"
                  value={formData.hostname}
                  onChange={(e) => setFormData(prev => ({ ...prev, hostname: e.target.value }))}
                  className="input"
                  placeholder="custom-hostname"
                />
                <p className="text-xs text-muted-foreground">Requires system restart to take effect</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="timezone" className="block text-sm font-medium">Timezone</label>
                <select
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                  className="input"
                >
                  <option value="">Select timezone...</option>
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="dns" className="block text-sm font-medium">DNS Servers</label>
                <input
                  id="dns"
                  type="text"
                  value={formData.dns}
                  onChange={(e) => setFormData(prev => ({ ...prev, dns: e.target.value }))}
                  className="input"
                  placeholder="1.1.1.1, 8.8.8.8"
                />
                <p className="text-xs text-muted-foreground">Comma-separated list of DNS servers</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="proxy" className="block text-sm font-medium">Proxy URL</label>
                <input
                  id="proxy"
                  type="text"
                  value={formData.proxy}
                  onChange={(e) => setFormData(prev => ({ ...prev, proxy: e.target.value }))}
                  className="input"
                  placeholder="http://proxy:8080"
                />
                <p className="text-xs text-muted-foreground">HTTP/HTTPS proxy (sets HTTP_PROXY/HTTPS_PROXY env vars)</p>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setShowCreate(false); resetForm(); setEditingProfile(null); }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editingProfile ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
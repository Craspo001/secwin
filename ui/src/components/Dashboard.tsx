import { Shield, Play, UserCog, FolderOpen, Search, Settings, Zap, Terminal, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSystemStatus } from '../hooks/useSecWin';
import { useProfiles } from '../hooks/useSecWin';
import { useTools } from '../hooks/useSecWin';
import { cn, formatBytes } from '../lib/utils';

const quickActions = [
  { name: 'Run Playbook', href: '/playbooks', icon: Play, description: 'Execute security engagement playbooks', color: 'bg-primary/10 text-primary' },
  { name: 'OpSec Profiles', href: '/profiles', icon: UserCog, description: 'Manage VPN, MAC spoofing, DNS, proxy', color: 'bg-blue/10 text-blue-600' },
  { name: 'Evidence Locker', href: '/evidence', icon: FolderOpen, description: 'View and verify collected artifacts', color: 'bg-green/10 text-green-600' },
  { name: 'Findings', href: '/findings', icon: Search, description: 'Review and triage security findings', color: 'bg-purple/10 text-purple-600' },
  { name: 'Tools', href: '/settings?tab=tools', icon: Terminal, description: 'Install and manage security tools', color: 'bg-orange/10 text-orange-600' },
  { name: 'Settings', href: '/settings', icon: Settings, description: 'Configure SecWin preferences', color: 'bg-gray/10 text-gray-600' },
];

const stats = [
  { label: 'Playbooks', value: '3', icon: Play, color: 'text-primary' },
  { label: 'Tools Installed', value: '0', icon: Terminal, color: 'text-blue-600' },
  { label: 'Active Profile', value: 'None', icon: UserCog, color: 'text-green-600' },
  { label: 'Evidence Items', value: '0', icon: FolderOpen, color: 'text-purple-600' },
];

export function Dashboard() {
  const { status, loading: statusLoading, error: statusError, reload: reloadStatus } = useSystemStatus();
  const { activeProfile, profiles, loading: profilesLoading } = useProfiles();
  const { tools, loading: toolsLoading } = useTools();

  const toolsCount = tools.length;
  const evidenceCount = 0; // Would come from useEvidence hook

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to SecWin - Modern Kali Linux Tooling on Windows</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="card">
            <div className="card-content flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold {stat.color}">
                  {i === 2 ? (activeProfile || 'None') : i === 1 ? toolsCount : stat.value}
                </p>
              </div>
              <stat.icon className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="card-title">Quick Actions</h2>
                <p className="text-sm text-muted-foreground">Common tasks and workflows</p>
              </div>
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="card-content space-y-3">
            {quickActions.map((action, i) => (
              <Link
                key={i}
                to={action.href}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent transition-colors group"
              >
                <div className={cn('p-2 rounded-lg', action.color)}>
                  <action.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{action.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                </div>
                <Zap className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="card-title">System Status</h2>
                <p className="text-sm text-muted-foreground">Current environment health</p>
              </div>
              <button onClick={reloadStatus} className="btn-ghost btn-sm" disabled={statusLoading}>
                <Loader2 className={cn('h-4 w-4', statusLoading && 'animate-spin')} />
              </button>
            </div>
          </div>
          <div className="card-content space-y-4">
            {status && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Operating System</span>
                  <span className="font-mono text-sm">{status.os} ({status.arch})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">WSL Available</span>
                  <span className={cn('badge', status.wsl_available ? 'badge-success' : 'badge-error')}>
                    {status.wsl_available ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">WSL Distros</span>
                  <span className="font-mono text-sm">{status.wsl_distros.join(', ') || 'None'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tools Installed</span>
                  <span className="font-mono text-sm">{toolsCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active OpSec Profile</span>
                  <span className={cn('badge', activeProfile ? 'badge-success' : 'badge-info')}>
                    {activeProfile || 'None'}
                  </span>
                </div>
              </>
            )}
            {!status && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>Unable to load system status</p>
                {statusError && <p className="text-sm text-destructive mt-2">{statusError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Available Profiles</h2>
          <p className="text-sm text-muted-foreground">OpSec profiles for engagement isolation</p>
        </div>
        <div className="card-content">
          {profilesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCog className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No OpSec profiles configured</p>
              <Link to="/profiles" className="btn-primary btn-sm mt-4 inline-block">
                Create Profile
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {profiles.slice(0, 6).map((profile) => (
                <div
                  key={profile.name}
                  className={cn(
                    'p-4 rounded-lg border transition-colors',
                    profile.name === activeProfile
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{profile.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {profile.vpn_config && 'VPN • '}{profile.mac_spoof && 'MAC Spoof • '}
                        {profile.hostname && `Hostname: ${profile.hostname} • `}
                        {profile.timezone && `TZ: ${profile.timezone} • `}
                        {profile.dns && `DNS: ${profile.dns} • `}
                        {profile.proxy && `Proxy: ${profile.proxy}`}
                      </p>
                    </div>
                    {profile.name === activeProfile && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
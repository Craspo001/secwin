import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../store';
import {
  LayoutDashboard,
  Shield,
  FolderOpen,
  BookOpen,
  Box,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  BarChart2,
  Brain,
} from 'lucide-react';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'OpSec Profiles', href: '/profiles', icon: Shield },
  { name: 'Evidence Locker', href: '/evidence', icon: FolderOpen },
  { name: 'Playbooks', href: '/playbooks', icon: BookOpen },
  { name: 'Tools', href: '/tools', icon: Box },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Benchmarks', href: '/benchmarks', icon: BarChart2 },
  { name: 'AI Triage', href: '/ai-triage', icon: Brain },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, activeProfile, opsecStatus, secwinAvailable } = useStore();
  const location = useLocation();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-64' : 'w-20'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <NavLink to="/" className="flex items-center gap-2" title="SecWin">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            {sidebarOpen && (
              <span className="text-xl font-bold text-foreground">SecWin</span>
            )}
          </NavLink>
          <button
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto scrollbar-thin" aria-label="Main navigation">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    !sidebarOpen && 'justify-center'
                  )
                }
                title={sidebarOpen ? undefined : item.name}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {sidebarOpen && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Active Profile Status */}
        {sidebarOpen && (
          <div className="border-t p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Active Profile</span>
            </div>
            <div className={clsx(
              'rounded-lg p-3 text-sm transition-colors',
              activeProfile ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-muted/50 border border-border'
            )}>
              {activeProfile ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="font-medium">{activeProfile}</span>
                  </div>
                  {opsecStatus && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {opsecStatus.vpn !== 'none' && (
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          <Shield className="h-3 w-3" />
                          {opsecStatus.vpn}
                        </span>
                      )}
                      {opsecStatus.mac_addresses && Object.keys(opsecStatus.mac_addresses).length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          <AlertTriangle className="h-3 w-3" />
                          MAC Spoofed
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p>No active profile</p>
                  <p className="text-xs mt-1">Create a profile to get started</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SecWin Status */}
        <div className="border-t p-4">
          {sidebarOpen && (
            <div className="flex items-center gap-2 mb-2">
              <Box className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">SecWin CLI</span>
            </div>
          )}
          <div className={clsx(
            'rounded-lg p-3 text-sm transition-colors',
            secwinAvailable ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          )}>
            {sidebarOpen ? (
              secwinAvailable ? (
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Not Found</span>
                </div>
              )
            ) : (
              secwinAvailable ? (
                <ShieldCheck className="h-5 w-5 text-green-500 mx-auto" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500 mx-auto" />
              )
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
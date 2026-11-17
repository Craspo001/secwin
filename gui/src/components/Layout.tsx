'use client';

import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import {
  LayoutDashboard,
  Box,
  FileText,
  Play,
  Shield,
  Terminal,
  Database,
  FileSearch,
  Brain,
  Settings,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tools', href: '/tools', icon: Box },
  { name: 'Playbooks', href: '/playbooks', icon: FileText },
  { name: 'Run Playbook', href: '/playbooks/run', icon: Play },
  { name: 'Profiles', href: '/profiles', icon: Shield },
  { name: 'OpSec', href: '/opsec', icon: Terminal },
  { name: 'Evidence', href: '/evidence', icon: Database },
  { name: 'Reports', href: '/reports', icon: FileSearch },
  { name: 'AI Triage', href: '/ai-triage', icon: Brain },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Layout() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Sun : Moon;

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen bg-card border-r border-border transition-all duration-300 flex flex-col',
          sidebarOpen ? 'w-64' : 'w-16',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center justify-between h-16 px-4 border-b border-border', !sidebarOpen && 'justify-center')}>
          <LogoIcon className="h-8 w-8 text-primary" />
          {sidebarOpen && (
            <span className="ml-2 text-xl font-bold text-foreground">SecWin</span>
          )}
          <button
            className={cn('p-1.5 rounded-lg hover:bg-accent transition-colors', !sidebarOpen && 'ml-auto')}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  'sidebar-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'sidebar-link-active bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  !sidebarOpen && 'justify-center px-2'
                )}
                title={sidebarOpen ? undefined : item.name}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {sidebarOpen && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <div className="p-3 border-t border-border">
          <button
            onClick={toggleTheme}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              !sidebarOpen && 'justify-center px-2'
            )}
            title={sidebarOpen ? undefined : `Theme: ${theme}`}
          >
            <ThemeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            {sidebarOpen && <span>Theme: {theme}</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        )}
      >
        {/* Mobile menu button */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg bg-card border border-border shadow-lg"
            aria-label="Open menu"
          >
            <LogoIcon className="h-6 w-6 text-primary" />
          </button>
        </div>

        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Simple logo icon
function LogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="currentColor"/>
      <path d="M8 12h16M8 16h12M8 20h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
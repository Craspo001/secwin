import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Shield, Play, UserCog, FolderOpen, Search, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Shield },
  { name: 'Playbooks', href: '/playbooks', icon: Play },
  { name: 'Profiles', href: '/profiles', icon: UserCog },
  { name: 'Evidence', href: '/evidence', icon: FolderOpen },
  { name: 'Findings', href: '/findings', icon: Search },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background">
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-full border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-4 border-b border-border">
            {!collapsed && (
              <NavLink to="/" className="flex items-center gap-2 font-semibold text-lg text-primary">
                <Shield className="h-6 w-6" />
                <span>SecWin</span>
              </NavLink>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto" aria-label="Main navigation">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    collapsed && 'justify-center'
                  )}
                  title={collapsed ? item.name : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  {!collapsed && <span>{item.name}</span>}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-border p-4">
            {!collapsed && (
              <div className="text-xs text-muted-foreground">
                <p className="font-medium">SecWin v1.0.0</p>
                <p>Modern Kali Tooling on Windows</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main
        className={cn(
          'flex-1 overflow-auto transition-all duration-300',
          collapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <div className="p-6">{children || <Outlet />}</div>
      </main>
    </div>
  );
}
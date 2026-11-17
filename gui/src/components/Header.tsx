import React from 'react';
import { useStore } from '../store';
import { Sun, Moon, Monitor, Menu, X, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/Tooltip';
import { NotificationBell } from './NotificationBell';

export function Header() {
  const { theme, setTheme, sidebarOpen, toggleSidebar, notifications } = useStore();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <button
        onClick={toggleSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div className="flex-1" />

      {/* Global Search */}
      <div className="hidden md:flex md:items-center md:w-[400px]">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Search className="h-4 w-4" />
                <span>Search tools, playbooks, profiles... (⌘K)</span>
                <kbd className="hidden lg:inline-flex h-5 px-1.5 items-center rounded border bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
                  ⌘K
                </kbd>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">
              <p>Press <kbd className="px-1.5 text-xs font-mono bg-muted rounded">⌘K</kbd> to open search</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
                  const currentIndex = themes.indexOf(theme);
                  setTheme(themes[(currentIndex + 1) % themes.length]);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={`Current theme: ${theme}. Click to cycle.`}
              >
                {theme === 'light' && <Sun className="h-5 w-5" />}
                {theme === 'dark' && <Moon className="h-5 w-5" />}
                {theme === 'system' && <Monitor className="h-5 w-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              <p>Current: {theme.charAt(0).toUpperCase() + theme.slice(1)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Notifications */}
        <NotificationBell count={unreadCount} />

        {/* SecWin Version */}
        <div className="hidden lg:flex lg:h-10 lg:items-center lg:rounded-lg lg:bg-muted lg:px-3 lg:text-xs lg:text-muted-foreground">
          SecWin GUI v1.0.0
        </div>
      </div>
    </header>
  );
}
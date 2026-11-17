import { Sun, Moon, Loader2 } from 'lucide-react'
import type { PlaybookStatus } from '../types'

interface TopBarProps {
  title: string
  onMenuClick: () => void
  darkMode: boolean
  onDarkModeToggle: () => void
  playbookStatus: PlaybookStatus | null
}

export default function TopBar({
  title,
  onMenuClick,
  darkMode,
  onDarkModeToggle,
  playbookStatus,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="flex items-center gap-4">
        <button className="btn-ghost lg:hidden" onClick={onMenuClick} aria-label="Open menu">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="top-bar-title">{title}</h1>
      </div>

      <div className="top-bar-actions">
        {playbookStatus?.running && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
            <span className="text-sm font-medium text-yellow-300">
              Running: {playbookStatus.current_step || 'Initializing...'}
            </span>
            <div className="w-32 h-1.5 bg-yellow-500/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all duration-300"
                style={{ width: `${playbookStatus.progress * 100}%` }}
              />
            </div>
          </div>
        )}

        <button
          className="btn-ghost"
          onClick={onDarkModeToggle}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  )
}
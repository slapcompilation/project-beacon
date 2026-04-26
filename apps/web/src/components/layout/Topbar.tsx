// Layer: meta — top navigation bar (three-zone layout)
// Replaces the sidebar header. Shows logo, hotel switcher, notifications, command bar, copilot toggle.

import { memo } from 'react'
import { BellDot, Command, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { useAlertCount } from '@/hooks/useAlertCount'
import { useUnreadNotificationCount } from '@/features/notifications/hooks'
import { ScopeSwitcher } from './ScopeSwitcher'

export const Topbar = memo(function Topbar() {
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen)
  const toggleCopilot     = useAppStore((s) => s.toggleCopilot)
  const toggleCommandBar  = useAppStore((s) => s.toggleCommandBar)
  const contextPanelOpen  = useAppStore((s) => s.contextPanelOpen)
  const contextPanelTab   = useAppStore((s) => s.contextPanelTab)

  const alertCount       = useAlertCount()
  const unreadNotifCount = useUnreadNotificationCount()
  const totalBadge       = alertCount + unreadNotifCount

  const copilotActive = contextPanelOpen && contextPanelTab === 'copilot'

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-1 px-3">
      {/* ── Left: Logo + Scope switcher (hotel ↔ portfolio) ──────────── */}
      <span className="text-sm font-bold tracking-tight text-foreground mr-1">Beacon</span>
      <ScopeSwitcher />

      {/* ── Spacer ───────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Right: Notifications + Command bar + Copilot ─────────────── */}
      <div className="flex items-center gap-0.5">
        {/* Notification bell */}
        <button
          type="button"
          onClick={() => { setNotifPanelOpen(true) }}
          title="Notifications"
          aria-label="Notifications"
          className="relative rounded p-1.5 text-muted-foreground/70 hover:bg-surface-2 hover:text-foreground transition-colors"
        >
          <BellDot className="h-4 w-4" />
          {totalBadge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white leading-none">
              {totalBadge > 99 ? '99+' : totalBadge}
            </span>
          )}
        </button>

        {/* Command bar trigger */}
        <button
          type="button"
          onClick={toggleCommandBar}
          title="Command bar (Ctrl+K)"
          aria-label="Open command bar"
          className="rounded p-1.5 text-muted-foreground/70 hover:bg-surface-2 hover:text-foreground transition-colors"
        >
          <Command className="h-4 w-4" />
        </button>

        {/* Copilot toggle */}
        <button
          type="button"
          onClick={toggleCopilot}
          title="Toggle Copilot (Ctrl+J)"
          aria-label={copilotActive ? 'Close Copilot' : 'Open Copilot'}
          aria-expanded={copilotActive}
          className={cn(
            'rounded p-1.5 transition-colors',
            copilotActive
              ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400'
              : 'text-muted-foreground/70 hover:bg-surface-2 hover:text-foreground',
          )}
        >
          {copilotActive
            ? <X className="h-4 w-4" />
            : <Sparkles className="h-4 w-4" />
          }
        </button>
      </div>
    </header>
  )
})

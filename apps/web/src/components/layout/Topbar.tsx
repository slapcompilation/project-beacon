// Top nav bar. Logo, scope switcher, AIP signal counters, notifications, command palette, settings, copilot toggle.

import { memo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { useAuthStore } from '@/stores/auth.store'
import { useAlertCount } from '@/hooks/useAlertCount'
import { useUnreadNotificationCount } from '@/features/notifications/hooks'
import { useAipSignalCounts } from '@/features/aipSignals/hooks'
import { ScopeSwitcher } from './ScopeSwitcher'

export const Topbar = memo(function Topbar() {
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen)
  const toggleCopilot     = useAppStore((s) => s.toggleCopilot)
  const toggleCommandBar  = useAppStore((s) => s.toggleCommandBar)
  const contextPanelOpen  = useAppStore((s) => s.contextPanelOpen)
  const contextPanelTab   = useAppStore((s) => s.contextPanelTab)
  const role              = useAuthStore((s) => s.role)

  const alertCount       = useAlertCount()
  const unreadNotifCount = useUnreadNotificationCount()
  const totalBadge       = alertCount + unreadNotifCount

  const copilotActive = contextPanelOpen && contextPanelTab === 'copilot'
  const location      = useLocation()
  const settingsActive = location.pathname.startsWith('/settings')
  const aipVisible     = role === 'admin' || role === 'owner'

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-1 px-3">
      <span className="text-sm font-bold tracking-tight text-foreground mr-1">Beacon</span>
      <ScopeSwitcher />

      {aipVisible && <AipSignalStrip />}

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => { setNotifPanelOpen(true) }}
          title="Notifications"
          aria-label="Notifications"
          className="relative rounded p-1.5 text-muted-foreground/70 hover:bg-surface-2 hover:text-foreground transition-colors"
        >
          <Icon icon="notifications" size={14} />
          {totalBadge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white leading-none">
              {totalBadge > 99 ? '99+' : totalBadge}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={toggleCommandBar}
          title="Command bar (Ctrl+K)"
          aria-label="Open command bar"
          className="rounded p-1.5 text-muted-foreground/70 hover:bg-surface-2 hover:text-foreground transition-colors"
        >
          <Icon icon="key-command" size={14} />
        </button>

        <Link
          to="/settings"
          title="Settings"
          aria-label="Settings"
          aria-current={settingsActive ? 'page' : undefined}
          className={cn(
            'rounded p-1.5 transition-colors',
            settingsActive
              ? 'bg-surface-2 text-foreground'
              : 'text-muted-foreground/70 hover:bg-surface-2 hover:text-foreground',
          )}
        >
          <Icon icon="cog" size={14} />
        </Link>

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
          <Icon icon={copilotActive ? 'cross' : 'predictive-analysis'} size={14} />
        </button>
      </div>
    </header>
  )
})

// AIP signal counters. One pill per queue with a live count. Click to jump
// into Mind's AIP shell on the matching tab. Single RPC round-trip behind
// useAipSignalCounts.
function AipSignalStrip() {
  const { data } = useAipSignalCounts()
  const counts = data ?? { queue: 0, approvals: 0, entityLinks: 0 }

  const items: { tab: string; label: string; icon: IconName; count: number; tone: string }[] = [
    { tab: 'queue',        label: 'Queue',     icon: 'predictive-analysis', count: counts.queue,       tone: 'text-violet-500' },
    { tab: 'approvals',    label: 'Approvals', icon: 'warning-sign',        count: counts.approvals,   tone: 'text-amber-500'  },
    { tab: 'entity-links', label: 'Links',     icon: 'search-template',     count: counts.entityLinks, tone: 'text-blue-500'   },
  ]

  return (
    <div className="hidden md:flex items-center gap-1 ml-2 pl-2 border-l border-border/60">
      {items.map((i) => (
        <Link
          key={i.tab}
          to={`/mind?panel=aip&aip=${i.tab}`}
          title={`${i.label}: ${String(i.count)} pending`}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors',
            i.count > 0
              ? 'text-foreground hover:bg-surface-2'
              : 'text-muted-foreground/60 hover:bg-surface-2 hover:text-foreground',
          )}
        >
          <Icon icon={i.icon} size={12} className={i.count > 0 ? i.tone : undefined} />
          <span className="hidden lg:inline">{i.label}</span>
          <span className={cn('tabular-nums', i.count > 0 && 'font-semibold')}>{String(i.count)}</span>
        </Link>
      ))}
    </div>
  )
}

// Layer: meta — top navigation bar (three-zone layout)
// Replaces the sidebar header. Shows logo, hotel switcher, notifications, command bar, copilot toggle.

import { memo } from 'react'
import {
  Building2, ChevronDown, BellDot, Command, Sparkles, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { useHotels } from '@/features/hotel/hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAlertCount } from '@/hooks/useAlertCount'
import { useUnreadNotificationCount } from '@/features/notifications/hooks'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const Topbar = memo(function Topbar() {
  const activeHotelId = useActiveHotelId()
  const { data: hotels = [] } = useHotels()
  const activeHotel = hotels.find((h) => h.id === activeHotelId)

  const setActiveHotelId  = useAppStore((s) => s.setActiveHotelId)
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
      {/* ── Left: Logo + Hotel switcher ──────────────────────────────── */}
      <span className="text-sm font-bold tracking-tight text-foreground mr-1">Beacon</span>

      {hotels.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors max-w-[140px]">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{activeHotel?.name ?? '…'}</span>
            <ChevronDown className="h-2.5 w-2.5 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {hotels.map((h) => (
              <DropdownMenuItem
                key={h.id}
                onClick={() => { setActiveHotelId(h.id) }}
                className={h.id === activeHotelId ? 'font-semibold' : ''}
              >
                {h.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : activeHotel ? (
        <span className="text-[10px] text-muted-foreground/50 truncate max-w-[120px]">
          {activeHotel.name}
        </span>
      ) : null}

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

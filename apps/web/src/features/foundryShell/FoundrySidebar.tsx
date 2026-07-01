// FoundrySidebar — Phase 1 of the AIP visual-parity roadmap
// (docs/AIP-UX-RESTRUCTURE.md §0.4). A faithful replica of Foundry's expanded
// left sidebar: a dark, ~240px, 5-section vertical rail, mapped to Beacon's
// surfaces. Presentational only — the preview page drives state; wiring it in as
// the global nav (retiring the bottom CommandDock) is the next step, after the
// pixels are calibrated against the reference screenshots.
//
// Foundry's sidebar is always dark (even under the light theme), so this forces
// its own dark palette rather than following the app tokens.

import { useState } from 'react'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'

export interface RailItem {
  id: string
  label: string
  icon: IconName
  /** Right-aligned keyboard hint, e.g. '⌘J'. */
  shortcut?: string
  /** Small count badge (notifications). */
  badge?: number
  /** Orange dot (What's New). */
  dot?: boolean
  /** Optional colour for the item's icon tile (favorited apps). */
  tint?: string
  subtitle?: string
}

export interface RailSection {
  /** Uppercase header; omit for the unlabeled top sections. */
  header?: string
  /** Shows a right-aligned "View all". */
  viewAll?: boolean
  items: RailItem[]
  /** Placeholder text when items is empty (e.g. favorites). */
  empty?: string
}

const SECTIONS: RailSection[] = [
  {
    items: [
      { id: 'home',    label: 'Home',          icon: 'home' },
      { id: 'search',  label: 'Search…',       icon: 'search', shortcut: '⌘J' },
      { id: 'notifs',  label: 'Notifications', icon: 'notifications', badge: 3 },
      { id: 'whatsnew',label: "What's New",    icon: 'star', dot: true },
    ],
  },
  {
    items: [
      { id: 'recent', label: 'Recent',       icon: 'history' },
      { id: 'objects',label: 'Objects',      icon: 'cube' },
      { id: 'apps',   label: 'Applications', icon: 'grid-view' },
    ],
  },
  {
    header: 'Applications', viewAll: true,
    items: [
      { id: 'decisions', label: 'Decisions', icon: 'inbox',               tint: '#8b5cf6' },
      { id: 'insights',  label: 'Insights',  icon: 'timeline-line-chart', tint: '#f59e0b' },
      { id: 'studio',    label: 'Studio',    icon: 'build',               tint: '#3b82f6' },
    ],
  },
  {
    header: 'Files',
    empty: 'Your starred objects will appear here.',
    items: [],
  },
]

const BOTTOM: RailItem[] = [
  { id: 'copilot', label: 'Copilot', icon: 'chat', shortcut: '⌘⇧U' },
  { id: 'support', label: 'Support', icon: 'help' },
]

export function FoundrySidebar({
  activeId = 'home',
  onSelect,
  accountInitials = 'CL',
}: {
  activeId?: string
  onSelect?: (id: string) => void
  accountInitials?: string
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pick = (id: string) => () => onSelect?.(id)

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-[#1b1f26] text-[#e7e9ee] select-none',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      {/* Orb + collapse toggle */}
      <div className={cn('flex items-center h-12 px-3 shrink-0', collapsed && 'justify-center px-0')}>
        <span className="h-6 w-6 rounded-full bg-[conic-gradient(at_50%_50%,#f59e0b,#ec4899,#8b5cf6,#3b82f6,#22d3ee,#f59e0b)] shrink-0" />
        {!collapsed && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={() => { setCollapsed(true) }}
            className="ml-auto text-[#8a93a6] hover:text-white transition-colors"
          >
            <Icon icon="menu-closed" size={16} />
          </button>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          aria-label="Expand sidebar"
          onClick={() => { setCollapsed(false) }}
          className="mb-1 flex justify-center text-[#8a93a6] hover:text-white"
        >
          <Icon icon="menu-open" size={16} />
        </button>
      )}

      <nav className="flex-1 overflow-y-auto py-1">
        {SECTIONS.map((section, i) => (
          <div key={section.header ?? `top-${String(i)}`} className="mb-2">
            {section.header && !collapsed && (
              <div className="flex items-center justify-between px-4 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7482]">{section.header}</span>
                {section.viewAll && <span className="text-[11px] text-[#8a93a6] hover:text-white cursor-pointer">View all</span>}
              </div>
            )}
            {section.items.length === 0 && section.empty && !collapsed ? (
              <p className="px-4 py-1 text-[11px] leading-snug text-[#6b7482]">{section.empty}</p>
            ) : (
              section.items.map((item) => (
                <RailRow key={item.id} item={item} active={item.id === activeId} collapsed={collapsed} onClick={pick(item.id)} />
              ))
            )}
            {i < SECTIONS.length - 1 && <div className="mx-3 mt-2 border-b border-white/5" />}
          </div>
        ))}
      </nav>

      {/* Bottom tools */}
      <div className="shrink-0 border-t border-white/5 py-1">
        {BOTTOM.map((item) => (
          <RailRow key={item.id} item={item} active={item.id === activeId} collapsed={collapsed} onClick={pick(item.id)} />
        ))}
        <button
          type="button"
          onClick={pick('account')}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-2 text-[13px] transition-colors hover:bg-white/5',
            collapsed && 'justify-center px-0',
          )}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3b5aa0] text-[10px] font-semibold text-white shrink-0">
            {accountInitials}
          </span>
          {!collapsed && <span className="text-[#e7e9ee]">Account</span>}
        </button>
      </div>
    </aside>
  )
}

function RailRow({
  item, active, collapsed, onClick,
}: {
  item: RailItem
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.label}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2 text-[13px] transition-colors',
        collapsed && 'justify-center px-0',
        active ? 'bg-white/10 text-white' : 'text-[#cfd4dd] hover:bg-white/5 hover:text-white',
      )}
    >
      <span className="relative shrink-0">
        {item.tint ? (
          <span className="flex h-5 w-5 items-center justify-center rounded" style={{ backgroundColor: `${item.tint}22` }}>
            <Icon icon={item.icon} size={13} color={item.tint} />
          </span>
        ) : (
          <Icon icon={item.icon} size={16} className="text-[#98a1b0]" />
        )}
        {item.dot && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">
            {item.label}
            {item.subtitle && <span className="block text-[10px] italic text-[#6b7482]">{item.subtitle}</span>}
          </span>
          {item.badge != null && item.badge > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/90 px-1 text-[9px] font-bold text-black leading-none">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
          {item.shortcut && <span className="text-[11px] text-[#6b7482] tracking-wide">{item.shortcut}</span>}
        </>
      )}
    </button>
  )
}

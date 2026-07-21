// FoundrySidebar — Phase 1 of the AIP visual-parity roadmap
// (docs/AIP-UX-RESTRUCTURE.md §0.4). A faithful replica of Foundry's expanded
// left sidebar: a dark, ~240px, 5-section vertical rail, mapped to Beacon's
// surfaces. Presentational only — the preview page drives state; wiring it in as
// the global nav (retiring the bottom CommandDock) is the next step, after the
// pixels are calibrated against the reference screenshots.
//
// Foundry's sidebar is always dark (even under the light theme), so this forces
// its own dark palette rather than following the app tokens.

import { useState, type ReactNode, type ReactElement } from 'react'
import { Icon, Popover, Tooltip } from '@blueprintjs/core'
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
      { id: 'notifs',  label: 'Notifications', icon: 'notifications' },
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
    // The pinned core apps — distinct from the §2 "Applications" portal row.
    // (Same-named header + a View all to the same page read as a duplicate.)
    header: 'Pinned', viewAll: false,
    items: [
      { id: 'decisions', label: 'Decisions', icon: 'inbox' },
      { id: 'insights',  label: 'Insights',  icon: 'timeline-line-chart' },
      { id: 'studio',    label: 'Studio',    icon: 'build' },
    ],
  },
  {
    header: 'Files', viewAll: true,
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
  headerSlot,
  popovers,
  filesItems,
  badges,
  dots,
  onViewAll,
  accountMenu,
}: {
  activeId?: string
  onSelect?: (id: string) => void
  accountInitials?: string
  /** Clicking a section's "View all" (by header). */
  onViewAll?: (header: string) => void
  /** Popover menu for the bottom Account button (identity + sign out). */
  accountMenu?: ReactElement
  /** id → live count, overrides an item's static badge (e.g. notifications). */
  badges?: Record<string, number>
  /** id → whether to show the amber dot, overriding the item's static dot (What's New). */
  dots?: Record<string, boolean>
  /** Rendered under the orb, above the nav — the app injects a "+ New" here. */
  headerSlot?: ReactNode
  /** id → rich popover panel (e.g. Recent). When present, the row opens the
   *  panel on click instead of navigating; other rows show a label tooltip. */
  popovers?: Record<string, ReactElement>
  /** Populates the Files section with favorited objects (the star system). */
  filesItems?: RailItem[]
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pick = (id: string) => () => onSelect?.(id)

  const accountBtn = (
    <button
      type="button"
      onClick={accountMenu ? undefined : pick('account')}
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
  )

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-[#1b1f26] text-[#e7e9ee] select-none',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      {/* Orb + collapse toggle */}
      <div className={cn('flex items-center h-12 px-3 shrink-0', collapsed && 'justify-center px-0')}>
        <span className="flex h-6 w-6 items-center justify-center rounded bg-[#2d72d2] shrink-0">
          <Icon icon="layers" size={13} color="#fff" />
        </span>
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

      {headerSlot && !collapsed && <div className="px-3 pb-2 pt-1">{headerSlot}</div>}

      <nav className="flex-1 overflow-y-auto py-1">
        {SECTIONS.map((section, i) => {
          // The Files section is populated live from the favorites store.
          const items = section.header === 'Files' && filesItems ? filesItems : section.items
          return (
          <div key={section.header ?? `top-${String(i)}`} className="mb-2">
            {section.header && !collapsed && (
              <div className="flex items-center justify-between px-4 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7482]">{section.header}</span>
                {section.viewAll && (
                  <button type="button" onClick={() => onViewAll?.(section.header ?? '')} className="text-[11px] text-[#8a93a6] hover:text-white">View all</button>
                )}
              </div>
            )}
            {items.length === 0 && section.empty && !collapsed ? (
              <p className="px-4 py-1 text-[11px] leading-snug text-[#6b7482]">{section.empty}</p>
            ) : (
              items.map((item) => (
                <RailRow key={item.id} item={{ ...item, badge: badges?.[item.id] ?? item.badge, dot: dots?.[item.id] ?? item.dot }} active={item.id === activeId} collapsed={collapsed} onClick={pick(item.id)} popover={popovers?.[item.id]} />
              ))
            )}
            {i < SECTIONS.length - 1 && <div className="mx-3 mt-2 border-b border-white/5" />}
          </div>
          )
        })}
      </nav>

      {/* Bottom tools */}
      <div className="shrink-0 border-t border-white/5 py-1">
        {BOTTOM.map((item) => (
          <RailRow key={item.id} item={{ ...item, badge: badges?.[item.id] ?? item.badge }} active={item.id === activeId} collapsed={collapsed} onClick={pick(item.id)} popover={popovers?.[item.id]} />
        ))}
        {accountMenu
          ? <Popover fill content={accountMenu} placement="right-end">{accountBtn}</Popover>
          : accountBtn}
      </div>
    </aside>
  )
}

function RailRow({
  item, active, collapsed, onClick, popover,
}: {
  item: RailItem
  active: boolean
  collapsed: boolean
  onClick: () => void
  popover?: ReactElement
}) {
  const button = (
    <button
      type="button"
      onClick={popover ? undefined : onClick}
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

  // A rich popover (e.g. Recent) opens a panel on click; otherwise a collapsed
  // icon gets a styled label tooltip. Expanded plain rows render as-is.
  if (popover) {
    return <Popover fill content={popover} placement="right-start" popoverClassName="bp5-popover-content-sizing">{button}</Popover>
  }
  if (collapsed) {
    return <Tooltip fill compact content={item.label} placement="right">{button}</Tooltip>
  }
  return button
}

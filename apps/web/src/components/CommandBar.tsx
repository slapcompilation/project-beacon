// Global Cmd+K palette. Search across pages, products, variants, suppliers.

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Icon, InputGroup } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useAppStore } from '@/stores/app.store'
import { cn } from '@/lib/utils'
import {
  useQuickSearch, quickHitPath, QUICK_HIT_GROUP, type QuickHit,
} from '@/features/search/useQuickSearch'

type NavGroup = 'Floor' | 'Flow' | 'Insights' | 'Decisions' | 'Operations' | 'Settings'

interface NavItem {
  group: NavGroup
  icon: IconName
  label: string
  path: string
  shortcut?: string
}

const NAV_ITEMS: NavItem[] = [


  { group: 'Settings',  icon: 'folder-close', label: 'Projects & access',      path: '/projects' },

  { group: 'Decisions', icon: 'predictive-analysis', label: 'Decisions · Review Queue', path: '/review-queue',          shortcut: 'G Q' },
  { group: 'Decisions', icon: 'predictive-analysis', label: 'Decisions · Agent Studio', path: '/agent-studio',          shortcut: 'G A' },
  { group: 'Decisions', icon: 'path',                label: 'Create a workflow',        path: '/create-workflow' },
  { group: 'Decisions', icon: 'function',            label: 'Decisions · Logic Tools',  path: '/tools',                 shortcut: 'G L' },
  { group: 'Decisions', icon: 'predictive-analysis', label: 'Decisions · Modeling Objectives', path: '/modeling-objectives', shortcut: 'G M' },
  { group: 'Decisions', icon: 'graph',               label: 'Decisions · System Map',          path: '/system-map',          shortcut: 'G X' },
  { group: 'Decisions', icon: 'warning-sign',        label: 'Decisions · Pending Approvals',   path: '/pending-approvals',   shortcut: 'G P' },
  { group: 'Decisions', icon: 'bookmark',            label: 'Decisions · Approved Answers',    path: '/approved-answers',    shortcut: 'G Y' },
  { group: 'Decisions', icon: 'folder-open',         label: 'Decisions · Cases',               path: '/cases',               shortcut: 'G C' },
  { group: 'Decisions', icon: 'document',            label: 'Decisions · Documents',           path: '/documents',           shortcut: 'G D' },
  { group: 'Decisions', icon: 'search-template',     label: 'Decisions · Entity Link Suggestions', path: '/entity-link-suggestions', shortcut: 'G E' },
  { group: 'Decisions', icon: 'link',                label: 'Decisions · Action Chains',       path: '/action-chains',       shortcut: 'G N' },
  { group: 'Decisions', icon: 'chat',                label: 'Decisions · Copilot Config',      path: '/copilot-config',      shortcut: 'G O' },
  { group: 'Decisions', icon: 'time',        label: 'Forecast Lab',       path: '/mind?aip=forecast-lab' },
  { group: 'Settings',  icon: 'people',      label: 'Team',               path: '/settings?section=team' },
  { group: 'Settings',  icon: 'cog',         label: 'Settings',           path: '/settings' },
]

function Row({
  icon, children, onSelect, shortcut, focused,
}: {
  icon: IconName
  children: React.ReactNode
  onSelect: () => void
  shortcut?: string
  focused?: boolean
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault() }}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors',
        focused ? 'bg-primary/10' : 'hover:bg-muted',
      )}
    >
      <Icon icon={icon} size={14} className="text-muted-foreground flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {shortcut && (
        <span className="text-[10px] font-mono text-muted-foreground">{shortcut}</span>
      )}
    </button>
  )
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-1">
      <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {heading}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

export function CommandBar() {
  const open    = useAppStore((s) => s.commandBarOpen)
  const setOpen = useAppStore((s) => s.setCommandBarOpen)

  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const toggleCopilot = useAppStore((s) => s.toggleCopilot)

  const go = useCallback((path: string) => {
    setOpen(false)
    void navigate(path)
  }, [navigate, setOpen])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const q = query.trim().toLowerCase()
  const matches = (haystack: string) => !q || haystack.toLowerCase().includes(q)

  const matchedNav = useMemo(() =>
    NAV_ITEMS.filter((item) => matches(item.label) || matches(item.group)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [q])

  const navByGroup = useMemo(() =>
    matchedNav.reduce<Record<string, NavItem[]>>((acc, item) => {
      const list = acc[item.group] ?? []
      list.push(item)
      acc[item.group] = list
      return acc
    }, {}),
  [matchedNav])

  // The ontology, the applications and the documents — server-side, because
  // ranking one against another needs the object type's status and visibility
  // (migration 326), and none of it is loaded on the client.
  const { data: ontologyHits = [] } = useQuickSearch(query)
  const hitGroups = useMemo(() => {
    const by = new Map<string, QuickHit[]>()
    for (const h of ontologyHits) {
      const g = QUICK_HIT_GROUP[h.kind]
      by.set(g, [...(by.get(g) ?? []), h])
    }
    return [...by.entries()]
  }, [ontologyHits])

  const totalResults = matchedNav.length + ontologyHits.length

  // Keyboard focus index across all visible rows, in render order
  const [focusIdx, setFocusIdx] = useState(0)
  useEffect(() => { setFocusIdx(0) }, [q])

  const flatActions = useRef<(() => void)[]>([])
  flatActions.current = []
  const action = (fn: () => void) => {
    flatActions.current.push(fn)
    return flatActions.current.length - 1
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx((i) => Math.min(flatActions.current.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      flatActions.current[focusIdx]?.()
    }
  }

  return (
    <Dialog
      isOpen={open}
      onClose={() => { setOpen(false) }}
      className="!w-[36rem] !p-0 !bg-background"
      shouldReturnFocusOnClose={false}
    >
      <div className="border-b px-3 py-2">
        <InputGroup
          leftIcon="search"
          placeholder="Search pages, products, variants, suppliers…"
          value={query}
          onChange={(e) => { setQuery(e.target.value) }}
          onKeyDown={handleKeyDown}
          size="large"
          autoFocus
          fill
        />
      </div>

      <div className="max-h-[28rem] overflow-y-auto py-1">
        {totalResults === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Icon icon="search" size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results for "{query}"</p>
          </div>
        )}

        {hitGroups.map(([heading, hits]) => (
          <Group key={heading} heading={heading}>
            {hits.map((h) => {
              const path = quickHitPath(h)
              const idx = action(() => { go(path) })
              return (
                <Row key={`${h.kind}-${h.id}`} icon={h.icon as IconName}
                  onSelect={() => { go(path) }} focused={focusIdx === idx}>
                  <span className="flex items-center gap-1 truncate text-xs font-medium">
                    {h.title}
                    {h.promoted && (
                      <Icon icon="endorsed" size={10} className="text-violet-500 flex-shrink-0"
                        title="Promoted — recommended for everyone" />
                    )}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">{h.subtitle}</span>
                </Row>
              )
            })}
          </Group>
        ))}


        {Object.entries(navByGroup).map(([group, items]) => (
          <Group key={group} heading={group}>
            {items.map((item) => {
              const idx = action(() => { go(item.path) })
              return (
                <Row
                  key={`${item.group}-${item.label}`}
                  icon={item.icon}
                  onSelect={() => { go(item.path) }}
                  shortcut={item.shortcut}
                  focused={focusIdx === idx}
                >
                  {item.label}
                </Row>
              )
            })}
          </Group>
        ))}

        <Group heading="Quick Actions">
          {(() => {
            const idxApps = action(() => { go('/applications') })
            const idx1 = action(() => { setOpen(false); toggleCopilot() })
            const idx2 = action(() => { go('/flow?panel=receive') })
            const idx3 = action(() => { go('/flow?panel=approvals') })
            const idx4 = action(() => { go('/notifications') })
            const idx5 = action(() => { go('/eye?panel=waste') })
            return (
              <>
                <Row icon="grid-view" onSelect={() => { go('/applications') }} focused={focusIdx === idxApps}>
                  Open Applications
                </Row>
                <Row icon="predictive-analysis" onSelect={() => { setOpen(false); toggleCopilot() }} shortcut="Ctrl+J" focused={focusIdx === idx1}>
                  Toggle Copilot
                </Row>
                <Row icon="confirm" onSelect={() => { go('/flow?panel=receive') }} focused={focusIdx === idx2}>
                  Receive Stock
                </Row>
                <Row icon="refresh" onSelect={() => { go('/flow?panel=approvals') }} focused={focusIdx === idx3}>
                  New Restock Request
                </Row>
                <Row icon="notifications" onSelect={() => { go('/notifications') }} focused={focusIdx === idx4}>
                  View Notifications
                </Row>
                <Row icon="warning-sign" onSelect={() => { go('/eye?panel=waste') }} focused={focusIdx === idx5}>
                  Waste Radar
                </Row>
              </>
            )
          })()}
        </Group>

      </div>
    </Dialog>
  )
}

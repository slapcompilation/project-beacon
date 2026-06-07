// Global Cmd+K palette. Search across pages, products, variants, suppliers.

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog, Icon, InputGroup } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useProducts } from '@/features/inventory/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useAutoAlerts } from '@/features/notifications/hooks'
import { useRestockCycle } from '@/features/agents/useRestockCycle'
import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'
import { hasPermission } from '@beacon/types'
import { stockUrgency } from '@beacon/reality-graph'
import { cn } from '@/lib/utils'

type NavGroup = 'Floor' | 'Flow' | 'Eye' | 'Mind'

interface NavItem {
  group: NavGroup
  icon: IconName
  label: string
  path: string
  shortcut?: string
}

const NAV_ITEMS: NavItem[] = [
  { group: 'Floor', icon: 'book',            label: 'Briefing',           path: '/briefing',              shortcut: 'G B' },
  { group: 'Floor', icon: 'barcode',         label: 'Floor · Stock',      path: '/floor?panel=stock',     shortcut: 'G I' },
  { group: 'Floor', icon: 'barcode',         label: 'Floor · Scan',       path: '/scan',                  shortcut: 'G S' },
  { group: 'Floor', icon: 'calendar',        label: 'Floor · Expiry',     path: '/floor?panel=expiry' },
  { group: 'Floor', icon: 'warning-sign',    label: 'Floor · Alerts',     path: '/floor?panel=alerts' },
  { group: 'Floor', icon: 'clipboard',       label: 'Floor · Stocktake',  path: '/floor?panel=stocktake', shortcut: 'G T' },
  { group: 'Floor', icon: 'tag',             label: 'Floor · Labels',     path: '/labels' },

  { group: 'Flow',  icon: 'swap-horizontal', label: 'Flow · Overview',    path: '/flow',                  shortcut: 'G F' },
  { group: 'Flow',  icon: 'confirm',         label: 'Flow · Receive',     path: '/flow?panel=receive' },
  { group: 'Flow',  icon: 'truck',           label: 'Flow · Approvals',   path: '/flow?panel=approvals',  shortcut: 'G R' },
  { group: 'Flow',  icon: 'document',        label: 'Flow · Audit Log',   path: '/audit' },

  { group: 'Eye',   icon: 'eye-open',        label: 'Eye · Signals',      path: '/eye?panel=signals' },
  { group: 'Eye',   icon: 'eye-open',        label: 'Eye · Incidents',    path: '/eye?panel=incidents' },
  { group: 'Eye',   icon: 'eye-open',        label: 'Eye · Waste Radar',  path: '/eye?panel=waste' },
  { group: 'Eye',   icon: 'eye-open',        label: 'Eye · Restock Queue',path: '/eye?panel=restock' },
  { group: 'Eye',   icon: 'eye-open',        label: 'Eye · Risk Matrix',  path: '/eye?panel=risk' },
  { group: 'Eye',   icon: 'eye-open',        label: 'Eye · Performance',  path: '/eye?panel=performance' },
  { group: 'Eye',   icon: 'eye-open',        label: 'Eye · Occupancy',    path: '/eye?panel=occupancy' },
  { group: 'Eye',   icon: 'notifications',   label: 'Notifications',      path: '/notifications' },
  { group: 'Eye',   icon: 'time',            label: 'Reminders',          path: '/reminders' },
  { group: 'Eye',   icon: 'pulse',           label: 'Live Monitor',       path: '/monitor' },
  { group: 'Eye',   icon: 'graph',           label: 'Reality Graph',      path: '/graph' },

  { group: 'Mind',  icon: 'predictive-analysis', label: 'Mind · Review Queue', path: '/review-queue',          shortcut: 'G Q' },
  { group: 'Mind',  icon: 'predictive-analysis', label: 'Mind · Agent Studio', path: '/agent-studio',          shortcut: 'G A' },
  { group: 'Mind',  icon: 'function',            label: 'Mind · Logic Tools',  path: '/tools',                 shortcut: 'G L' },
  { group: 'Mind',  icon: 'predictive-analysis', label: 'Mind · Modeling Objectives', path: '/modeling-objectives', shortcut: 'G M' },
  { group: 'Mind',  icon: 'graph',               label: 'Mind · System Map',          path: '/system-map',          shortcut: 'G X' },
  { group: 'Mind',  icon: 'warning-sign',        label: 'Mind · Pending Approvals',   path: '/pending-approvals',   shortcut: 'G P' },
  { group: 'Mind',  icon: 'bookmark',            label: 'Mind · Approved Answers',    path: '/approved-answers',    shortcut: 'G Y' },
  { group: 'Mind',  icon: 'folder-open',         label: 'Mind · Cases',               path: '/cases',               shortcut: 'G C' },
  { group: 'Mind',  icon: 'document',            label: 'Mind · Documents',           path: '/documents',           shortcut: 'G D' },
  { group: 'Mind',  icon: 'search-template',     label: 'Mind · Entity Link Suggestions', path: '/entity-link-suggestions', shortcut: 'G E' },
  { group: 'Mind',  icon: 'link',                label: 'Mind · Action Chains',       path: '/action-chains',       shortcut: 'G N' },
  { group: 'Mind',  icon: 'chat',                label: 'Mind · Copilot Config',      path: '/copilot-config',      shortcut: 'G O' },
  { group: 'Mind',  icon: 'lightbulb',       label: 'Mind · Triage',      path: '/mind?panel=triage' },
  { group: 'Mind',  icon: 'truck',           label: 'Mind · Suppliers',   path: '/mind?panel=suppliers' },
  { group: 'Mind',  icon: 'shopping-cart',   label: 'Mind · PO Builder',  path: '/mind?panel=procurement' },
  { group: 'Mind',  icon: 'shopping-cart',   label: 'Mind · PO Dispatch', path: '/mind?panel=dispatch' },
  { group: 'Mind',  icon: 'document',        label: 'Mind · Contracts',   path: '/mind?panel=contracts' },
  { group: 'Mind',  icon: 'lightbulb',       label: 'Mind · Finance',     path: '/mind?panel=finance' },
  { group: 'Mind',  icon: 'lightbulb',       label: 'Mind · GL Export',   path: '/mind?panel=gl' },
  { group: 'Mind',  icon: 'chart',           label: 'Mind · Strategy',    path: '/mind?panel=strategy' },
  { group: 'Mind',  icon: 'time',            label: 'Event Planner',      path: '/events' },
  { group: 'Mind',  icon: 'people',          label: 'Team',               path: '/settings?section=team' },
  { group: 'Mind',  icon: 'cog',             label: 'Settings',           path: '/settings' },
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
  const role     = useAuthStore((s) => s.role)
  const canAdmin = !!role && hasPermission(role, 'can_approve_restocks')

  const toggleCopilot = useAppStore((s) => s.toggleCopilot)
  const { data: products  = [] } = useProducts()
  const { data: suppliers = [] } = useSuppliers()
  const autoAlerts   = useAutoAlerts()
  const restockCycle = useRestockCycle()
  const runRestockCycle = useCallback(() => {
    restockCycle.mutate(undefined, {
      onSuccess: (r) => {
        toast.success(`Restock cycle: ${String(r.autoExecuted)} auto-executed, ${String(r.queued)} queued (${String(r.scanned)} scanned)`)
      },
      onError: (err: Error) => { toast.error(err.message) },
    })
  }, [restockCycle])

  const go = useCallback((path: string) => {
    setOpen(false)
    void navigate(path)
  }, [navigate, setOpen])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const q = query.trim().toLowerCase()
  const matches = (haystack: string) => !q || haystack.toLowerCase().includes(q)

  const matchedProducts = useMemo(() => {
    if (!q) return products.slice(0, 5)
    return products.filter((p) =>
      matches(p.name) || matches(p.sku) ||
      p.product_variants.some((v) => matches(v.sku) || matches(v.name))
    ).slice(0, 8)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, products])

  const matchedVariants = useMemo(() => {
    if (!q || q.length < 2) return []
    const hits: { id: string; name: string; productName: string; stock: number; urgency: ReturnType<typeof stockUrgency> }[] = []
    for (const p of products) {
      for (const v of p.product_variants) {
        if (matches(v.name) || matches(v.sku) || matches(p.name)) {
          hits.push({ id: v.id, name: v.name, productName: p.name, stock: v.current_stock, urgency: stockUrgency(v) })
          if (hits.length >= 6) break
        }
      }
      if (hits.length >= 6) break
    }
    return hits
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, products])

  const matchedSuppliers = useMemo(() => {
    if (!q) return suppliers.slice(0, 4)
    return suppliers.filter((s) =>
      matches(s.name) || matches(s.email ?? '') || matches(s.contact_name ?? '')
    ).slice(0, 6)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, suppliers])

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

  const totalResults =
    matchedProducts.length + matchedVariants.length + matchedSuppliers.length + matchedNav.length

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

        {matchedVariants.length > 0 && (
          <Group heading="Variants">
            {matchedVariants.map((v) => {
              const idx = action(() => { go(`/variant/${v.id}`) })
              const urgencyColor =
                v.urgency === 'critical' ? 'text-red-600 font-semibold' :
                v.urgency === 'low'      ? 'text-amber-600 font-semibold' :
                'text-muted-foreground'
              return (
                <Row key={v.id} icon="box" onSelect={() => { go(`/variant/${v.id}`) }} focused={focusIdx === idx}>
                  <span className="block truncate text-xs font-medium">{v.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{v.productName}</span>
                  <span className={cn('absolute right-12 text-[10px] tabular-nums', urgencyColor)}>
                    {v.stock} units
                  </span>
                </Row>
              )
            })}
          </Group>
        )}

        {matchedProducts.length > 0 && (
          <Group heading={q ? `Products matching "${query}"` : 'Products'}>
            {matchedProducts.map((p) => {
              const idx = action(() => { go(`/product/${p.id}`) })
              const totalStock = p.product_variants.reduce((s, v) => s + v.current_stock, 0)
              const isOut = totalStock === 0
              const isLow = !isOut && p.product_variants.some(
                (v) => v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold
              )
              const stockClass = isOut ? 'text-red-600 font-semibold' : isLow ? 'text-amber-600 font-semibold' : 'text-muted-foreground'
              return (
                <Row key={p.id} icon="box" onSelect={() => { go(`/product/${p.id}`) }} focused={focusIdx === idx}>
                  <span className="flex items-center gap-2">
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{p.sku}</span>
                    <span className={cn('text-[10px] tabular-nums', stockClass)}>{totalStock}u</span>
                  </span>
                </Row>
              )
            })}
          </Group>
        )}

        {matchedSuppliers.length > 0 && (
          <Group heading={q ? `Suppliers matching "${query}"` : 'Suppliers'}>
            {matchedSuppliers.map((s) => {
              const idx = action(() => { go(`/supplier/${s.id}`) })
              return (
                <Row key={s.id} icon="truck" onSelect={() => { go(`/supplier/${s.id}`) }} focused={focusIdx === idx}>
                  <span className="flex items-center gap-2">
                    <span className="flex-1 truncate">{s.name}</span>
                    {s.contact_name && (
                      <span className="text-[10px] text-muted-foreground">{s.contact_name}</span>
                    )}
                    {s.lead_time_days != null && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {s.lead_time_days}d lead
                      </span>
                    )}
                  </span>
                </Row>
              )
            })}
          </Group>
        )}

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
            const idx1 = action(() => { setOpen(false); toggleCopilot() })
            const idx2 = action(() => { go('/flow?panel=receive') })
            const idx3 = action(() => { go('/flow?panel=approvals') })
            const idx4 = action(() => { go('/notifications') })
            const idx5 = action(() => { go('/eye?panel=waste') })
            return (
              <>
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

        {canAdmin && (
          <Group heading="Admin Actions">
            {(() => {
              const idx1 = action(() => { setOpen(false); autoAlerts.mutate({}) })
              const idx2 = action(() => { setOpen(false); runRestockCycle() })
              const idx3 = action(() => { go('/floor?panel=stocktake'); toast.info('Begin a new stocktake session') })
              return (
                <>
                  <Row icon="flash" onSelect={() => { setOpen(false); autoAlerts.mutate({}) }} focused={focusIdx === idx1}>
                    Scan Alerts
                  </Row>
                  <Row icon="predictive-analysis" onSelect={() => { setOpen(false); runRestockCycle() }} focused={focusIdx === idx2}>
                    Run Restock Cycle
                  </Row>
                  <Row icon="clipboard" onSelect={() => { go('/floor?panel=stocktake'); toast.info('Begin a new stocktake session') }} focused={focusIdx === idx3}>
                    Begin Stocktake
                  </Row>
                </>
              )
            })()}
          </Group>
        )}
      </div>
    </Dialog>
  )
}

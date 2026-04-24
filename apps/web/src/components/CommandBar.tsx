// Layer: meta — Global operator command bar
// Palantir-style Cmd+K command palette: keyboard-first, high-cadence.
// Cross-entity search: variants, products, suppliers — each routes to its object page.
// Nav items use the canonical workspace panel paths.

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Package, AlertTriangle, RefreshCw, ClipboardCheck, FileText, Settings,
  QrCode, Tag, Truck, BarChart2, Sparkles, Bell, Zap, Search,
  CalendarClock, PackageCheck, CalendarX, BellDot, BookOpen, ShoppingCart,
  Activity, Brain, Eye, ArrowLeftRight, ScanLine, GitBranch, Users,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useProducts } from '@/features/inventory/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useAutoAlerts } from '@/features/notifications/hooks'
import { useAutoPropose } from '@/features/restock/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'
import { hasPermission } from '@beacon/types'
import { stockUrgency } from '@beacon/reality-graph'

// ─── Layer-grouped nav items (canonical workspace panel paths) ────────────────

const NAV_ITEMS = [
  // Floor — physical reality & daily ops
  { group: 'Floor',  icon: BookOpen,      label: 'Briefing',             path: '/briefing',                    shortcut: 'G B' },
  { group: 'Floor',  icon: ScanLine,      label: 'Floor · Stock',        path: '/floor?panel=stock',           shortcut: 'G I' },
  { group: 'Floor',  icon: QrCode,        label: 'Floor · Scan',         path: '/scan',                        shortcut: 'G S' },
  { group: 'Floor',  icon: CalendarX,     label: 'Floor · Expiry',       path: '/floor?panel=expiry',          shortcut: null  },
  { group: 'Floor',  icon: AlertTriangle, label: 'Floor · Alerts',       path: '/floor?panel=alerts',          shortcut: null  },
  { group: 'Floor',  icon: ClipboardCheck, label: 'Floor · Stocktake',   path: '/floor?panel=stocktake',       shortcut: 'G T' },
  { group: 'Floor',  icon: Tag,           label: 'Floor · Labels',       path: '/labels',                      shortcut: null  },
  // Flow — operational movement & audit
  { group: 'Flow',   icon: ArrowLeftRight, label: 'Flow · Overview',     path: '/flow',                        shortcut: 'G F' },
  { group: 'Flow',   icon: PackageCheck,  label: 'Flow · Receive',       path: '/flow?panel=receive',          shortcut: null  },
  { group: 'Flow',   icon: Truck,         label: 'Flow · Approvals',     path: '/flow?panel=approvals',        shortcut: 'G R' },
  { group: 'Flow',   icon: FileText,      label: 'Flow · Audit Log',     path: '/audit',                       shortcut: null  },
  // Eye — intelligence & signals
  { group: 'Eye',    icon: Eye,           label: 'Eye · Signals',        path: '/eye?panel=signals',           shortcut: null  },
  { group: 'Eye',    icon: Eye,           label: 'Eye · Incidents',      path: '/eye?panel=incidents',         shortcut: null  },
  { group: 'Eye',    icon: Eye,           label: 'Eye · Waste Radar',    path: '/eye?panel=waste',             shortcut: null  },
  { group: 'Eye',    icon: Eye,           label: 'Eye · Restock Queue',  path: '/eye?panel=restock',           shortcut: null  },
  { group: 'Eye',    icon: Eye,           label: 'Eye · Risk Matrix',    path: '/eye?panel=risk',              shortcut: null  },
  { group: 'Eye',    icon: Eye,           label: 'Eye · Performance',    path: '/eye?panel=performance',       shortcut: null  },
  { group: 'Eye',    icon: Eye,           label: 'Eye · Occupancy',      path: '/eye?panel=occupancy',         shortcut: null  },
  { group: 'Eye',    icon: BellDot,       label: 'Notifications',        path: '/notifications',               shortcut: null  },
  { group: 'Eye',    icon: CalendarClock, label: 'Reminders',            path: '/reminders',                   shortcut: null  },
  { group: 'Eye',    icon: Activity,      label: 'Live Monitor',         path: '/monitor',                     shortcut: null  },
  { group: 'Eye',    icon: GitBranch,     label: 'Reality Graph',        path: '/graph',                       shortcut: null  },
  // Mind — strategy & procurement
  { group: 'Mind',   icon: Brain,         label: 'Mind · Triage',        path: '/mind?panel=triage',           shortcut: null  },
  { group: 'Mind',   icon: Truck,         label: 'Mind · Suppliers',     path: '/mind?panel=suppliers',        shortcut: null  },
  { group: 'Mind',   icon: ShoppingCart,  label: 'Mind · PO Builder',    path: '/mind?panel=procurement',      shortcut: null  },
  { group: 'Mind',   icon: ShoppingCart,  label: 'Mind · PO Dispatch',   path: '/mind?panel=dispatch',         shortcut: null  },
  { group: 'Mind',   icon: FileText,      label: 'Mind · Contracts',     path: '/mind?panel=contracts',        shortcut: null  },
  { group: 'Mind',   icon: Brain,         label: 'Mind · Finance',       path: '/mind?panel=finance',          shortcut: null  },
  { group: 'Mind',   icon: Brain,         label: 'Mind · GL Export',     path: '/mind?panel=gl',               shortcut: null  },
  { group: 'Mind',   icon: BarChart2,     label: 'Mind · Strategy',      path: '/mind?panel=strategy',         shortcut: null  },
  { group: 'Mind',   icon: CalendarClock, label: 'Event Planner',        path: '/events',                      shortcut: null  },
  { group: 'Mind',   icon: Users,         label: 'Team',                 path: '/settings?section=team',       shortcut: null  },
  { group: 'Mind',   icon: Settings,      label: 'Settings',             path: '/settings',                    shortcut: null  },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

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
  const autoAlerts  = useAutoAlerts()
  const autoPropose = useAutoPropose()

  const go = useCallback((path: string) => {
    setOpen(false)
    void navigate(path)
  }, [navigate])

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setQuery('')
  }

  // ── Cross-entity search ────────────────────────────────────────────────────

  const q = query.trim().toLowerCase()

  // Matched products → /product/:id
  const matchedProducts = useMemo(() => {
    if (!q) return products.slice(0, 5)
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.product_variants.some((v) => v.sku.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))
    ).slice(0, 8)
  }, [q, products])

  // Matched variants → /variant/:id (only when searching, to avoid noise)
  const matchedVariants = useMemo(() => {
    if (!q || q.length < 2) return []
    const hits: { id: string; name: string; productName: string; stock: number; urgency: ReturnType<typeof stockUrgency> }[] = []
    for (const p of products) {
      for (const v of p.product_variants) {
        if (
          v.name.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
        ) {
          hits.push({ id: v.id, name: v.name, productName: p.name, stock: v.current_stock, urgency: stockUrgency(v) })
          if (hits.length >= 6) break
        }
      }
      if (hits.length >= 6) break
    }
    return hits
  }, [q, products])

  // Matched suppliers → /supplier/:id
  const matchedSuppliers = useMemo(() => {
    if (!q) return suppliers.slice(0, 4)
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      (s.contact_name ?? '').toLowerCase().includes(q)
    ).slice(0, 6)
  }, [q, suppliers])

  // Group nav items by layer
  const navGroups = useMemo(() =>
    NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS[number][]>>((acc, item) => {
      const existing = acc[item.group]
      if (!existing) { acc[item.group] = [item]; return acc }
      existing.push(item)
      return acc
    }, {}),
  [])

  const hasEntityResults = matchedProducts.length > 0 || matchedVariants.length > 0 || matchedSuppliers.length > 0

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search pages, products, variants, suppliers…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results for "{query}"</p>
          </div>
        </CommandEmpty>

        {/* ── Entity search results — shown when query is active ── */}
        {hasEntityResults && (
          <>
            {/* Variants */}
            {matchedVariants.length > 0 && (
              <CommandGroup heading="Variants">
                {matchedVariants.map((v) => {
                  const urgencyColor =
                    v.urgency === 'critical' ? 'text-red-600 font-semibold' :
                    v.urgency === 'low'      ? 'text-amber-600 font-semibold' :
                    'text-muted-foreground'
                  return (
                    <CommandItem
                      key={v.id}
                      value={`variant ${v.name} ${v.productName}`}
                      onSelect={() => { go(`/variant/${v.id}`) }}
                      className="gap-2"
                    >
                      <Package className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-xs font-medium">{v.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{v.productName}</span>
                      </span>
                      <span className={`text-[10px] tabular-nums ${urgencyColor}`}>
                        {v.stock} units
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            {/* Products */}
            {matchedProducts.length > 0 && (
              <CommandGroup heading={q ? `Products matching "${query}"` : 'Products'}>
                {matchedProducts.map((p) => {
                  const totalStock = p.product_variants.reduce((s, v) => s + v.current_stock, 0)
                  const isOut = totalStock === 0
                  const isLow = !isOut && p.product_variants.some(
                    (v) => v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold
                  )
                  return (
                    <CommandItem
                      key={p.id}
                      value={`product ${p.name} ${p.sku}`}
                      onSelect={() => { go(`/product/${p.id}`) }}
                      className="gap-2"
                    >
                      <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{p.sku}</span>
                      <span className={
                        isOut ? 'text-[10px] font-semibold text-red-600 tabular-nums'
                        : isLow ? 'text-[10px] font-semibold text-amber-600 tabular-nums'
                        : 'text-[10px] text-muted-foreground tabular-nums'
                      }>
                        {totalStock}u
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            {/* Suppliers */}
            {matchedSuppliers.length > 0 && (
              <CommandGroup heading={q ? `Suppliers matching "${query}"` : 'Suppliers'}>
                {matchedSuppliers.map((s) => {
                  // riskLevelFromRow needs a reliability row — suppliers may not have one loaded here
                  // Show country + lead time as context instead
                  return (
                    <CommandItem
                      key={s.id}
                      value={`supplier ${s.name} ${s.contact_name ?? ''}`}
                      onSelect={() => { go(`/supplier/${s.id}`) }}
                      className="gap-2"
                    >
                      <Truck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 truncate">{s.name}</span>
                      {s.contact_name && (
                        <span className="text-[10px] text-muted-foreground">{s.contact_name}</span>
                      )}
                      {s.lead_time_days != null && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {s.lead_time_days}d lead
                        </span>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            <CommandSeparator />
          </>
        )}

        {/* ── Layer-grouped navigation ── */}
        {Object.entries(navGroups).map(([group, items], i) => (
          <div key={group}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={`${item.group}-${item.label}`}
                    value={`nav ${item.label} ${item.group}`}
                    onSelect={() => { go(item.path) }}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                    {'shortcut' in item && item.shortcut && (
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </div>
        ))}

        {/* ── Quick actions ── */}
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => { setOpen(false); toggleCopilot() }} className="gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Toggle Copilot
            <CommandShortcut>Ctrl+J</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { go('/flow?panel=receive') }} className="gap-2">
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
            Receive Stock
          </CommandItem>
          <CommandItem onSelect={() => { go('/flow?panel=approvals') }} className="gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            New Restock Request
          </CommandItem>
          <CommandItem onSelect={() => { go('/notifications') }} className="gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            View Notifications
          </CommandItem>
          <CommandItem onSelect={() => { go('/eye?panel=waste') }} className="gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Waste Radar
          </CommandItem>
        </CommandGroup>

        {/* ── Admin / autonomous actions ── */}
        {canAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Admin Actions">
              <CommandItem onSelect={() => { setOpen(false); autoAlerts.mutate({}) }} className="gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Scan Alerts
                <span className="ml-1 text-[10px] text-muted-foreground">auto_create_alerts</span>
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); autoPropose.mutate({}) }} className="gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Run Restock Proposals
                <span className="ml-1 text-[10px] text-muted-foreground">auto_propose_restocks</span>
              </CommandItem>
              <CommandItem onSelect={() => { go('/floor?panel=stocktake'); toast.info('Begin a new stocktake session') }} className="gap-2">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                Begin Stocktake
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

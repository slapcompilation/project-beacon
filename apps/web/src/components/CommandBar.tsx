// Layer: Floor — Global operator command bar
// Palantir-style Cmd+K command palette: keyboard-first, high-cadence.
// Navigate, search products, and trigger actions without lifting hands from keyboard.

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  LayoutDashboard, Package, AlertTriangle, RefreshCw, ClipboardCheck,
  FileText, Users, Settings, QrCode, Tag, Truck, BarChart2,
  Sparkles, Bell, SlidersHorizontal, Zap, Search, CalendarClock,
  PackageCheck, CalendarX, BellDot, BookOpen, ShoppingCart, Activity, Handshake,
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
import { useAutoAlerts } from '@/features/notifications/hooks'
import { useAutoPropose } from '@/features/restock/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@beacon/types'

// ─── Layer-grouped nav pages ──────────────────────────────────────────────────

const NAV_ITEMS = [
  // Floor — physical reality & daily operations
  { group: 'Floor', icon: LayoutDashboard,   label: 'Dashboard',         path: '/dashboard',               shortcut: 'G D' },
  { group: 'Floor', icon: SlidersHorizontal, label: 'Inventory',         path: '/inventory',               shortcut: 'G I' },
  { group: 'Floor', icon: QrCode,            label: 'Scan',              path: '/scan',                    shortcut: 'G S' },
  { group: 'Floor', icon: Tag,               label: 'Labels',            path: '/labels',                  shortcut: null  },
  // Flow — operational movement & audit
  { group: 'Flow',  icon: PackageCheck,      label: 'Receive Stock',     path: '/receive',                 shortcut: null  },
  { group: 'Flow',  icon: Truck,             label: 'Restocks',          path: '/restocks',                shortcut: 'G R' },
  { group: 'Flow',  icon: ClipboardCheck,    label: 'Stocktake',         path: '/stocktake',               shortcut: 'G T' },
  { group: 'Flow',  icon: PackageCheck,      label: 'Pick Lists',        path: '/pick-lists',              shortcut: null  },
  { group: 'Flow',  icon: FileText,          label: 'Audit Log',         path: '/audit',                   shortcut: null  },
  { group: 'Flow',  icon: Search,            label: 'Reality Graph',     path: '/graph',                   shortcut: null  },
  // Eye — intelligence & signals
  { group: 'Eye',   icon: BookOpen,          label: 'Shift Briefing',    path: '/briefing',                shortcut: null  },
  { group: 'Eye',   icon: AlertTriangle,     label: 'Alerts',            path: '/alerts',                  shortcut: 'G A' },
  { group: 'Eye',   icon: BellDot,           label: 'Notifications',     path: '/notifications',           shortcut: null  },
  { group: 'Eye',   icon: CalendarX,         label: 'Expiry Risk',       path: '/expiry',                  shortcut: null  },
  { group: 'Eye',   icon: CalendarClock,     label: 'Reminders',         path: '/reminders',               shortcut: null  },
  { group: 'Eye',   icon: BarChart2,         label: 'Reports',           path: '/reports',                 shortcut: null  },
  { group: 'Eye',   icon: BarChart2,         label: 'Forecast',          path: '/reports?tab=forecast',    shortcut: null  },
  { group: 'Eye',   icon: BarChart2,         label: 'Anomaly Detection', path: '/reports?tab=anomalies',   shortcut: null  },
  { group: 'Eye',   icon: BarChart2,         label: 'Waste Report',      path: '/reports?tab=waste',       shortcut: null  },
  // Mind — strategy & procurement
  { group: 'Eye',   icon: Activity,           label: 'Live Monitor',      path: '/monitor',                 shortcut: null  },
  { group: 'Mind',  icon: Handshake,          label: 'Leverage Engine',   path: '/leverage',                shortcut: null  },
  { group: 'Mind',  icon: BarChart2,          label: 'Chain Overview',    path: '/chain',                   shortcut: null  },
  { group: 'Mind',  icon: Truck,             label: 'Suppliers',         path: '/suppliers',               shortcut: null  },
  { group: 'Mind',  icon: ShoppingCart,      label: 'Purchase Orders',   path: '/purchase-orders',         shortcut: null  },
  { group: 'Mind',  icon: SlidersHorizontal, label: 'Par Optimizer',     path: '/optimize-pars',           shortcut: null  },
  { group: 'Mind',  icon: CalendarClock,     label: 'Event Planner',     path: '/events',                  shortcut: null  },
  { group: 'Mind',  icon: BarChart2,         label: 'Finance',           path: '/reports?tab=finance',     shortcut: null  },
  { group: 'Mind',  icon: BarChart2,         label: 'Procurement',       path: '/reports?tab=procurement', shortcut: null  },
  { group: 'Mind',  icon: Users,             label: 'Team',              path: '/team',                    shortcut: null  },
  { group: 'Mind',  icon: Settings,          label: 'Settings',          path: '/settings',                shortcut: null  },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.role)
  const canAdmin = !!role && hasPermission(role, 'can_approve_restocks')

  const { data: products = [] } = useProducts()
  const autoAlerts  = useAutoAlerts()
  const autoPropose = useAutoPropose()

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => { document.removeEventListener('keydown', handler) }
  }, [])

  const go = useCallback((path: string) => {
    setOpen(false)
    void navigate(path)
  }, [navigate])

  const runScanAlerts = useCallback(() => {
    setOpen(false)
    autoAlerts.mutate({})
  }, [autoAlerts])

  const runProposals = useCallback(() => {
    setOpen(false)
    autoPropose.mutate({})
  }, [autoPropose])

  // Reset query when closed
  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setQuery('')
  }

  // Filtered products — search by name, SKU, or variant name
  const matchedProducts = query.trim().length > 0
    ? products.filter((p) => {
        const q = query.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.product_variants.some(
            (v) => v.sku.toLowerCase().includes(q) || v.name.toLowerCase().includes(q),
          )
        )
      }).slice(0, 10)
    : products.slice(0, 6)

  // Group nav items by their layer
  const navGroups = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS[number][]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search pages, products, actions…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results found.</p>
          </div>
        </CommandEmpty>

        {/* Layer-grouped navigation */}
        {Object.entries(navGroups).map(([group, items], i) => (
          <div key={group}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.path}
                    onSelect={() => { go(item.path) }}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </div>
        ))}

        <CommandSeparator />

        {/* Product search */}
        {matchedProducts.length > 0 && (
          <CommandGroup heading={query.trim() ? `Products matching "${query}"` : 'Products'}>
            {matchedProducts.map((p) => {
              const totalStock = p.product_variants.reduce((s, v) => s + v.current_stock, 0)
              const isLow = p.product_variants.some(
                (v) => v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold,
              )
              const isOut = totalStock === 0
              return (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.sku} ${p.product_variants.map((v) => v.sku).join(' ')}`}
                  onSelect={() => { go(`/inventory?search=${encodeURIComponent(p.name)}`) }}
                  className="gap-2"
                >
                  <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{p.sku}</span>
                  <span className={
                    isOut ? 'text-[10px] font-semibold text-red-600 tabular-nums'
                    : isLow ? 'text-[10px] font-semibold text-yellow-600 tabular-nums'
                    : 'text-[10px] text-muted-foreground tabular-nums'
                  }>
                    {totalStock} units
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Actions — always visible */}
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => { go('/receive') }} className="gap-2">
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
            Receive Stock
          </CommandItem>
          <CommandItem onSelect={() => { go('/restocks') }} className="gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            New Restock Request
          </CommandItem>
          <CommandItem onSelect={() => { go('/notifications') }} className="gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            View Notifications
          </CommandItem>
          <CommandItem onSelect={() => { go('/reports?tab=waste') }} className="gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            View Waste Report
          </CommandItem>
        </CommandGroup>

        {/* Autonomous actions — owner/admin only */}
        {canAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Admin Actions">
              <CommandItem onSelect={runScanAlerts} className="gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Scan Alerts
                <span className="ml-1 text-[10px] text-muted-foreground">auto_create_alerts</span>
              </CommandItem>
              <CommandItem onSelect={runProposals} className="gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Run Restock Proposals
                <span className="ml-1 text-[10px] text-muted-foreground">auto_propose_restocks</span>
              </CommandItem>
              <CommandItem onSelect={() => { go('/stocktake'); toast.info('Begin a new stocktake session') }} className="gap-2">
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

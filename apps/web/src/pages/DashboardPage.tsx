// Layer: Eye + Mind — Situational Operations Center
// Palantir-style mission dashboard: cross-domain synthesis, operator-grade
// density, decision support not data display.
// Every item surfaces what the operator should do next, not just what is.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, differenceInDays } from 'date-fns'
import {
  Button,
  Card,
  Icon,
  Intent,
  NonIdealState,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useDateFormat } from '@/features/user/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { WhyButton } from '@/components/WhySheet'
import { cn } from '@/lib/utils'
import { useProducts, useExpiringVariants, useAdjustStock } from '@/features/inventory/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useActiveHotel, useHotels } from '@/features/hotel/hooks'
import { useAuthStore } from '@/stores/auth.store'
import {
  useRestockRequests,
  useCreateRestockRequest,
  useUpdateRestockStatus,
} from '@/features/restock/hooks'
import { useNotifications, useMarkNotificationRead } from '@/features/notifications/hooks'
import { useConsumptionForecast, useWasteRadar, WasteRadar, IntelligencePanel, computePredictiveRestocks } from '@/features/eye'
import { ChainBenchmark, useWasteCost } from '@/features/mind'
import { formatCurrency } from '@/lib/currency'
import { getTotalStock, hasPermission } from '@beacon/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info'
type ActionVariant = 'default' | 'outline' | 'destructive'

interface ActionItem {
  id: string
  severity: Severity
  icon: IconName
  title: string
  subtitle: string
  /** Cross-domain synthesis note — e.g. "8 wasted this week · restock pending" */
  context?: string
  /** Variant ID — enables the "Why?" causal graph button */
  variantId?: string
  variantName?: string
  currentStock?: number
  actions: { label: string; variant?: ActionVariant; onClick: () => void }[]
}

// ─── Status strip ─────────────────────────────────────────────────────────────

const SEV_META = {
  critical: { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',    label: 'CRITICAL' },
  warning:  { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400', label: 'WARNING'  },
  info:     { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',   label: 'INFO'     },
} as const

function StatusStrip({
  hotelName,
  critical,
  warning,
  info,
  inventoryValue,
  productCount,
  currency,
}: {
  hotelName: string
  critical: number
  warning: number
  info: number
  inventoryValue: number
  productCount: number
  currency: string
}) {
  const allClear = critical === 0 && warning === 0

  return (
    <div className="flex items-center gap-3 flex-wrap border-b px-5 py-2.5 text-xs font-medium bg-surface-1">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="text-muted-foreground uppercase tracking-wider">Live</span>
      </div>

      <span className="text-muted-foreground">·</span>
      <span className="font-semibold text-foreground">{hotelName}</span>

      {allClear ? (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-green-600 font-semibold">ALL CLEAR</span>
        </>
      ) : (
        <>
          {critical > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className={cn('rounded px-1.5 py-0.5 tabular-nums', SEV_META.critical.badge)}>
                {critical} CRITICAL
              </span>
            </>
          )}
          {warning > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className={cn('rounded px-1.5 py-0.5 tabular-nums', SEV_META.warning.badge)}>
                {warning} WARNING
              </span>
            </>
          )}
          {info > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className={cn('rounded px-1.5 py-0.5 tabular-nums', SEV_META.info.badge)}>
                {info} INFO
              </span>
            </>
          )}
        </>
      )}

      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        {formatCurrency(inventoryValue, currency)} inventory
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{productCount} products</span>
    </div>
  )
}

// ─── Action card ──────────────────────────────────────────────────────────────

function ActionCard({ item }: { item: ActionItem }) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-lg border px-4 py-3',
      item.severity === 'critical' && 'border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20',
      item.severity === 'warning'  && 'border-yellow-200 bg-yellow-50/60 dark:border-yellow-800 dark:bg-yellow-950/20',
      item.severity === 'info'     && 'border-border bg-muted/30',
    )}>
      <div className={cn(
        'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
        item.severity === 'critical' && 'bg-red-100 text-red-600 dark:bg-red-900/40',
        item.severity === 'warning'  && 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40',
        item.severity === 'info'     && 'bg-blue-100 text-blue-600 dark:bg-blue-900/40',
      )}>
        <Icon icon={item.icon} size={12} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
        {item.context && (
          <p className="mt-0.5 text-xs font-medium text-foreground/70 italic">{item.context}</p>
        )}
        {item.variantId && (
          <div className="mt-1">
            <WhyButton
              variantId={item.variantId}
              variantName={item.variantName ?? item.title}
              currentStock={item.currentStock}
            />
          </div>
        )}
      </div>

      {item.actions.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-1.5 flex-wrap justify-end">
          {item.actions.map((a) => {
            const intent: Intent =
              a.variant === 'destructive' ? Intent.DANGER :
              a.variant === 'outline'     ? Intent.NONE   :
              Intent.PRIMARY
            const variant = a.variant === 'outline' ? 'outlined' as const : undefined
            return (
              <Button
                key={a.label}
                size="small"
                variant={variant}
                intent={intent}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Action queue section ─────────────────────────────────────────────────────

function ActionQueueSection({ severity, items }: { severity: Severity; items: ActionItem[] }) {
  if (items.length === 0) return null
  const dot = SEV_META[severity].dot
  const label = SEV_META[severity].label
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', dot)} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label} · {items.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => <ActionCard key={item.id} item={item} />)}
      </div>
    </div>
  )
}

// ─── Signal intelligence panel ────────────────────────────────────────────────

function MicroKpi({
  label,
  value,
  sub,
  trend,
}: {
  label: string
  value: string
  sub?: string
  trend?: 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'neutral'
}) {
  const trendEl = trend && trend !== 'neutral' ? (() => {
    const isUp   = trend.startsWith('up')
    const isGood = trend.endsWith('good')
    const color  = isGood ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
    return <Icon icon={isUp ? 'trending-up' : 'trending-down'} size={12} className={color} />
  })() : null

  return (
    <Card className="!px-3 !py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <p className="text-lg font-bold tabular-nums">{value}</p>
        {trendEl}
      </div>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.role)
  const canApprove = !!role && hasPermission(role, 'can_approve_restocks')
  const fmtDate = useDateFormat()

  const { data: products = [] }         = useProducts()
  const { data: expiring = [] }         = useExpiringVariants(90)
  const { data: forecast = [] }         = useConsumptionForecast(30)
  const { data: notifications = [] }    = useNotifications()
  const { data: restockRequests = [] }  = useRestockRequests()
  const { data: wasteRadarRows = [] }   = useWasteRadar()
  const { data: wasteCostRows = [] }    = useWasteCost(30)
  const { data: hotels = [] }           = useHotels()
  const activeHotel                     = useActiveHotel()
  const { data: suppliers = [] }        = useSuppliers()

  const currency    = useCurrency()
  const isMultiHotel = hotels.length > 1

  const adjustStock         = useAdjustStock()
  const createRestock       = useCreateRestockRequest()
  const updateRestockStatus = useUpdateRestockStatus()
  const markRead            = useMarkNotificationRead()

  // ── Derived indices for cross-domain synthesis ────────────────────────────
  const wasteRadarMap = useMemo(() =>
    new Map(wasteRadarRows.map((r) => [r.variant_id, r])),
    [wasteRadarRows]
  )

  const openRestockVariantIds = useMemo(() =>
    new Set(
      restockRequests
        .filter((r) => r.status === 'pending' || r.status === 'approved')
        .map((r) => r.variant_id)
    ),
    [restockRequests]
  )

  const suppliersMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  )

  const predictiveRestocks = useMemo(
    () => computePredictiveRestocks(forecast, products, suppliersMap, openRestockVariantIds),
    [forecast, products, suppliersMap, openRestockVariantIds]
  )

  // ── Inventory-level stats (for status strip + signal panel) ───────────────
  const inventoryValue = useMemo(() =>
    products.reduce((sum, p) => sum + p.product_variants.reduce((s, v) => s + v.current_stock * v.cost, 0), 0),
    [products]
  )

  const totalStock = useMemo(() =>
    products.reduce((sum, p) => sum + getTotalStock(p.product_variants), 0),
    [products]
  )

  const wasteCostTotal = useMemo(() =>
    wasteCostRows.reduce((sum: number, r) => sum + r.total_cost, 0),
    [wasteCostRows]
  )

  const avgDaysSupply = useMemo(() => {
    const valid = forecast.filter((r) => r.days_until_zero !== null)
    if (valid.length === 0) return null
    const mean = valid.reduce((sum, r) => sum + (r.days_until_zero ?? 0), 0) / valid.length
    return Math.round(mean)
  }, [forecast])

  // ── Cross-domain context helper ───────────────────────────────────────────
  const ctxFor = useMemo(() => (variantId: string): string | undefined => {
    const waste = wasteRadarMap.get(variantId)
    const hasPendingRestock = openRestockVariantIds.has(variantId)
    const parts: string[] = []
    if (waste && waste.qty_7d > 0) {
      parts.push(`${String(waste.qty_7d)} written off this week (${(waste.qty_7d / 7).toFixed(1)}/day · ${String(waste.pct_above_baseline)}% above baseline)`)
    }
    if (hasPendingRestock) parts.push('restock pending')
    return parts.length > 0 ? parts.join(' · ') : undefined
  }, [wasteRadarMap, openRestockVariantIds])

  // ── Action item synthesis (cross-domain, deduplicated by variant) ─────────
  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = []
    const seen = new Set<string>()

    // 1 ── Out of stock (critical)
    for (const product of products) {
      for (const variant of product.product_variants) {
        if (variant.current_stock !== 0) continue
        seen.add(variant.id)
        const label = variant.name !== 'Standard' ? `${product.name} — ${variant.name}` : product.name
        items.push({
          id: `out-${variant.id}`,
          severity: 'critical',
          icon: 'box',
          title: `Out of stock · ${label}`,
          subtitle: `SKU ${variant.sku} · par level ${String(variant.low_stock_threshold)}`,
          context: ctxFor(variant.id),
          variantId: variant.id,
          variantName: label,
          currentStock: variant.current_stock,
          actions: openRestockVariantIds.has(variant.id) ? [] : [
            { label: 'Request Restock', onClick: () => { createRestock.mutate({ variantId: variant.id, quantityNeeded: Math.max(variant.low_stock_threshold * 2, 1) }) } },
          ],
        })
      }
    }

    // 2 ── Forecast: critical ≤ 3d (not already shown)
    for (const row of forecast) {
      if (seen.has(row.variant_id)) continue
      if (row.days_until_zero === null || row.days_until_zero > 3) continue
      seen.add(row.variant_id)
      const label = row.variant_name !== 'Standard' ? `${row.product_name} — ${row.variant_name}` : row.product_name
      items.push({
        id: `fcast-crit-${row.variant_id}`,
        severity: 'critical',
        icon: 'time',
        title: `${label} — ~${String(Math.round(row.days_until_zero))}d supply left`,
        subtitle: `${String(row.current_stock)} units · ${row.avg_daily.toFixed(1)}/day avg · based on 30-day window`,
        context: ctxFor(row.variant_id),
        variantId: row.variant_id,
        variantName: label,
        currentStock: row.current_stock,
        actions: row.has_open_request ? [] : [
          { label: 'Request Restock', onClick: () => { createRestock.mutate({ variantId: row.variant_id, quantityNeeded: row.recommended_order_qty }) } },
        ],
      })
    }

    // 3 ── Expiry: critical ≤ 7d
    for (const v of expiring) {
      if (!v.expiry_date) continue
      const days = differenceInDays(new Date(v.expiry_date), new Date())
      if (days > 7) continue
      const label = v.name !== 'Standard' ? `${v.products?.name ?? 'Unknown'} — ${v.name}` : (v.products?.name ?? 'Unknown')
      items.push({
        id: `expiry-crit-${v.id}`,
        severity: 'critical',
        icon: 'calendar',
        title: `${label} — expires ${days <= 0 ? 'today' : `in ${String(days)}d`}`,
        subtitle: `${v.current_stock} units · ${formatCurrency(v.current_stock * v.cost, currency)} at risk`,
        actions: [
          {
            label: 'Write Off',
            variant: 'destructive',
            onClick: () => { adjustStock.mutate({ variantId: v.id, delta: -v.current_stock, reason: 'Expired — written off', removalCategory: 'Spoilage' }) },
          },
        ],
      })
    }

    // 4 ── Forecast: warning 4-14d
    for (const row of forecast) {
      if (seen.has(row.variant_id)) continue
      if (row.days_until_zero === null || row.days_until_zero <= 3 || row.days_until_zero > 14) continue
      seen.add(row.variant_id)
      const label = row.variant_name !== 'Standard' ? `${row.product_name} — ${row.variant_name}` : row.product_name
      items.push({
        id: `fcast-warn-${row.variant_id}`,
        severity: 'warning',
        icon: 'time',
        title: `${label} — ~${String(Math.round(row.days_until_zero))}d supply left`,
        subtitle: `${String(row.current_stock)} units · ${row.avg_daily.toFixed(1)}/day avg · based on 30-day window`,
        context: ctxFor(row.variant_id),
        actions: row.has_open_request ? [] : [
          { label: 'Request Restock', variant: 'outline', onClick: () => { createRestock.mutate({ variantId: row.variant_id, quantityNeeded: row.recommended_order_qty }) } },
        ],
      })
    }

    // 4.5 ── Predictive: lead-time-aware order deadline
    // Surfaces the novel band: days_until_zero > 14 but orderDeadlineDays ≤ 7.
    // Items already in `seen` (out-of-stock / critical / warning forecast) are skipped.
    for (const row of predictiveRestocks) {
      if (seen.has(row.variantId)) continue
      seen.add(row.variantId)
      const label = row.variantName !== 'Standard' ? `${row.productName} — ${row.variantName}` : row.productName
      items.push({
        id: `predict-${row.variantId}`,
        severity: row.urgency === 'critical' ? 'critical' : row.urgency === 'warning' ? 'warning' : 'info',
        icon: 'calendar',
        title: row.urgency === 'critical'
          ? `${label} — order now · stockout ${format(row.stockoutDate, 'MMM d')}`
          : `${label} — order by ${format(row.orderDeadlineDate, 'MMM d')}`,
        subtitle: `${String(row.daysUntilZero)}d supply left · lead ${String(row.leadTimeDays)}d · ${row.avgDaily.toFixed(1)}/day avg · based on 30-day window`,
        context: ctxFor(row.variantId),
        variantId: row.variantId,
        variantName: label,
        currentStock: row.currentStock,
        actions: row.hasOpenRequest ? [] : [
          {
            label: 'Request Restock',
            variant: row.urgency === 'critical' ? 'default' : 'outline',
            onClick: () => { createRestock.mutate({ variantId: row.variantId, quantityNeeded: row.recommendedQty }) },
          },
        ],
      })
    }

    // 5 ── Low stock (warning) — only if not in forecast
    for (const product of products) {
      for (const variant of product.product_variants) {
        if (seen.has(variant.id)) continue
        if (variant.low_stock_threshold <= 0) continue
        if (variant.current_stock <= 0 || variant.current_stock > variant.low_stock_threshold) continue
        seen.add(variant.id)
        const label = variant.name !== 'Standard' ? `${product.name} — ${variant.name}` : product.name
        items.push({
          id: `low-${variant.id}`,
          severity: 'warning',
          icon: 'warning-sign',
          title: `${label} — low stock`,
          subtitle: `${String(variant.current_stock)} units · par level ${String(variant.low_stock_threshold)}`,
          context: ctxFor(variant.id),
          actions: openRestockVariantIds.has(variant.id) ? [] : [
            { label: 'Request Restock', variant: 'outline', onClick: () => { createRestock.mutate({ variantId: variant.id, quantityNeeded: variant.low_stock_threshold * 2 - variant.current_stock }) } },
          ],
        })
      }
    }

    // 6 ── Expiry: warning 8-30d
    for (const v of expiring) {
      if (!v.expiry_date) continue
      const days = differenceInDays(new Date(v.expiry_date), new Date())
      if (days <= 7 || days > 30) continue
      const label = v.name !== 'Standard' ? `${v.products?.name ?? 'Unknown'} — ${v.name}` : (v.products?.name ?? 'Unknown')
      items.push({
        id: `expiry-warn-${v.id}`,
        severity: 'warning',
        icon: 'calendar',
        title: `${label} — expires in ${String(days)}d`,
        subtitle: `${v.current_stock} units · ${formatCurrency(v.current_stock * v.cost, currency)} at risk`,
        actions: [],
      })
    }

    // 7 ── Waste alerts (warning) — enriched with cost from waste radar
    for (const n of notifications) {
      if (n.read || n.type !== 'waste_alert') continue
      // Match waste radar row by product name appearing in the notification message
      const matchedWaste = wasteRadarRows.find((r) => n.message.includes(r.variant_label))
      const costNote = matchedWaste?.waste_cost_7d
        ? `· ${formatCurrency(matchedWaste.waste_cost_7d, currency)} cost impact`
        : ''
      items.push({
        id: `notif-waste-${n.id}`,
        severity: 'warning',
        icon: 'flame',
        title: n.message,
        subtitle: `${fmtDate(new Date(n.timestamp))}, ${format(new Date(n.timestamp), 'HH:mm')} ${costNote}`,
        context: matchedWaste ? ctxFor(matchedWaste.variant_id) : undefined,
        actions: [{ label: 'Dismiss', variant: 'outline', onClick: () => { markRead.mutate({ id: n.id }) } }],
      })
    }

    // 8 ── Pending restock approvals (info)
    if (canApprove) {
      for (const r of restockRequests) {
        if (r.status !== 'pending' || r.is_auto_proposed) continue
        const productName = r.product_variants?.products?.name ?? 'Unknown'
        const variantName = r.product_variants?.name
        const label = variantName && variantName !== 'Standard' ? `${productName} — ${variantName}` : productName
        items.push({
          id: `approval-${r.id}`,
          severity: 'info',
          icon: 'tick-circle',
          title: `Restock approval needed · ${label}`,
          subtitle: `${String(r.quantity_needed)} units requested${r.supplier ? ` · ${r.supplier}` : ''}`,
          actions: [
            { label: 'Approve', onClick: () => { updateRestockStatus.mutate({ id: r.id, status: 'approved' }) } },
            { label: 'Decline', variant: 'outline', onClick: () => { updateRestockStatus.mutate({ id: r.id, status: 'cancelled' }) } },
          ],
        })
      }
    }

    // 9 ── Other unread notifications (info)
    for (const n of notifications) {
      if (n.read || n.type === 'waste_alert' || n.type === 'predicted_outage') continue
      items.push({
        id: `notif-${n.id}`,
        severity: 'info',
        icon: 'notifications',
        title: n.message,
        subtitle: `${fmtDate(new Date(n.timestamp))}, ${format(new Date(n.timestamp), 'HH:mm')}`,
        actions: [{ label: 'Dismiss', variant: 'outline', onClick: () => { markRead.mutate({ id: n.id }) } }],
      })
    }

    // 10 ── Predicted outage notifications not already covered by live forecast
    // (live forecast items #2/#4 cover ≤14d; these catch longer-horizon detections)
    for (const n of notifications) {
      if (n.read || n.type !== 'predicted_outage') continue
      // Skip if already represented by a live forecast action item
      const alreadyCovered = items.some((i) =>
        (i.id.startsWith('fcast-') || i.id.startsWith('out-')) &&
        n.message.split('—')[0] && i.title.includes(n.message.split('—')[0]?.trim() ?? '')
      )
      if (alreadyCovered) continue
      items.push({
        id: `notif-outage-${n.id}`,
        severity: 'info',
        icon: 'time',
        title: n.message,
        subtitle: `Detected ${fmtDate(new Date(n.timestamp))}, ${format(new Date(n.timestamp), 'HH:mm')} · based on 30-day avg consumption`,
        actions: [{ label: 'Dismiss', variant: 'outline', onClick: () => { markRead.mutate({ id: n.id }) } }],
      })
    }

    return items
  }, [
    products, forecast, expiring, notifications, restockRequests, predictiveRestocks,
    ctxFor, openRestockVariantIds, canApprove, currency, fmtDate, wasteRadarRows,
    adjustStock, createRestock, updateRestockStatus, markRead,
  ])

  // ── Role detection ────────────────────────────────────────────────────────
  const isStaff = role === 'team_member' || role === 'limited_access'
  const isOwner = role === 'owner'

  // Staff: filter action queue to floor-relevant items only (stock/expiry — no admin approvals)
  const displayedItems = useMemo(() => isStaff
    ? actionItems.filter((i) =>
        i.id.startsWith('out-') ||
        i.id.startsWith('low-') ||
        i.id.startsWith('expiry-')
      )
    : actionItems,
  [isStaff, actionItems])

  const critical = displayedItems.filter((i) => i.severity === 'critical')
  const warning  = displayedItems.filter((i) => i.severity === 'warning')
  const info     = displayedItems.filter((i) => i.severity === 'info')

  // Mission-framing per role
  const mission = isStaff
    ? { title: 'Floor · Your Shift', sub: 'Stock status for your current shift — ranked by urgency' }
    : isOwner
      ? { title: 'Mind · Operations', sub: 'Cross-property health and financial exposure' }
      : { title: 'Eye · Action Queue', sub: displayedItems.length === 0 ? 'All clear — no actions required' : `${String(displayedItems.length)} item${displayedItems.length !== 1 ? 's' : ''} ranked by urgency and business impact` }

  return (
    <div className="flex flex-col h-full">
      {/* Status strip */}
      <StatusStrip
        hotelName={activeHotel?.name ?? '—'}
        critical={critical.length}
        warning={warning.length}
        info={info.length}
        inventoryValue={inventoryValue}
        productCount={products.length}
        currency={currency}
      />

      {/* Main body — staff: full-width queue; manager/owner: two-column */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Mission Action Queue ───────────────────────────── */}
        <div className={cn('overflow-y-auto px-5 py-4 space-y-4', isStaff ? 'flex-1' : 'flex-1 border-r')}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold tracking-tight">{mission.title}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{mission.sub}</p>
            </div>
            {!isStaff && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="small"
                  variant="outlined"
                  endIcon="arrow-right"
                  onClick={() => { void navigate('/alerts') }}
                >
                  All Alerts
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  intent={Intent.SUCCESS}
                  icon="tick-circle"
                  onClick={() => { void navigate('/receive') }}
                >
                  Receive Stock
                </Button>
                <Button
                  size="small"
                  intent={Intent.PRIMARY}
                  icon="predictive-analysis"
                  onClick={() => { void navigate('/restocks') }}
                >
                  Restocks
                </Button>
              </div>
            )}
            {isStaff && displayedItems.length > 0 && (
              <Button
                size="small"
                variant="outlined"
                intent={Intent.SUCCESS}
                icon="tick-circle"
                onClick={() => { void navigate('/receive') }}
              >
                Receive Stock
              </Button>
            )}
          </div>

          {displayedItems.length === 0 ? (
            <NonIdealState
              icon="tick-circle"
              title="All clear"
              description={
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground max-w-sm">
                  <span><span className="font-semibold text-foreground tabular-nums">{products.reduce((s, p) => s + p.product_variants.length, 0)}</span> variants checked</span>
                  <span><span className="font-semibold text-foreground tabular-nums">{expiring.length}</span> expiry dates scanned</span>
                  {!isStaff && <span><span className="font-semibold text-foreground tabular-nums">{notifications.filter((n) => !n.read).length}</span> unread alerts</span>}
                  {avgDaysSupply !== null && (
                    <span><span className="font-semibold text-foreground tabular-nums">{String(avgDaysSupply)}d</span> avg supply</span>
                  )}
                </div>
              }
            />
          ) : (
            <div className="space-y-6">
              <ActionQueueSection severity="critical" items={critical} />
              <ActionQueueSection severity="warning" items={warning} />
              <ActionQueueSection severity="info" items={info} />
            </div>
          )}
        </div>

        {/* ── Right: Intelligence panel — hidden for floor staff ───── */}
        {!isStaff && (
          <div className="w-72 xl:w-80 flex-shrink-0 overflow-y-auto px-5 py-4 space-y-5">

            {/* Manager: Eye intelligence — depletion forecasts + waste signals */}
            {!isOwner && (
              <>
                {/* 2 KPIs that aren't already in the status strip */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    Status
                  </p>
                  <div className="space-y-2">
                    <MicroKpi
                      label="Avg Days Supply"
                      value={avgDaysSupply !== null ? `${String(avgDaysSupply)}d` : '—'}
                      sub="mean across active variants · 30-day window"
                      trend={
                        avgDaysSupply === null ? 'neutral' :
                        avgDaysSupply <= 7  ? 'down-bad' :
                        avgDaysSupply <= 14 ? 'neutral'  : 'up-good'
                      }
                    />
                    <MicroKpi
                      label="Waste Cost · 30d"
                      value={formatCurrency(wasteCostTotal, currency)}
                      sub={wasteCostTotal > 0 ? 'value lost to removals' : 'no waste recorded'}
                      trend={wasteCostTotal > 0 ? 'up-bad' : 'neutral'}
                    />
                  </div>
                </div>

                {/* Eye: Active Intelligence */}
                <IntelligencePanel
                  currency={currency}
                  onRestock={(variantId, qty) => {
                    createRestock.mutate({ variantId, quantityNeeded: qty })
                  }}
                />

                {/* Eye: Waste Radar */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />
                    Eye · Waste Radar
                  </p>
                  <WasteRadar />
                </div>
              </>
            )}

            {/* Owner: Mind-level intelligence — chain + financial exposure */}
            {isOwner && (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    Status
                  </p>
                  <div className="space-y-2">
                    <MicroKpi
                      label="Inventory Value"
                      value={formatCurrency(inventoryValue, currency)}
                      sub={`${String(totalStock)} total units · ${String(products.length)} products`}
                      trend={critical.length > 0 ? 'down-bad' : warning.length > 0 ? 'neutral' : 'up-good'}
                    />
                    <MicroKpi
                      label="Waste Cost · 30d"
                      value={formatCurrency(wasteCostTotal, currency)}
                      sub={wasteCostTotal > 0 ? 'financial exposure from removals' : 'no waste recorded'}
                      trend={wasteCostTotal > 0 ? 'up-bad' : 'neutral'}
                    />
                    <MicroKpi
                      label="Avg Days Supply"
                      value={avgDaysSupply !== null ? `${String(avgDaysSupply)}d` : '—'}
                      sub="operational coverage · 30-day window"
                      trend={avgDaysSupply === null ? 'neutral' : avgDaysSupply <= 7 ? 'down-bad' : avgDaysSupply <= 14 ? 'neutral' : 'up-good'}
                    />
                  </div>
                </div>

                {isMultiHotel && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500 inline-block" />
                      Mind · Chain Benchmark
                    </p>
                    <ChainBenchmark />
                  </div>
                )}

                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />
                    Eye · Waste Radar
                  </p>
                  <WasteRadar />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

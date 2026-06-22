// Layer: Eye — intelligence surface for waste, expiry, low-stock, and notification signals
// Layer-grouped sections (Eye · Expiry / Eye · Stock / Eye · Anomalies / Floor · Notifications),
// bulk restock action, and a scope-aware empty state.
// Palantir principle: cross-domain synthesis + decision support, not data display.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Button,
  Callout,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { CausalTracePanel } from '@/components/CausalTracePanel'
import { cn } from '@/lib/utils'
import { useProducts, useExpiringVariants, useAdjustStock } from '@/features/inventory/hooks'
import {
  useNotifications, useMarkNotificationRead,
  useMarkAllNotificationsRead, useAutoAlerts,
  useAlertPreferences, useUpdateAlertPreferences,
} from '@/features/notifications/hooks'
import { useConsumptionForecast, useWasteRadar } from '@/features/eye/hooks'
import { useMonitorPolicy } from '@/features/monitors/hooks'
import { DEFAULT_ORG_POLICY } from '@beacon/reality-graph'
import { useCreateRestockRequest } from '@/features/restock/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { formatCurrency } from '@/lib/currency'
import { daysUntil } from '@/lib/date'
import { useCurrency } from '@/hooks/useCurrency'
import { useDateFormat } from '@/features/user/hooks'

// ─── Types ────────────────────────────────────────────────────────────────────

type Band = 'critical' | 'warning' | 'info'
type FilterBand = 'all' | Band
type AlertLayer = 'Eye · Expiry Risk' | 'Eye · Stock Forecast' | 'Eye · Anomalies' | 'Floor · Notifications'

interface AlertItem {
  id: string
  band: Band
  layer: AlertLayer
  icon: IconName
  title: string
  subtitle: string
  costExposure?: number
  actions: { label: string; onClick: () => void; intent?: Intent }[]
  _variantId?: string
  _restockQty?: number
  _neverStocked?: boolean
  _notifId?: string
}

const BAND_META: Record<Band, {
  label: string; bg: string; border: string; iconColor: string; intent: Intent
}> = {
  critical: {
    label: 'Critical',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-600',
    intent: Intent.DANGER,
  },
  warning: {
    label: 'Warning',
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-600',
    intent: Intent.WARNING,
  },
  info: {
    label: 'Info',
    bg: 'bg-muted/40',
    border: 'border-border',
    iconColor: 'text-muted-foreground',
    intent: Intent.NONE,
  },
}

const LAYER_META: Record<AlertLayer, { icon: IconName; color: string }> = {
  'Eye · Expiry Risk':      { icon: 'calendar',       color: 'text-orange-600 dark:text-orange-400' },
  'Eye · Stock Forecast':   { icon: 'trending-down',  color: 'text-red-600 dark:text-red-400' },
  'Eye · Anomalies':        { icon: 'flash',          color: 'text-yellow-600 dark:text-yellow-400' },
  'Floor · Notifications':  { icon: 'notifications',  color: 'text-blue-600 dark:text-blue-400' },
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ alerts, currency }: { alerts: AlertItem[]; currency: string }) {
  if (alerts.length === 0) return null
  const criticalCount = alerts.filter((a) => a.band === 'critical').length
  const warningCount  = alerts.filter((a) => a.band === 'warning').length
  const totalExposure = alerts.reduce((s, a) => s + (a.costExposure ?? 0), 0)

  return (
    <div className="flex flex-wrap items-center gap-6 border-b px-8 py-3 bg-muted/30 text-sm">
      <span className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{alerts.length}</span> active alerts
      </span>
      {criticalCount > 0 && (
        <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="font-semibold tabular-nums">{criticalCount}</span> critical
        </span>
      )}
      {warningCount > 0 && (
        <span className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-600">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          <span className="font-semibold tabular-nums">{warningCount}</span> warning
        </span>
      )}
      {totalExposure > 0 && (
        <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
          <Icon icon="trending-down" size={14} />
          <span className="font-semibold tabular-nums">{formatCurrency(totalExposure, currency)}</span>
          <span className="text-xs text-muted-foreground">total cost exposure</span>
        </span>
      )}
    </div>
  )
}

// ─── Single alert card ────────────────────────────────────────────────────────

function AlertCard({
  item,
  currency,
  requestedVariantIds,
  onTrace,
}: {
  item: AlertItem
  currency: string
  requestedVariantIds: ReadonlySet<string>
  onTrace?: (notifId: string, title: string) => void
}) {
  const meta = BAND_META[item.band]
  const isRequested = !!item._variantId && requestedVariantIds.has(item._variantId)
  return (
    <div className={cn('flex items-start gap-4 rounded border p-3.5', meta.bg, meta.border)}>
      <div className={cn('mt-0.5 flex-shrink-0', meta.iconColor)}>
        <Icon icon={item.icon} size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">
          {item._variantId
            ? <Link to={`/variant/${item._variantId}`} className="hover:underline">{item.title}</Link>
            : item.title
          }
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
        {(item.costExposure ?? 0) > 0 && (
          <p className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(item.costExposure ?? 0, currency)} at risk
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {item._notifId && onTrace && (
          <Button
            size="small"
            variant="minimal"
            onClick={() => { if (item._notifId) onTrace(item._notifId, item.title) }}
            title="Explain why this happened"
          >
            Why?
          </Button>
        )}
        {item.actions.map((a) => {
          const isRestockAction = a.label === 'Request restock'
          if (isRestockAction && isRequested) {
            return (
              <Button
                key={a.label}
                size="small"
                icon="tick"
                intent={Intent.SUCCESS}
                disabled
              >
                Requested
              </Button>
            )
          }
          return (
            <Button
              key={a.label}
              size="small"
              intent={a.intent}
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Layer section ────────────────────────────────────────────────────────────

function LayerSection({
  layer,
  items,
  currency,
  requestedVariantIds,
  onTrace,
}: {
  layer: AlertLayer
  items: AlertItem[]
  currency: string
  requestedVariantIds: ReadonlySet<string>
  onTrace?: (notifId: string, title: string) => void
}) {
  if (items.length === 0) return null
  const meta = LAYER_META[layer]

  const critCount = items.filter((i) => i.band === 'critical').length
  const warnCount = items.filter((i) => i.band === 'warning').length

  return (
    <div className="space-y-2">
      {/* Layer header */}
      <div className="flex items-center gap-2">
        <Icon icon={meta.icon} size={14} className={cn('flex-shrink-0', meta.color)} />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {layer}
        </h2>
        <div className="flex items-center gap-1.5 ml-1">
          {critCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{critCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-yellow-600">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />{warnCount}
            </span>
          )}
          {critCount === 0 && warnCount === 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{items.length}</span>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <AlertCard
            key={item.id}
            item={item}
            currency={currency}
            requestedVariantIds={requestedVariantIds}
            onTrace={onTrace}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Alert config panel ───────────────────────────────────────────────────────

const DAYS_MIN = 1, DAYS_MAX = 60
const WASTE_MIN = 1, WASTE_MAX = 500

function AlertConfigPanel({ onClose }: { onClose: () => void }) {
  const { data: prefs } = useAlertPreferences()
  const update = useUpdateAlertPreferences()

  const [days,  setDays]  = useState<number>(prefs?.days_threshold  ?? 7)
  const [waste, setWaste] = useState<number>(prefs?.waste_threshold ?? 10)

  useEffect(() => {
    if (prefs) { setDays(prefs.days_threshold); setWaste(prefs.waste_threshold) }
  }, [prefs])

  const isDirty   = days !== (prefs?.days_threshold ?? 7) || waste !== (prefs?.waste_threshold ?? 10)
  const isDefault = days === 7 && waste === 10

  const handleSave = () => {
    update.mutate({ days_threshold: days, waste_threshold: waste })
  }

  const handleReset = () => { setDays(7); setWaste(10) }

  const parseInput = (val: string, min: number, max: number) => {
    const n = parseInt(val, 10)
    if (isNaN(n)) return min
    return Math.min(max, Math.max(min, n))
  }

  return (
    <div className="border-b bg-muted/20 px-8 py-4">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Alert Thresholds</p>
          <Button variant="minimal" size="small" onClick={onClose}>Close</Button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Days threshold */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Low stock alert — days until empty
            </label>
            <div className="flex items-center gap-2">
              <InputGroup
                type="number"
                min={DAYS_MIN}
                max={DAYS_MAX}
                value={String(days)}
                onChange={(e) => { setDays(parseInput(e.target.value, DAYS_MIN, DAYS_MAX)) }}
                className="w-24 [&_input]:tabular-nums"
              />
              <span className="text-xs text-muted-foreground">days remaining</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Alert fires when stock is predicted to run out within{' '}
              <span className="font-semibold text-foreground">{days}d</span>.
              {days < 5 && <span className="text-yellow-600 dark:text-yellow-400"> Low sensitivity — only urgent stockouts.</span>}
              {days > 21 && <span className="text-blue-600 dark:text-blue-400"> High sensitivity — more proactive alerts.</span>}
            </p>
          </div>

          {/* Waste threshold */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Waste alert — weekly units threshold
            </label>
            <div className="flex items-center gap-2">
              <InputGroup
                type="number"
                min={WASTE_MIN}
                max={WASTE_MAX}
                value={String(waste)}
                onChange={(e) => { setWaste(parseInput(e.target.value, WASTE_MIN, WASTE_MAX)) }}
                className="w-24 [&_input]:tabular-nums"
              />
              <span className="text-xs text-muted-foreground">units / week</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Alert fires when a variant exceeds{' '}
              <span className="font-semibold text-foreground">{waste} units</span> wasted in 7 days.
              {waste < 5 && <span className="text-yellow-600 dark:text-yellow-400"> Very sensitive — minor waste events trigger alerts.</span>}
              {waste > 50 && <span className="text-blue-600 dark:text-blue-400"> Low sensitivity — only significant waste spikes.</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            icon="floppy-disk"
            size="small"
            intent={Intent.PRIMARY}
            onClick={handleSave}
            disabled={!isDirty}
            loading={update.isPending}
          >
            Save preferences
          </Button>
          {!isDefault && (
            <Button
              icon="undo"
              variant="minimal"
              size="small"
              onClick={handleReset}
            >
              Reset to defaults (7d / 10 units)
            </Button>
          )}
          <p className="ml-auto text-[11px] text-muted-foreground">
            Applies on next &ldquo;Scan Alerts&rdquo; run
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const navigate = useNavigate()
  const currency = useCurrency()
  const fmtDate = useDateFormat()
  const role = useAuthStore((s) => s.role)
  const canScan = role === 'owner' || role === 'admin'

  const [filterBand, setFilterBand] = useState<FilterBand>('all')
  const [requestedIds, setRequestedIds] = useState<ReadonlySet<string>>(new Set())
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  const [traceTarget, setTraceTarget] = useState<{ id: string; title: string } | null>(null)

  const handleOpenTrace = useCallback((notifId: string, title: string) => {
    setTraceTarget({ id: notifId, title })
  }, [])

  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { data: expiring = [], isLoading: expiryLoading }   = useExpiringVariants(90)
  const { data: notifications = [], isLoading: notifLoading } = useNotifications()
  const { data: forecast = [] }   = useConsumptionForecast(30)
  const { data: wasteRadar = [] } = useWasteRadar()
  // Single source of truth for "what counts as expiry-at-risk" — the same expiry
  // monitor the ranked Signals feed reads. Default (7d) reproduces the prior band.
  const { data: monitorPolicy } = useMonitorPolicy()
  const expiryRule = monitorPolicy?.merged.monitors.expiry ?? DEFAULT_ORG_POLICY.monitors.expiry

  const adjustStock  = useAdjustStock()
  const createRestock = useCreateRestockRequest()
  const markRead     = useMarkNotificationRead()
  const markAllRead  = useMarkAllNotificationsRead()
  const autoAlerts   = useAutoAlerts()
  const { data: alertPrefs } = useAlertPreferences()

  useEffect(() => {
    if (autoAlerts.isSuccess) setLastScanTime(new Date())
  }, [autoAlerts.isSuccess])

  const { mutate: doWriteOff }      = adjustStock
  const { mutate: doCreateRestock } = createRestock
  const { mutate: doMarkRead }      = markRead

  const handleWriteOff = useCallback((variantId: string, currentStock: number) => {
    doWriteOff({ variantId, delta: -currentStock, reason: 'Expired — written off', category: 'Spoilage' })
  }, [doWriteOff])

  const handleRestock = useCallback((variantId: string, quantityNeeded: number) => {
    doCreateRestock({ variantId, quantityNeeded })
    setRequestedIds((prev) => new Set([...prev, variantId]))
  }, [doCreateRestock])

  const handleDismiss = useCallback((id: string) => {
    doMarkRead({ id })
  }, [doMarkRead])

  const isLoading = productsLoading || expiryLoading || notifLoading

  const forecastMap = useMemo(
    () => new Map(forecast.map((f) => [f.variant_id, f.days_until_zero])),
    [forecast]
  )
  const wasteRadarIds = useMemo(
    () => new Set(wasteRadar.map((w) => w.variant_id)),
    [wasteRadar]
  )

  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = []

    // ── Eye · Expiry Risk ──────────────────────────────────────────────────
    for (const v of expiring) {
      if (!v.expiry_date) continue
      const days = daysUntil(v.expiry_date)
      const band: Band = days <= expiryRule.threshold_days ? 'critical' : days <= 30 ? 'warning' : 'info'
      const productName  = v.products?.name ?? 'Unknown product'
      const variantLabel = v.name !== 'Standard' ? `${productName} — ${v.name}` : productName
      const daysLabel    = days < 0 ? `Expired ${String(Math.abs(days))}d ago`
                         : days === 0 ? 'Expires today'
                         : `Expires in ${String(days)}d`
      const dtu     = forecastMap.get(v.id)
      const hasWaste = wasteRadarIds.has(v.id)

      const subtitleParts = [
        daysLabel,
        `${String(v.current_stock)} units`,
        dtu != null ? `~${String(Math.round(dtu))}d until zero` : null,
        hasWaste ? 'waste signal' : null,
      ].filter(Boolean)

      items.push({
        id: `expiry-${v.id}`,
        band,
        layer: 'Eye · Expiry Risk',
        icon: 'calendar',
        title: variantLabel,
        subtitle: subtitleParts.join(' · '),
        costExposure: v.current_stock * v.cost,
        actions: [
          {
            label: 'Write off',
            onClick: () => { handleWriteOff(v.id, v.current_stock) },
          },
          {
            label: 'View Expiry',
            onClick: () => { void navigate('/floor?panel=expiry') },
          },
        ],
      })
    }

    // ── Eye · Stock Forecast ───────────────────────────────────────────────
    for (const product of products) {
      for (const variant of product.product_variants) {
        const dtu      = forecastMap.get(variant.id)
        const hasWaste = wasteRadarIds.has(variant.id)
        const label    = variant.name !== 'Standard'
          ? `${product.name} — ${variant.name}`
          : product.name

        if (variant.current_stock === 0 && !variant.has_stock_history) {
          items.push({
            id: `stock-out-${variant.id}`,
            band: 'info',
            layer: 'Eye · Stock Forecast',
            icon: 'add',
            title: `Needs initial stock: ${label}`,
            subtitle: [`SKU ${variant.sku}`, 'Never received — receive initial stock to activate'].join(' · '),
            costExposure: 0,
            _variantId: variant.id,
            _neverStocked: true,
            actions: [
              {
                label: 'Receive stock',
                onClick: () => { void navigate('/flow?panel=receive') },
              },
            ],
          })
        } else if (variant.current_stock === 0) {
          const subtitleParts = [
            `SKU ${variant.sku}`,
            `par ${String(variant.low_stock_threshold)}`,
            hasWaste ? 'waste signal — verify demand' : null,
          ].filter(Boolean)

          items.push({
            id: `stock-out-${variant.id}`,
            band: 'critical',
            layer: 'Eye · Stock Forecast',
            icon: 'box',
            title: `Out of stock: ${label}`,
            subtitle: subtitleParts.join(' · '),
            costExposure: 0,
            _variantId: variant.id,
            _restockQty: Math.max(variant.low_stock_threshold * 2, 1),
            actions: [
              {
                label: 'Request restock',
                intent: Intent.PRIMARY,
                onClick: () => { handleRestock(variant.id, Math.max(variant.low_stock_threshold * 2, 1)) },
              },
            ],
          })
        } else if (
          variant.low_stock_threshold > 0 &&
          variant.current_stock <= variant.low_stock_threshold
        ) {
          const subtitleParts = [
            `${String(variant.current_stock)} left`,
            `par ${String(variant.low_stock_threshold)}`,
            `SKU ${variant.sku}`,
            dtu != null ? `~${String(Math.round(dtu))}d until zero` : null,
            hasWaste ? 'waste signal' : null,
          ].filter(Boolean)

          items.push({
            id: `stock-low-${variant.id}`,
            band: 'warning',
            layer: 'Eye · Stock Forecast',
            icon: 'warning-sign',
            title: `Low stock: ${label}`,
            subtitle: subtitleParts.join(' · '),
            costExposure: variant.current_stock * variant.cost,
            _variantId: variant.id,
            _restockQty: variant.low_stock_threshold * 2 - variant.current_stock,
            actions: [
              {
                label: 'Request restock',
                onClick: () => { handleRestock(variant.id, variant.low_stock_threshold * 2 - variant.current_stock) },
              },
            ],
          })
        }
      }
    }

    // ── Eye · Anomalies + Floor · Notifications ─────────
    for (const n of notifications) {
      if (n.read) continue

      if (n.type === 'consumption_spike') {
        items.push({
          id: `notif-${n.id}`,
          band: 'warning',
          layer: 'Eye · Anomalies',
          icon: 'flash',
          title: n.message,
          subtitle: `Detected ${fmtDate(n.timestamp)} at ${format(new Date(n.timestamp), 'HH:mm')} · based on 30-day avg`,
          _notifId: n.id,
          actions: [
            {
              label: 'Dismiss',
              onClick: () => { handleDismiss(n.id) },
            },
          ],
        })
        continue
      }

      const band: Band =
        n.type === 'predicted_outage' ? 'critical' :
        n.type === 'low_stock' || n.type === 'expiry' || n.type === 'waste_alert' ? 'warning' :
        'info'

      const icon: IconName =
        n.type === 'predicted_outage' ? 'time' :
        n.type === 'waste_alert' ? 'flame' :
        'notifications'

      const isTraceable = n.type === 'predicted_outage' || n.type === 'low_stock'

      items.push({
        id: `notif-${n.id}`,
        band,
        layer: 'Floor · Notifications',
        icon,
        title: n.message,
        subtitle: `${fmtDate(n.timestamp)}, ${format(new Date(n.timestamp), 'HH:mm')}`,
        _notifId: isTraceable ? n.id : undefined,
        actions: [
          {
            label: 'Dismiss',
            onClick: () => { handleDismiss(n.id) },
          },
        ],
      })
    }

    const ORDER: Record<Band, number> = { critical: 0, warning: 1, info: 2 }
    return items.sort((a, b) => {
      const bandDiff = ORDER[a.band] - ORDER[b.band]
      if (bandDiff !== 0) return bandDiff
      return (b.costExposure ?? 0) - (a.costExposure ?? 0)
    })
  }, [
    expiring, products, notifications, forecastMap, wasteRadarIds,
    navigate, handleWriteOff, handleRestock, handleDismiss, fmtDate, expiryRule,
  ])

  const criticalItems = alerts.filter((a) => a.band === 'critical')
  const warningItems  = alerts.filter((a) => a.band === 'warning')
  const infoItems     = alerts.filter((a) => a.band === 'info')

  const visibleAlerts = useMemo(() => {
    if (filterBand === 'all') return alerts
    return alerts.filter((a) => a.band === filterBand)
  }, [alerts, filterBand])

  const byLayer = useMemo(() => {
    const map = new Map<AlertLayer, AlertItem[]>()
    const order: AlertLayer[] = ['Eye · Expiry Risk', 'Eye · Stock Forecast', 'Eye · Anomalies', 'Floor · Notifications']
    for (const layer of order) map.set(layer, [])
    for (const item of visibleAlerts) {
      map.get(item.layer)?.push(item)
    }
    return map
  }, [visibleAlerts])

  const stockAlerts = useMemo(
    () => visibleAlerts.filter((a) => a.layer === 'Eye · Stock Forecast' && a._variantId && !a._neverStocked),
    [visibleAlerts]
  )
  const unreadNotifCount = notifications.filter((n) => !n.read).length

  const handleBulkRestock = () => {
    for (const alert of stockAlerts) {
      if (alert._variantId && alert._restockQty) {
        doCreateRestock({ variantId: alert._variantId, quantityNeeded: alert._restockQty })
      }
    }
  }

  const variantCount = products.reduce((s, p) => s + p.product_variants.length, 0)
  const totalCount = criticalItems.length + warningItems.length + infoItems.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Icon icon="eye-open" size={20} className="text-muted-foreground" />
            Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? 'Loading…' : alerts.length === 0
              ? `All clear — checked ${String(variantCount)} variants · ${String(expiring.length)} expiry dates · ${String(notifications.length)} notifications`
              : `${String(alerts.length)} item${alerts.length !== 1 ? 's' : ''} need${alerts.length === 1 ? 's' : ''} attention`}
          </p>
          <Link to="/eye?panel=signals" className="text-xs text-primary hover:underline mt-0.5 inline-flex items-center gap-1">
            <Icon icon="sort" size={11} /> Ranked signal feed (incidents, suppliers, all objects) →
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {unreadNotifCount > 0 && (
            <Button
              icon="notifications-snooze"
              size="small"
              loading={markAllRead.isPending}
              onClick={() => { markAllRead.mutate() }}
            >
              Dismiss notifications ({unreadNotifCount})
            </Button>
          )}
          {canScan && (
            <>
              <Button
                icon="cog"
                endIcon={configOpen ? 'chevron-up' : 'chevron-down'}
                size="small"
                onClick={() => { setConfigOpen((v) => !v) }}
              >
                Configure
              </Button>
              <Button
                icon="predictive-analysis"
                intent={Intent.PRIMARY}
                size="small"
                loading={autoAlerts.isPending}
                onClick={() => { autoAlerts.mutate({}) }}
              >
                Scan Alerts
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Alert config panel — collapsible threshold settings */}
      {configOpen && canScan && (
        <AlertConfigPanel onClose={() => { setConfigOpen(false) }} />
      )}

      {/* Summary strip */}
      {!isLoading && <SummaryStrip alerts={alerts} currency={currency} />}

      {/* Filter toolbar + bulk action */}
      {!isLoading && alerts.length > 0 && (
        <div className="flex items-center gap-3 border-b px-8 py-3 flex-shrink-0">
          <SegmentedControl
            size="small"
            value={filterBand}
            onValueChange={(v) => { setFilterBand(v as FilterBand) }}
            options={[
              { value: 'all',      label: `All (${String(totalCount)})` },
              { value: 'critical', label: `Critical (${String(criticalItems.length)})` },
              { value: 'warning',  label: `Warning (${String(warningItems.length)})` },
              { value: 'info',     label: `Info (${String(infoItems.length)})` },
            ]}
          />
          {/* Bulk restock CTA */}
          {stockAlerts.length > 0 && (
            <Button
              icon="flash"
              intent={Intent.WARNING}
              size="small"
              className="ml-auto"
              loading={createRestock.isPending}
              onClick={handleBulkRestock}
            >
              Request restock for all {stockAlerts.length} stock alerts
            </Button>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Spinner size={SpinnerSize.STANDARD} />
            Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <NonIdealState
            icon="tick-circle"
            title="All clear"
            description={
              <div className="space-y-1 max-w-sm">
                <p>
                  Scanned <span className="font-semibold text-foreground tabular-nums">{variantCount}</span> variants
                  {lastScanTime && (
                    <span> at <span className="font-semibold text-foreground">{format(lastScanTime, 'HH:mm')}</span></span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground/80 tabular-nums">
                  Low stock: &lt;{alertPrefs?.days_threshold ?? 7}d remaining · Waste: &gt;{alertPrefs?.waste_threshold ?? 10} units/week · {expiring.length} expiry dates checked
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">All conditions normal</p>
              </div>
            }
            action={canScan ? (
              <Button
                icon="predictive-analysis"
                size="small"
                loading={autoAlerts.isPending}
                onClick={() => { autoAlerts.mutate({}) }}
              >
                Re-scan now
              </Button>
            ) : undefined}
          />
        ) : visibleAlerts.length === 0 ? (
          <Callout intent={Intent.NONE} icon="info-sign" compact>
            No alerts in this band.
          </Callout>
        ) : (
          <div className="space-y-8 max-w-3xl">
            {([
              'Eye · Expiry Risk',
              'Eye · Stock Forecast',
              'Eye · Anomalies',
              'Floor · Notifications',
            ] as AlertLayer[]).map((layer) => (
              <LayerSection
                key={layer}
                layer={layer}
                items={byLayer.get(layer) ?? []}
                currency={currency}
                requestedVariantIds={requestedIds}
                onTrace={handleOpenTrace}
              />
            ))}
          </div>
        )}
      </div>

      {/* Causal Trace Panel — "Why did this happen?" */}
      <CausalTracePanel
        open={!!traceTarget}
        onClose={() => { setTraceTarget(null) }}
        rootType="notification"
        rootId={traceTarget?.id ?? null}
        title={traceTarget?.title}
      />
    </div>
  )
}

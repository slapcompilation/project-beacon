// Layer: Eye — intelligence surface for waste, expiry, low-stock, and notification signals
// Sprint A UX: layer-grouped sections (Eye · Expiry / Eye · Stock / Floor · Notifications),
// bulk restock action, and a scope-aware empty state.
// Palantir principle: cross-domain synthesis + decision support, not data display.

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  AlertTriangle, CalendarX2, PackageX, BellDot,
  RefreshCw, Flame, Clock, Sparkles, Loader2,
  TrendingDown, CheckCircle2, BellOff, Eye, Zap,
  PackagePlus, Check, Settings2, ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CausalTracePanel } from '@/components/CausalTracePanel'
import { cn } from '@/lib/utils'
import { useProducts, useExpiringVariants, useAdjustStock } from '@/features/inventory/hooks'
import {
  useNotifications, useMarkNotificationRead,
  useMarkAllNotificationsRead, useAutoAlerts,
  useAlertPreferences, useUpdateAlertPreferences,
} from '@/features/notifications/hooks'
import { useConsumptionForecast, useWasteRadar } from '@/features/eye/hooks'
import { useCreateRestockRequest } from '@/features/restock/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { formatCurrency } from '@/lib/currency'
import { daysUntil } from '@/lib/date'
import { useCurrency } from '@/hooks/useCurrency'
import { useDateFormat } from '@/features/user/hooks'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type Band = 'critical' | 'warning' | 'info'
type FilterBand = 'all' | Band
type AlertLayer = 'Eye · Expiry Risk' | 'Eye · Stock Forecast' | 'Eye · Anomalies' | 'Floor · Notifications'

interface AlertItem {
  id: string
  band: Band
  layer: AlertLayer
  icon: React.ElementType
  title: string
  subtitle: string
  costExposure?: number
  actions: { label: string; onClick: () => void; variant?: 'default' | 'outline' }[]
  // For bulk restock
  _variantId?: string
  _restockQty?: number
  // True for variants that have never received any stock (setup state, not an emergency)
  _neverStocked?: boolean
  // For causal trace: notification id when the alert originated from a notification
  _notifId?: string
}

const BAND_META: Record<Band, {
  label: string; bg: string; border: string; iconColor: string; dot: string
}> = {
  critical: {
    label: 'Critical',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-600',
    dot: 'bg-red-500',
  },
  warning: {
    label: 'Warning',
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-600',
    dot: 'bg-yellow-500',
  },
  info: {
    label: 'Info',
    bg: 'bg-muted/40',
    border: 'border-border',
    iconColor: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
}

const LAYER_META: Record<AlertLayer, { icon: React.ElementType; color: string }> = {
  'Eye · Expiry Risk':      { icon: CalendarX2,    color: 'text-orange-600 dark:text-orange-400' },
  'Eye · Stock Forecast':   { icon: TrendingDown,  color: 'text-red-600 dark:text-red-400' },
  'Eye · Anomalies':        { icon: Zap,           color: 'text-yellow-600 dark:text-yellow-400' },
  'Floor · Notifications':  { icon: BellDot,       color: 'text-blue-600 dark:text-blue-400' },
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
          <TrendingDown className="h-3.5 w-3.5" />
          <span className="font-semibold tabular-nums">{formatCurrency(totalExposure, currency)}</span>
          <span className="text-xs text-muted-foreground">total cost exposure</span>
        </span>
      )}
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

function FilterTabs({
  active,
  onChange,
  counts,
}: {
  active: FilterBand
  onChange: (b: FilterBand) => void
  counts: Record<Band, number>
}) {
  const tabs: { key: FilterBand; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'warning',  label: 'Warning' },
    { key: 'info',     label: 'Info' },
  ]
  return (
    <div className="flex gap-0.5 rounded-md border p-0.5">
      {tabs.map((t) => {
        const count = t.key === 'all'
          ? counts.critical + counts.warning + counts.info
          : counts[t.key]
        return (
          <button
            key={t.key}
            onClick={() => { onChange(t.key) }}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
              active === t.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {t.label}
            {count > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                active === t.key
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {String(count)}
              </span>
            )}
          </button>
        )
      })}
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
  const Icon = item.icon
  const isRequested = !!item._variantId && requestedVariantIds.has(item._variantId)
  return (
    <div className={cn('flex items-start gap-4 rounded-lg border p-3.5', meta.bg, meta.border)}>
      <div className={cn('mt-0.5 flex-shrink-0', meta.iconColor)}>
        <Icon className="h-4 w-4" />
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
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
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
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                disabled
              >
                <Check className="h-3 w-3" />
                Requested
              </Button>
            )
          }
          return (
            <Button
              key={a.label}
              size="sm"
              variant={a.variant ?? 'outline'}
              className="h-7 text-xs"
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

// ─── Layer section (Eye · Expiry / Eye · Stock / Floor · Notifications) ──────

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
  const LayerIcon = meta.icon

  const critCount = items.filter((i) => i.band === 'critical').length
  const warnCount = items.filter((i) => i.band === 'warning').length

  return (
    <div className="space-y-2">
      {/* Layer header */}
      <div className="flex items-center gap-2">
        <LayerIcon className={cn('h-3.5 w-3.5 flex-shrink-0', meta.color)} />
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
// Inline collapsible panel for admins/owners to tune alert sensitivity.
// Saves to alert_preferences table; auto_create_alerts reads these on next scan.

const DAYS_MIN = 1, DAYS_MAX = 60
const WASTE_MIN = 1, WASTE_MAX = 500

function AlertConfigPanel({ onClose }: { onClose: () => void }) {
  const { data: prefs } = useAlertPreferences()
  const update = useUpdateAlertPreferences()

  const [days,  setDays]  = useState<number>(prefs?.days_threshold  ?? 7)
  const [waste, setWaste] = useState<number>(prefs?.waste_threshold ?? 10)

  // Sync form when prefs load
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
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Days threshold */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Low stock alert — days until empty
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={DAYS_MIN}
                max={DAYS_MAX}
                value={days}
                onChange={(e) => { setDays(parseInput(e.target.value, DAYS_MIN, DAYS_MAX)) }}
                className="h-8 w-24 text-sm tabular-nums"
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
              <Input
                type="number"
                min={WASTE_MIN}
                max={WASTE_MAX}
                value={waste}
                onChange={(e) => { setWaste(parseInput(e.target.value, WASTE_MIN, WASTE_MAX)) }}
                className="h-8 w-24 text-sm tabular-nums"
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
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || update.isPending}
            className="gap-1.5 h-8 text-xs"
          >
            {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save preferences
          </Button>
          {!isDefault && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />Reset to defaults (7d / 10 units)
            </button>
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

  // Causal trace panel state
  const [traceTarget, setTraceTarget] = useState<{ id: string; title: string } | null>(null)

  const handleOpenTrace = useCallback((notifId: string, title: string) => {
    setTraceTarget({ id: notifId, title })
  }, [])

  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { data: expiring = [], isLoading: expiryLoading }   = useExpiringVariants(90)
  const { data: notifications = [], isLoading: notifLoading } = useNotifications()
  const { data: forecast = [] }   = useConsumptionForecast(30)
  const { data: wasteRadar = [] } = useWasteRadar()

  const adjustStock  = useAdjustStock()
  const createRestock = useCreateRestockRequest()
  const markRead     = useMarkNotificationRead()
  const markAllRead  = useMarkAllNotificationsRead()
  const autoAlerts   = useAutoAlerts()
  const { data: alertPrefs } = useAlertPreferences()

  // Track when the alert scan last succeeded
  useEffect(() => {
    if (autoAlerts.isSuccess) setLastScanTime(new Date())
  }, [autoAlerts.isSuccess])

  const { mutate: doWriteOff }      = adjustStock
  const { mutate: doCreateRestock } = createRestock
  const { mutate: doMarkRead }      = markRead

  const handleWriteOff = useCallback((variantId: string, currentStock: number) => {
    doWriteOff({ variantId, delta: -currentStock, reason: 'Expired — written off', removalCategory: 'Spoilage' })
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
      const band: Band = days <= 7 ? 'critical' : days <= 30 ? 'warning' : 'info'
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
        icon: CalendarX2,
        title: variantLabel,
        subtitle: subtitleParts.join(' · '),
        costExposure: v.current_stock * v.cost,
        actions: [
          {
            label: 'Write off',
            variant: 'outline',
            onClick: () => { handleWriteOff(v.id, v.current_stock) },
          },
          {
            label: 'View Expiry',
            variant: 'outline',
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
          // "Never stocked" — setup state, not an operational emergency.
          // Render as info band with "Receive stock" action (not a restock request).
          items.push({
            id: `stock-out-${variant.id}`,
            band: 'info',
            layer: 'Eye · Stock Forecast',
            icon: PackagePlus,
            title: `Needs initial stock: ${label}`,
            subtitle: [`SKU ${variant.sku}`, 'Never received — receive initial stock to activate'].join(' · '),
            costExposure: 0,
            _variantId: variant.id,
            _neverStocked: true,
            actions: [
              {
                label: 'Receive stock',
                variant: 'outline',
                onClick: () => { void navigate('/flow?panel=receive') },
              },
            ],
          })
        } else if (variant.current_stock === 0) {
          // Depleted — had stock, now gone. This is the real operational emergency.
          const subtitleParts = [
            `SKU ${variant.sku}`,
            `par ${String(variant.low_stock_threshold)}`,
            hasWaste ? 'waste signal — verify demand' : null,
          ].filter(Boolean)

          items.push({
            id: `stock-out-${variant.id}`,
            band: 'critical',
            layer: 'Eye · Stock Forecast',
            icon: PackageX,
            title: `Out of stock: ${label}`,
            subtitle: subtitleParts.join(' · '),
            costExposure: 0,
            _variantId: variant.id,
            _restockQty: Math.max(variant.low_stock_threshold * 2, 1),
            actions: [
              {
                label: 'Request restock',
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
            icon: AlertTriangle,
            title: `Low stock: ${label}`,
            subtitle: subtitleParts.join(' · '),
            costExposure: variant.current_stock * variant.cost,
            _variantId: variant.id,
            _restockQty: variant.low_stock_threshold * 2 - variant.current_stock,
            actions: [
              {
                label: 'Request restock',
                variant: 'outline',
                onClick: () => { handleRestock(variant.id, variant.low_stock_threshold * 2 - variant.current_stock) },
              },
            ],
          })
        }
      }
    }

    // ── Eye · Anomalies (consumption spikes) + Floor · Notifications ─────────
    for (const n of notifications) {
      if (n.read) continue

      if (n.type === 'consumption_spike') {
        items.push({
          id: `notif-${n.id}`,
          band: 'warning',
          layer: 'Eye · Anomalies',
          icon: Zap,
          title: n.message,
          subtitle: `Detected ${fmtDate(n.timestamp)} at ${format(new Date(n.timestamp), 'HH:mm')} · based on 30-day avg`,
          _notifId: n.id,
          actions: [
            {
              label: 'Dismiss',
              variant: 'outline',
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

      const icon =
        n.type === 'predicted_outage' ? Clock :
        n.type === 'waste_alert' ? Flame :
        BellDot

      // Traceable alert types get the "Why?" button
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
            variant: 'outline',
            onClick: () => { handleDismiss(n.id) },
          },
        ],
      })
    }

    // Sort: critical first → warning → info; within band by cost exposure desc
    const ORDER: Record<Band, number> = { critical: 0, warning: 1, info: 2 }
    return items.sort((a, b) => {
      const bandDiff = ORDER[a.band] - ORDER[b.band]
      if (bandDiff !== 0) return bandDiff
      return (b.costExposure ?? 0) - (a.costExposure ?? 0)
    })
  }, [
    expiring, products, notifications, forecastMap, wasteRadarIds,
    navigate, handleWriteOff, handleRestock, handleDismiss, fmtDate,
  ])

  // Band counts for filter tabs
  const criticalItems = alerts.filter((a) => a.band === 'critical')
  const warningItems  = alerts.filter((a) => a.band === 'warning')
  const infoItems     = alerts.filter((a) => a.band === 'info')

  // Apply band filter
  const visibleAlerts = useMemo(() => {
    if (filterBand === 'all') return alerts
    return alerts.filter((a) => a.band === filterBand)
  }, [alerts, filterBand])

  // Group visible alerts by layer
  const byLayer = useMemo(() => {
    const map = new Map<AlertLayer, AlertItem[]>()
    const order: AlertLayer[] = ['Eye · Expiry Risk', 'Eye · Stock Forecast', 'Eye · Anomalies', 'Floor · Notifications']
    for (const layer of order) map.set(layer, [])
    for (const item of visibleAlerts) {
      map.get(item.layer)?.push(item)
    }
    return map
  }, [visibleAlerts])

  // Bulk restock — only depleted alerts (not "never stocked" info items)
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? 'Loading…' : alerts.length === 0
              ? `All clear — checked ${String(variantCount)} variants · ${String(expiring.length)} expiry dates · ${String(notifications.length)} notifications`
              : `${String(alerts.length)} item${alerts.length !== 1 ? 's' : ''} need${alerts.length === 1 ? 's' : ''} attention`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadNotifCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { markAllRead.mutate() }}
              disabled={markAllRead.isPending}
            >
              {markAllRead.isPending
                ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                : <BellOff className="mr-2 h-3.5 w-3.5" />}
              Dismiss notifications ({unreadNotifCount})
            </Button>
          )}
          {canScan && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setConfigOpen((v) => !v) }}
                className="gap-1.5"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Configure
                {configOpen
                  ? <ChevronUp className="h-3 w-3 ml-0.5" />
                  : <ChevronDown className="h-3 w-3 ml-0.5" />}
              </Button>
              <Button
                size="sm"
                onClick={() => { autoAlerts.mutate({}) }}
                disabled={autoAlerts.isPending}
              >
                {autoAlerts.isPending
                  ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="mr-2 h-3.5 w-3.5" />}
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
          <FilterTabs
            active={filterBand}
            onChange={setFilterBand}
            counts={{
              critical: criticalItems.length,
              warning:  warningItems.length,
              info:     infoItems.length,
            }}
          />
          {/* Bulk restock CTA */}
          {stockAlerts.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
              onClick={handleBulkRestock}
              disabled={createRestock.isPending}
            >
              {createRestock.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Zap className="h-3.5 w-3.5" />}
              Request restock for all {stockAlerts.length} stock alerts
            </Button>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <p className="text-base font-medium">All clear</p>
            <div className="space-y-1 text-sm text-muted-foreground max-w-sm">
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
            {canScan && (
              <Button
                size="sm"
                variant="outline"
                className="mt-1 gap-1.5"
                onClick={() => { autoAlerts.mutate({}) }}
                disabled={autoAlerts.isPending}
              >
                {autoAlerts.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
                Re-scan now
              </Button>
            )}
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            No alerts in this band.
          </div>
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

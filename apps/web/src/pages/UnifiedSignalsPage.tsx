// Layer: Eye — Unified Signal Feed
// Palantir-pattern: intelligence is not a collection of feature pages.
// It is a ranked list of OBJECTS that have active signals.
// Waste, stockout, incident, expiry, supplier risk are signal TYPES on objects —
// not separate destinations. One surface. One truth. Sorted by urgency.
// Filter bar narrows signal type; clicking any row navigates to the object page.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import {
  useWasteRadar,
  useActiveIncidents,
  useConsumptionForecast,
  useSupplierReliability,
} from '@/features/eye/hooks'
import { fetchExpiryBatches } from '@/features/inventory/api'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useMonitorPolicy } from '@/features/monitors/hooks'
import {
  selectExpiryTriggers, selectStockoutTriggers, selectWasteTriggers, selectSupplierTriggers,
  DEFAULT_ORG_POLICY,
  type ExpiryBatch, type StockoutReading, type WasteReading, type SupplierReading, type OrgPolicy,
} from '@beacon/reality-graph'
import { cn } from '@/lib/utils'
import type {
  WasteRadarRow, ConsumptionForecastRow, ActiveIncidentRow,
  SupplierReliabilityRow, ExpiryBatchRow,
} from '@beacon/types'

// ─── Signal model ─────────────────────────────────────────────────────────────

type SignalType = 'incident' | 'waste' | 'stockout' | 'expiry' | 'supplier'
type FilterMode = 'all' | SignalType

interface SignalBadge {
  type:    SignalType
  urgency: number   // 0–10 — drives sort
  detail:  string   // short inline metric
}

interface UnifiedSignal {
  key:        string
  objectType: 'variant' | 'supplier'
  objectName: string
  objectUrl:  string
  badges:     SignalBadge[]
  topUrgency: number
  context:    string  // primary metric line
}

// ─── Signal config ────────────────────────────────────────────────────────────

const SIG: Record<SignalType, { label: string; rowCls: string; badgeCls: string; icon: IconName }> = {
  incident: { label: 'INCIDENT', rowCls: 'border-l-red-500',    badgeCls: 'bg-red-500/15 text-red-400 border-red-500/30',         icon: 'warning-sign'  },
  waste:    { label: 'WASTE',    rowCls: 'border-l-orange-500', badgeCls: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: 'flame'         },
  stockout: { label: 'STOCKOUT', rowCls: 'border-l-amber-500',  badgeCls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',    icon: 'trending-down' },
  expiry:   { label: 'EXPIRY',   rowCls: 'border-l-purple-500', badgeCls: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: 'time'          },
  supplier: { label: 'SUPPLIER', rowCls: 'border-l-blue-500',   badgeCls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       icon: 'shield'        },
}

const urgencyBorderCls = (u: number) =>
  u >= 8 ? 'border-l-red-500' :
  u >= 5 ? 'border-l-amber-500' :
           'border-l-slate-500/40'

// ─── Aggregation ──────────────────────────────────────────────────────────────

function buildSignalFeed(
  incidents:   ActiveIncidentRow[],
  waste:       WasteRadarRow[],
  forecast:    ConsumptionForecastRow[],
  reliability: SupplierReliabilityRow[],
  expiry:      ExpiryBatchRow[],
  monitors:    OrgPolicy['monitors'],
): UnifiedSignal[] {
  const map = new Map<string, UnifiedSignal>()

  const upsert = (key: string, name: string, url: string, type: UnifiedSignal['objectType']): UnifiedSignal => {
    let entry = map.get(key)
    if (!entry) {
      entry = { key, objectType: type, objectName: name, objectUrl: url, badges: [], topUrgency: 0, context: '' }
      map.set(key, entry)
    }
    return entry
  }

  // Incidents — always highest urgency because they're correlated cross-domain
  for (const row of incidents) {
    const obj = upsert(row.variant_id, row.variant_label, `/variant/${row.variant_id}`, 'variant')
    const urgency = row.incident_severity === 'critical' ? 9 : row.incident_severity === 'elevated' ? 6 : 3
    obj.badges.push({ type: 'incident', urgency, detail: row.primary_signal })
    if (!obj.context) obj.context = row.primary_signal
  }

  // Waste anomalies — surfacing floor is the tunable rule, not "show everything"
  const wasteReadings: WasteReading[] = waste.map((row) => ({
    variantId:        row.variant_id,
    variantLabel:     row.variant_label,
    anomalyScore:     row.anomaly_score,
    pctAboveBaseline: row.pct_above_baseline,
    qty7d:            row.qty_7d,
  }))
  for (const hit of selectWasteTriggers(wasteReadings, monitors.waste)) {
    const obj = upsert(hit.variantId, hit.variantLabel, `/variant/${hit.variantId}`, 'variant')
    obj.badges.push({ type: 'waste', urgency: hit.urgency, detail: `${hit.pctAboveBaseline.toFixed(0)}% above baseline · score ${hit.anomalyScore.toFixed(1)}` })
    if (!obj.context) obj.context = `${String(hit.qty7d)} units written off this week`
  }

  // Stockout risk — surfacing band from the tunable rule (the proposal path is
  // restock_advisor, unchanged). No hardcoded 14/7/3-day ladder.
  const stockoutReadings: StockoutReading[] = forecast.map((row) => ({
    variantId:     row.variant_id,
    variantLabel:  row.variant_name !== 'Standard' ? `${row.product_name} · ${row.variant_name}` : row.product_name,
    daysUntilZero: row.days_until_zero,
    currentStock:  row.current_stock,
    avgDaily:      row.avg_daily,
  }))
  for (const hit of selectStockoutTriggers(stockoutReadings, monitors.stockout)) {
    const dtz = Math.round(hit.daysUntilZero)
    const obj = upsert(hit.variantId, hit.variantLabel, `/variant/${hit.variantId}`, 'variant')
    obj.badges.push({ type: 'stockout', urgency: hit.urgency, detail: `${String(dtz)}d until zero · avg ${hit.avgDaily.toFixed(1)}/day` })
    if (!obj.context) obj.context = `${String(hit.currentStock)} in stock · ${String(dtz)}d remaining`
  }

  // Expiry risk — the window + urgency bands come from the operator's tunable
  // monitor rule, not a hardcoded 30/7/3-day ladder. Same evaluator the sweep
  // and the cycle use. Deduplicate by variant (most-urgent batch leads).
  const expiryBatches: ExpiryBatch[] = expiry.map((row) => ({
    variantId:       row.variant_id,
    variantLabel:    `${row.product_name} · ${row.variant_name}`,
    quantity:        row.quantity,
    daysUntilExpiry: row.days_until_expiry,
    costAtRisk:      row.cost_at_risk,
    hotelId:         '',
  }))
  const seenExpiry = new Set<string>()
  for (const hit of selectExpiryTriggers(expiryBatches, monitors.expiry)) {
    if (seenExpiry.has(hit.variantId)) continue
    seenExpiry.add(hit.variantId)
    const obj = upsert(hit.variantId, hit.variantLabel, `/variant/${hit.variantId}`, 'variant')
    obj.badges.push({ type: 'expiry', urgency: hit.urgency, detail: `${String(hit.daysUntilExpiry)}d · ${String(hit.quantity)} units · €${hit.costAtRisk.toFixed(0)} at risk` })
    if (!obj.context) obj.context = `Expires in ${String(hit.daysUntilExpiry)}d`
  }

  // Supplier risk — surfacing band from the tunable reliability-score cutoff
  const supplierReadings: SupplierReading[] = reliability.map((row) => ({
    supplierId:       row.supplier_id,
    supplierName:     row.supplier_name,
    reliabilityScore: row.reliability_score,
    onTimePct:        row.on_time_pct,
    avgDelayDays:     row.avg_delay_days,
    riskTier:         row.risk_tier,
  }))
  for (const hit of selectSupplierTriggers(supplierReadings, monitors.supplier)) {
    const key = hit.supplierId ?? `supplier-name-${hit.supplierName}`
    const url = hit.supplierId ? `/supplier/${hit.supplierId}` : '/mind?panel=suppliers'
    const obj = upsert(key, hit.supplierName, url, 'supplier')
    obj.badges.push({
      type: 'supplier', urgency: hit.urgency,
      detail: `Score ${hit.reliabilityScore.toFixed(1)}/10 · ${hit.onTimePct.toFixed(0)}% on-time · avg ${hit.avgDelayDays.toFixed(1)}d late`,
    })
    if (!obj.context) obj.context = `${hit.riskTier.toUpperCase()} risk · reliability ${hit.reliabilityScore.toFixed(1)}/10`
  }

  // Compute topUrgency and sort
  for (const obj of map.values()) {
    obj.topUrgency = Math.max(...obj.badges.map((b) => b.urgency), 0)
  }

  return [...map.values()].sort((a, b) => b.topUrgency - a.topUrgency)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UrgencyBar({ score }: { score: number }) {
  const cls =
    score >= 8 ? 'bg-red-500' :
    score >= 5 ? 'bg-amber-500' :
    score >= 3 ? 'bg-yellow-500' : 'bg-slate-500/30'
  return (
    <div className="flex h-full w-1.5 flex-col justify-end rounded-full overflow-hidden bg-muted/30">
      <div className={cn('w-full rounded-full transition-all', cls)} style={{ height: `${score * 10}%` }} />
    </div>
  )
}

function SignalRow({ signal, rank }: { signal: UnifiedSignal; rank: number }) {
  return (
    <Link
      to={signal.objectUrl}
      className={cn(
        'flex items-start gap-3 border-l-4 px-4 py-3 hover:bg-muted/20 transition-colors border-b border-border',
        urgencyBorderCls(signal.topUrgency),
      )}
    >
      {/* Rank + urgency bar */}
      <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
        <span className="text-[10px] font-mono text-muted-foreground">#{rank}</span>
        <UrgencyBar score={signal.topUrgency} />
      </div>

      {/* Object type icon */}
      <div className="mt-0.5 shrink-0 text-muted-foreground/60">
        <Icon icon={signal.objectType === 'supplier' ? 'truck' : 'box'} size={14} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm leading-tight">{signal.objectName}</span>
          <Icon icon="chevron-right" size={14} className="shrink-0 text-muted-foreground/40 mt-0.5" />
        </div>

        {/* Signal badges */}
        <div className="flex flex-wrap gap-1">
          {signal.badges
            .sort((a, b) => b.urgency - a.urgency)
            .map((badge, i) => {
              const cfg = SIG[badge.type]
              return (
                <span key={i} className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', cfg.badgeCls)}>
                  <Icon icon={cfg.icon} size={10} />
                  {cfg.label}
                </span>
              )
            })}
        </div>

        {/* Context line */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {signal.badges
            .sort((a, b) => b.urgency - a.urgency)
            .map((b) => b.detail)
            .join(' · ')}
        </p>

      </div>
    </Link>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const FILTERS: { mode: FilterMode; label: string }[] = [
  { mode: 'all',      label: 'All' },
  { mode: 'incident', label: 'Incidents' },
  { mode: 'waste',    label: 'Waste' },
  { mode: 'stockout', label: 'Stockout' },
  { mode: 'supplier', label: 'Suppliers' },
  { mode: 'expiry',   label: 'Expiry' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UnifiedSignalsPage() {
  const hotelId = useActiveHotelId()
  const [filter, setFilter] = useState<FilterMode>('all')

  const { data: monitorPolicy } = useMonitorPolicy()
  const monitors = monitorPolicy?.merged.monitors ?? DEFAULT_ORG_POLICY.monitors

  const { data: incidents   = [], isLoading: l1 } = useActiveIncidents(7)
  const { data: waste       = [], isLoading: l2 } = useWasteRadar()
  const { data: forecast    = [], isLoading: l3 } = useConsumptionForecast(30)
  const { data: reliability = [], isLoading: l4 } = useSupplierReliability(90)
  const { data: expiry      = [], isLoading: l5 } = useQuery({
    // Metric pull: a wide window; the tunable trigger decides what surfaces.
    queryKey:  ['eye', 'expiry-batches', hotelId, monitors.expiry.threshold_days],
    queryFn:   () => fetchExpiryBatches(Math.max(monitors.expiry.threshold_days, 30)),
    enabled:   !!hotelId,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = l1 || l2 || l3 || l4 || l5

  const allSignals = useMemo(
    () => buildSignalFeed(incidents, waste, forecast, reliability, expiry, monitors),
    [incidents, waste, forecast, reliability, expiry, monitors],
  )

  const counts: Record<FilterMode, number> = useMemo(() => ({
    all:      allSignals.length,
    incident: allSignals.filter((s) => s.badges.some((b) => b.type === 'incident')).length,
    waste:    allSignals.filter((s) => s.badges.some((b) => b.type === 'waste')).length,
    stockout: allSignals.filter((s) => s.badges.some((b) => b.type === 'stockout')).length,
    supplier: allSignals.filter((s) => s.badges.some((b) => b.type === 'supplier')).length,
    expiry:   allSignals.filter((s) => s.badges.some((b) => b.type === 'expiry')).length,
  }), [allSignals])

  const visible = useMemo(
    () => filter === 'all' ? allSignals : allSignals.filter((s) => s.badges.some((b) => b.type === filter)),
    [allSignals, filter],
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 bg-background overflow-x-auto">
        <SegmentedControl
          size="small"
          value={filter}
          onValueChange={(v) => { setFilter(v as FilterMode) }}
          options={FILTERS.map((f) => ({
            value: f.mode,
            label: counts[f.mode] > 0 ? `${f.label} (${String(counts[f.mode])})` : f.label,
          }))}
        />
        <Link to="/floor?panel=alerts" className="ml-auto shrink-0 text-xs text-primary hover:underline pr-1 inline-flex items-center gap-1">
          <Icon icon="th-list" size={11} /> Act in Alerts workbench →
        </Link>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground text-sm">
            <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
            Scanning all signals…
          </div>
        ) : visible.length === 0 ? (
          <NonIdealState
            icon="tick-circle"
            title={`No active ${filter === 'all' ? 'signals' : filter} signals`}
            description={filter === 'all'
              ? `Scanned ${String(waste.length + forecast.filter((f) => (f.days_until_zero ?? 99) <= 14).length + incidents.length + reliability.filter((r) => r.risk_tier === 'critical' || r.risk_tier === 'high').length)} sources · all objects within thresholds`
              : `No ${filter} anomalies detected in the current window.`}
          />
        ) : (
          <div className="divide-y-0">
            {visible.map((signal, i) => (
              <SignalRow
                key={signal.key}
                signal={signal}
                rank={i + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

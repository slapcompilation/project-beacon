// Layer: Cross-domain — Variant Object Page
// Palantir-pattern: every named entity is navigable to its full object context.
// Combines Floor (stock/location), Flow (logs, restocks), Eye (forecast, waste anomaly).
// Route: /variant/:variantId

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useWasteRadar, useConsumptionForecast } from '@/features/eye/hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, AlertTriangle, TrendingDown, ShoppingCart, Package,
  MapPin, Clock, CheckCircle2, XCircle, RotateCcw, ChevronRight,
} from 'lucide-react'
import type { ProductVariant, StockLog, RestockRequest } from '@beacon/types'
import { forecastForVariant, consumptionUrgency, stockUrgency } from '@beacon/reality-graph'
import { GraphConnections } from '@/components/GraphConnections'

// ─── Local types ─────────────────────────────────────────────────────────────

interface VariantWithContext extends ProductVariant {
  products: {
    id: string
    name: string
    sku: string
    categories: { name: string } | null
  } | null
  locations: { name: string } | null
}

interface OpenRestockRow extends RestockRequest {
  product_variants: { name: string; products: { name: string } | null } | null
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchVariantContext(variantId: string): Promise<VariantWithContext | null> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*, products(id, name, sku, categories(name)), locations(name)')
    .eq('id', variantId)
    .single() as unknown as {
      data: VariantWithContext | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data
}

async function fetchVariantLogs(variantId: string): Promise<StockLog[]> {
  const { data, error } = await supabase
    .from('stock_logs')
    .select('*')
    .eq('variant_id', variantId)
    .order('timestamp', { ascending: false })
    .limit(50) as unknown as {
      data: StockLog[] | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data ?? []
}

async function fetchVariantRestocks(variantId: string): Promise<OpenRestockRow[]> {
  const { data, error } = await supabase
    .from('restock_requests')
    .select('*, product_variants(name, products(name))')
    .eq('variant_id', variantId)
    .not('status', 'in', '("fulfilled","cancelled","rejected")')
    .order('date', { ascending: false }) as unknown as {
      data: OpenRestockRow[] | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub?: string; accent?: 'green' | 'amber' | 'red' | 'muted'
}) {
  const colors: Record<string, string> = {
    green: 'text-emerald-500',
    amber: 'text-amber-500',
    red:   'text-red-500',
    muted: 'text-muted-foreground',
  }
  return (
    <div className="rounded border border-border bg-card p-3 space-y-0.5">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={cn('text-2xl font-mono font-semibold tabular-nums', accent ? colors[accent] : 'text-foreground')}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function PARStatusBadge({ stock, par }: { stock: number; par: number }) {
  if (stock === 0) return <span className="rounded text-xs font-medium px-2 py-0.5 bg-red-500/15 text-red-500 border border-red-500/30">OUT</span>
  if (par > 0 && stock <= par * 0.5) return <span className="rounded text-xs font-medium px-2 py-0.5 bg-red-500/15 text-red-500 border border-red-500/30">CRITICAL</span>
  if (par > 0 && stock <= par) return <span className="rounded text-xs font-medium px-2 py-0.5 bg-amber-500/15 text-amber-500 border border-amber-500/30">LOW</span>
  return <span className="rounded text-xs font-medium px-2 py-0.5 bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">OK</span>
}

function LogRow({ log }: { log: StockLog }) {
  const isPositive = log.quantity_change > 0
  const isRevert   = log.is_revert

  return (
    <Link
      to={`/log/${log.id}`}
      className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors rounded px-1 -mx-1"
    >
      <div className={cn(
        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        isRevert ? 'bg-purple-500/15 text-purple-500' :
        isPositive ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500',
      )}>
        {isRevert ? <RotateCcw className="h-3 w-3" /> : isPositive ? '+' : '−'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            isRevert ? 'text-purple-500' :
            isPositive ? 'text-emerald-500' : 'text-red-500',
          )}>
            {isPositive ? '+' : ''}{log.quantity_change}
          </span>
          <span className="text-xs text-muted-foreground">→ {log.balance_after} remaining</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{log.reason}</div>
        {log.removal_category && (
          <div className="text-xs text-amber-500/80">{log.removal_category}</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
        </div>
        <div className="text-xs text-muted-foreground/60">
          {format(new Date(log.timestamp), 'dd/MM HH:mm')}
        </div>
      </div>
    </Link>
  )
}

function RestockStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:          { label: 'Pending',  cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
    pending_manager:  { label: 'Awaiting Manager', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
    pending_director: { label: 'Awaiting Director', cls: 'bg-orange-500/15 text-orange-500 border-orange-500/30' },
    approved:         { label: 'Approved', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
  return <span className={cn('rounded text-xs font-medium px-2 py-0.5 border', s.cls)}>{s.label}</span>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VariantObjectPage() {
  const { variantId } = useParams<{ variantId: string }>()
  const navigate      = useNavigate()
  useActiveHotelId() // ensures hotel context is ready for RLS

  const { data: variant, isLoading: loadingVariant, error: variantError } = useQuery({
    queryKey:  ['variant-object', variantId],
    queryFn:   () => fetchVariantContext(variantId!),
    enabled:   !!variantId,
    staleTime: 60_000,
  })

  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey:  ['variant-logs', variantId],
    queryFn:   () => fetchVariantLogs(variantId!),
    enabled:   !!variantId,
    staleTime: 30_000,
  })

  const { data: restocks = [], isLoading: loadingRestocks } = useQuery({
    queryKey:  ['variant-restocks', variantId],
    queryFn:   () => fetchVariantRestocks(variantId!),
    enabled:   !!variantId,
    staleTime: 30_000,
  })

  // Cross-domain intelligence — filter from cached Eye layer data
  const { data: wasteRows = [] }    = useWasteRadar()
  const { data: forecastRows = [] } = useConsumptionForecast(30)

  const wasteAnomaly  = wasteRows.find((r) => r.variant_id === variantId) ?? null
  const forecast      = forecastForVariant(variantId!, forecastRows)

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loadingVariant) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading variant…
      </div>
    )
  }

  if (variantError || !variant) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <XCircle className="h-8 w-8 text-red-500/60" />
        <p className="text-sm">Variant not found or you don't have access.</p>
        <button type="button" onClick={() => { navigate(-1) }} className="text-xs text-primary hover:underline">← Go back</button>
      </div>
    )
  }

  // ─── Derived metrics ──────────────────────────────────────────────────────

  const productName  = variant.products?.name ?? 'Unknown product'
  const categoryName = variant.products?.categories?.name ?? null
  const locationName = variant.locations?.name ?? null

  const daysUntilZero    = forecast?.days_until_zero ?? null
  const avgDaily         = forecast?.avg_daily ?? null
  const consumptionStatus = consumptionUrgency(daysUntilZero, 7)
  const daysAccent: 'green' | 'amber' | 'red' | 'muted' =
    consumptionStatus === 'critical' ? 'red' :
    consumptionStatus === 'warning'  ? 'amber' :
    consumptionStatus === 'watch'    ? 'amber' :
    daysUntilZero === null           ? 'muted' : 'green'

  const stockStatus = stockUrgency(variant)
  const stockAccent: 'red' | 'amber' | 'green' =
    stockStatus === 'critical' ? 'red' :
    stockStatus === 'low'      ? 'amber' : 'green'

  const costAtRisk = (variant.cost ?? 0) * (variant.current_stock ?? 0)

  // 30-day totals from logs
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const logsLast30  = logs.filter((l) => new Date(l.timestamp) >= thirtyDaysAgo)
  const consumed30  = logsLast30.filter((l) => l.quantity_change < 0 && !l.is_revert).reduce((s, l) => s + Math.abs(l.quantity_change), 0)
  const received30  = logsLast30.filter((l) => l.quantity_change > 0 && !l.is_revert).reduce((s, l) => s + l.quantity_change, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
        <button
          type="button"
          onClick={() => { navigate(-1) }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        {categoryName && (
          <>
            <span className="text-sm text-muted-foreground">{categoryName}</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          </>
        )}
        <span className="text-sm text-muted-foreground">{productName}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        <span className="text-sm font-medium text-foreground">{variant.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">

          {/* ── Object identity strip ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-xl font-semibold">{productName} · {variant.name}</h1>
              </div>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono">{variant.sku}</span>
                {locationName && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {locationName}
                  </span>
                )}
                {categoryName && <span>{categoryName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <PARStatusBadge stock={variant.current_stock} par={variant.low_stock_threshold} />
              {wasteAnomaly && (
                <span className="rounded text-xs font-medium px-2 py-0.5 bg-orange-500/15 text-orange-500 border border-orange-500/30 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Waste anomaly
                </span>
              )}
            </div>
          </div>

          {/* ── 4 stat cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Current Stock"
              value={`${variant.current_stock}${variant.unit_of_measure ? ' ' + variant.unit_of_measure : ''}`}
              sub={`PAR: ${variant.low_stock_threshold > 0 ? variant.low_stock_threshold : '—'}`}
              accent={stockAccent}
            />
            <StatCard
              label="Days Until Zero"
              value={daysUntilZero !== null ? `${Math.round(daysUntilZero)}d` : '—'}
              sub={avgDaily !== null ? `avg ${avgDaily.toFixed(1)}/day · 30d` : 'Insufficient data'}
              accent={daysAccent}
            />
            <StatCard
              label="30d Consumed"
              value={consumed30.toString()}
              sub={`${received30} received · ${logsLast30.length} events`}
            />
            <StatCard
              label="Stock Value"
              value={`€${costAtRisk.toFixed(2)}`}
              sub={`@ €${(variant.cost ?? 0).toFixed(2)} / unit`}
            />
          </div>

          {/* ── Waste anomaly callout ── */}
          {wasteAnomaly && (
            <div className="rounded border border-orange-500/30 bg-orange-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-orange-500">Waste anomaly detected</div>
                  <div className="text-xs text-muted-foreground">
                    {wasteAnomaly.qty_7d} units written off this week — {wasteAnomaly.pct_above_baseline.toFixed(0)}% above 4-week baseline.
                    Anomaly score: <span className="text-orange-400 font-mono">{wasteAnomaly.anomaly_score.toFixed(1)}/10</span>
                    {wasteAnomaly.top_user_email && ` · most write-offs by ${wasteAnomaly.top_user_email}`}.
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Breakdown — Spoilage: {wasteAnomaly.spoilage_qty} · Breakage: {wasteAnomaly.breakage_qty} · Theft: {wasteAnomaly.theft_qty}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Open restock requests ── */}
          {!loadingRestocks && (
            <div className="rounded border border-border bg-card">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Open Restock Requests ({restocks.length})
                </span>
                <Link
                  to={`/flow?panel=approvals`}
                  className="text-xs text-primary hover:underline"
                >
                  View all →
                </Link>
              </div>
              {restocks.length === 0 ? (
                <div className="px-3 py-3 text-xs text-muted-foreground">
                  No open requests. Stock replenishment will be needed
                  {daysUntilZero !== null ? ` in ~${Math.round(daysUntilZero)} days` : ' — consumption data not available'}.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {restocks.map((r) => (
                    <Link key={r.id} to={`/restock/${r.id}`} className="flex items-center justify-between px-3 py-2 hover:bg-accent transition-colors">
                      <div>
                        <div className="text-sm">
                          {r.quantity_needed} {variant.unit_of_measure || 'units'}
                          {r.supplier && <span className="text-muted-foreground ml-2">from {r.supplier}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Requested {format(new Date(r.date), 'dd/MM/yyyy')}
                          {r.estimated_cost != null && ` · Est. €${r.estimated_cost.toFixed(2)}`}
                        </div>
                      </div>
                      <RestockStatusBadge status={r.status} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/flow?panel=approvals`}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Request Restock
            </Link>
            <Link
              to={`/floor?panel=stock`}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <TrendingDown className="h-4 w-4" />
              Adjust Stock
            </Link>
            <Link
              to={`/eye?panel=signals`}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <AlertTriangle className="h-4 w-4" />
              Waste Radar
            </Link>
            <Link
              to={`/flow?panel=causal`}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Clock className="h-4 w-4" />
              Causal Chain
            </Link>
          </div>

          {/* ── Stock log timeline ── */}
          <div className="rounded border border-border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Stock Log — Last 50 Events
              </span>
              {loadingLogs && <span className="text-xs text-muted-foreground">Loading…</span>}
            </div>
            {logs.length === 0 && !loadingLogs ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                No stock events recorded yet.
                {!variant.has_stock_history && (
                  <span className="ml-1 text-amber-500">This variant has never been stocked — set initial stock first.</span>
                )}
              </div>
            ) : (
              <div className="px-3 divide-y-0">
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>

          {/* ── Intelligence summary ── */}
          {forecast && (
            <div className="rounded border border-border bg-card px-3 py-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Consumption Intelligence
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg daily</span>
                  <span className="font-mono">{forecast.avg_daily.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days until zero</span>
                  <span className={cn('font-mono', daysAccent === 'red' ? 'text-red-500' : daysAccent === 'amber' ? 'text-amber-500' : '')}>
                    {daysUntilZero != null ? `${Math.round(daysUntilZero)}d` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rec. order qty</span>
                  <span className="font-mono">{forecast.recommended_order_qty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Open request</span>
                  <span>{forecast.has_open_request ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" /> : <XCircle className="h-4 w-4 text-red-500/60 inline" />}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground/60">
                Based on 30-day burn rate · {format(new Date(), 'dd/MM/yyyy HH:mm')} snapshot
              </div>
            </div>
          )}

          {/* ── Graph connections ── */}
          <div className="rounded-lg border border-border bg-card p-4">
            <GraphConnections nodeType="variant" nodeId={variantId!} />
          </div>

        </div>
      </div>
    </div>
  )
}

// Layer: Cross-domain — Variant Object Page
// Palantir-pattern: every named entity is navigable to its full object context.
// Combines Floor (stock/location), Flow (logs, restocks), Eye (forecast, waste anomaly).
// Route: /variant/:variantId
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  AnchorButton,
  Button,
  Callout,
  Card,
  Icon,
  Intent,
  NonIdealState,
  Tag,
} from '@blueprintjs/core'
import { supabase } from '@/lib/supabase/client'
import { useWasteRadar, useConsumptionForecast } from '@/features/eye/hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { cn } from '@/lib/utils'
import type { ProductVariant, StockLog, RestockRequest } from '@beacon/types'
import { forecastForVariant, consumptionUrgency, stockUrgency } from '@beacon/reality-graph'
import { GraphConnections } from '@/components/GraphConnections'
import { ObjectActions } from '@/components/ObjectActions'
import { AdviceSlideOver } from '@/features/agents/AdviceSlideOver'

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
    <Card compact>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={cn('text-2xl font-mono font-semibold tabular-nums', accent ? colors[accent] : 'text-foreground')}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  )
}

function PARStatusBadge({ stock, par }: { stock: number; par: number }) {
  if (stock === 0) return <Tag intent={Intent.DANGER} minimal>OUT</Tag>
  if (par > 0 && stock <= par * 0.5) return <Tag intent={Intent.DANGER} minimal>CRITICAL</Tag>
  if (par > 0 && stock <= par) return <Tag intent={Intent.WARNING} minimal>LOW</Tag>
  return <Tag intent={Intent.SUCCESS} minimal>OK</Tag>
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
        {isRevert ? <Icon icon="undo" size={12} /> : isPositive ? '+' : '−'}
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
  const map: Record<string, { label: string; intent: Intent }> = {
    pending:          { label: 'Pending',           intent: Intent.NONE },
    pending_manager:  { label: 'Awaiting Manager',  intent: Intent.WARNING },
    pending_director: { label: 'Awaiting Director', intent: Intent.WARNING },
    approved:         { label: 'Approved',          intent: Intent.SUCCESS },
  }
  const s = map[status] ?? { label: status, intent: Intent.NONE }
  return <Tag intent={s.intent} minimal>{s.label}</Tag>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VariantObjectPage() {
  const { variantId } = useParams<{ variantId: string }>()
  const navigate      = useNavigate()
  const [adviceOpen, setAdviceOpen] = useState(false)
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

  const { data: wasteRows = [] }    = useWasteRadar()
  const { data: forecastRows = [] } = useConsumptionForecast(30)

  const wasteAnomaly  = wasteRows.find((r) => r.variant_id === variantId) ?? null
  const forecast      = forecastForVariant(variantId!, forecastRows)

  if (loadingVariant) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading variant…
      </div>
    )
  }

  if (variantError || !variant) {
    return (
      <NonIdealState
        icon="cross-circle"
        title="Variant not found"
        description="Variant not found or you don&apos;t have access."
        action={
          <Button variant="minimal" intent={Intent.PRIMARY} onClick={() => { navigate(-1) }}>
            ← Go back
          </Button>
        }
      />
    )
  }

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

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const logsLast30  = logs.filter((l) => new Date(l.timestamp) >= thirtyDaysAgo)
  const consumed30  = logsLast30.filter((l) => l.quantity_change < 0 && !l.is_revert).reduce((s, l) => s + Math.abs(l.quantity_change), 0)
  const received30  = logsLast30.filter((l) => l.quantity_change > 0 && !l.is_revert).reduce((s, l) => s + l.quantity_change, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
        <Button
          icon="arrow-left"
          variant="minimal"
          size="small"
          onClick={() => { navigate(-1) }}
        >
          Back
        </Button>
        <Icon icon="chevron-right" size={12} className="text-muted-foreground/40" />
        {categoryName && (
          <>
            <span className="text-sm text-muted-foreground">{categoryName}</span>
            <Icon icon="chevron-right" size={12} className="text-muted-foreground/40" />
          </>
        )}
        <span className="text-sm text-muted-foreground">{productName}</span>
        <Icon icon="chevron-right" size={12} className="text-muted-foreground/40" />
        <span className="text-sm font-medium text-foreground">{variant.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">

          {/* ── Object identity strip ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Icon icon="box" size={20} className="text-muted-foreground" />
                <h1 className="text-xl font-semibold">{productName} · {variant.name}</h1>
              </div>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono">{variant.sku}</span>
                {locationName && (
                  <span className="flex items-center gap-1">
                    <Icon icon="map-marker" size={12} />
                    {locationName}
                  </span>
                )}
                {categoryName && <span>{categoryName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <PARStatusBadge stock={variant.current_stock} par={variant.low_stock_threshold} />
              {wasteAnomaly && (
                <Tag icon="warning-sign" intent={Intent.WARNING} minimal>
                  Waste anomaly
                </Tag>
              )}
              <Button
                icon="predictive-analysis"
                intent={Intent.PRIMARY}
                size="small"
                onClick={() => { setAdviceOpen(true) }}
              >
                Get restock advice
              </Button>
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
            <Callout intent={Intent.WARNING} icon="warning-sign" title="Waste anomaly detected" compact>
              <div className="text-xs">
                {wasteAnomaly.qty_7d} units written off this week — {wasteAnomaly.pct_above_baseline.toFixed(0)}% above 4-week baseline.
                Anomaly score: <span className="font-mono">{wasteAnomaly.anomaly_score.toFixed(1)}/10</span>
                {wasteAnomaly.top_user_email && ` · most write-offs by ${wasteAnomaly.top_user_email}`}.
              </div>
              <div className="text-xs mt-1">
                Breakdown — Spoilage: {wasteAnomaly.spoilage_qty} · Breakage: {wasteAnomaly.breakage_qty} · Theft: {wasteAnomaly.theft_qty}
              </div>
            </Callout>
          )}

          {/* ── Open restock requests ── */}
          {!loadingRestocks && (
            <Card compact className="!p-0">
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
            </Card>
          )}

          {/* ── Actions ── */}
          <div className="flex flex-wrap gap-2">
            <AnchorButton href="/flow?panel=approvals" icon="shopping-cart">
              Request Restock
            </AnchorButton>
            <AnchorButton href="/floor?panel=stock" icon="trending-down">
              Adjust Stock
            </AnchorButton>
            <AnchorButton href="/eye?panel=signals" icon="warning-sign">
              Waste Radar
            </AnchorButton>
            <AnchorButton href="/flow?panel=causal" icon="time">
              Causal Chain
            </AnchorButton>
          </div>

          {/* ── Stock log timeline ── */}
          <Card compact className="!p-0">
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
              <div className="px-3">
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </div>
            )}
          </Card>

          {/* ── Intelligence summary ── */}
          {forecast && (
            <Card compact>
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
                  <span>{forecast.has_open_request
                    ? <Icon icon="tick-circle" size={14} className="text-emerald-500 inline" />
                    : <Icon icon="cross-circle" size={14} className="text-red-500/60 inline" />}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground/60">
                Based on 30-day burn rate · {format(new Date(), 'dd/MM/yyyy HH:mm')} snapshot
              </div>
            </Card>
          )}

          {/* ── Inline actions ── */}
          <Card>
            <ObjectActions
              nodeType="variant"
              variantId={variantId!}
              currentStock={variant.current_stock ?? 0}
              hasOpenRequest={forecast?.has_open_request ?? false}
            />
          </Card>

          {/* ── Graph connections ── */}
          <Card>
            <GraphConnections nodeType="variant" nodeId={variantId!} />
          </Card>

        </div>
      </div>

      <AdviceSlideOver
        open={adviceOpen}
        onClose={() => { setAdviceOpen(false) }}
        variantId={variantId!}
        variantName={variant.name}
      />
    </div>
  )
}

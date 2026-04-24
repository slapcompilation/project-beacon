// Layer: Cross-domain — Supplier Object Page
// Palantir-pattern: every named entity is navigable to its full object context.
// Combines Mind (contracts, POs), Eye (reliability, price history), Flow (deliveries).
// Route: /supplier/:supplierId

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useSupplierReliability } from '@/features/eye/hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, ChevronRight, AlertTriangle, TrendingDown,
  Package, Phone, Mail, FileText, ExternalLink, XCircle, CheckCircle2,
  Star, Clock,
} from 'lucide-react'
import type { Supplier, SupplierContract, ProductVariant } from '@beacon/types'
import { GraphConnections } from '@/components/GraphConnections'
import {
  riskLevelFromRow,
  leadTimeLabel,
  leadTimeSourceLabel,
  daysUntilContractExpiry,
  hasContractExpiringSoon,
  onTimePctLabel,
  costVarianceLabel,
  stockUrgency,
} from '@beacon/reality-graph'

const LT_SOURCE_BADGE: Record<Supplier['lead_time_source'], string> = {
  po_history:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  delivery_history: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  manual:           'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface DeliveryEventRow {
  id:               string
  expected_date:    string
  actual_date:      string | null
  ordered_qty:      number
  received_qty:     number
  unit_cost_expected: number | null
  unit_cost_actual:   number | null
  notes:            string | null
}

interface VariantSuppliedRow extends ProductVariant {
  products: { name: string; categories: { name: string } | null } | null
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchSupplierById(supplierId: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .single() as unknown as { data: Supplier | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data
}

async function fetchContractsForSupplier(supplierId: string): Promise<SupplierContract[]> {
  const { data, error } = await supabase
    .from('supplier_contracts')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('contract_start', { ascending: false }) as unknown as {
      data: SupplierContract[] | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data ?? []
}

async function fetchDeliveriesForSupplier(supplierId: string, limit = 20): Promise<DeliveryEventRow[]> {
  const { data, error } = await supabase
    .from('delivery_events')
    .select('id, expected_date, actual_date, ordered_qty, received_qty, unit_cost_expected, unit_cost_actual, notes')
    .eq('supplier_id', supplierId)
    .order('expected_date', { ascending: false })
    .limit(limit) as unknown as { data: DeliveryEventRow[] | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data ?? []
}

async function fetchVariantsForSupplier(supplierId: string): Promise<VariantSuppliedRow[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*, products(name, categories(name))')
    .eq('default_supplier_id', supplierId)
    .eq('enabled', true) as unknown as { data: VariantSuppliedRow[] | null; error: { message: string } | null }
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

function RiskTierBadge({ tier }: { tier: 'low' | 'medium' | 'high' | 'critical' }) {
  const map: Record<string, string> = {
    low:      'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    medium:   'bg-amber-500/15   text-amber-500   border-amber-500/30',
    high:     'bg-red-500/15     text-red-500     border-red-500/30',
    critical: 'bg-red-500/25     text-red-400     border-red-500/50',
  }
  return (
    <span className={cn('rounded text-xs font-medium px-2 py-0.5 border uppercase', map[tier])}>
      {tier}
    </span>
  )
}

function ScoreGauge({ score, tier }: { score: number; tier: 'low' | 'medium' | 'high' | 'critical' }) {
  const colors: Record<string, string> = {
    low:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    medium:   'bg-amber-500/20   text-amber-400   border-amber-500/40',
    high:     'bg-red-500/20     text-red-400     border-red-500/40',
    critical: 'bg-red-600/25     text-red-300     border-red-600/50',
  }
  return (
    <div className={cn('flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded border-2', colors[tier])}>
      <span className="text-xl font-mono font-bold tabular-nums leading-none">{score.toFixed(1)}</span>
      <span className="text-xs opacity-70">/10</span>
    </div>
  )
}

function DeliveryRow({ delivery }: { delivery: DeliveryEventRow }) {
  const isLate = delivery.actual_date && delivery.expected_date &&
    new Date(delivery.actual_date) > new Date(delivery.expected_date)
  const isPending = !delivery.actual_date
  const fillRate  = delivery.ordered_qty > 0
    ? ((delivery.received_qty / delivery.ordered_qty) * 100).toFixed(0)
    : null

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div>
        <div className="flex items-center gap-2 text-sm">
          {isPending ? (
            <Clock className="h-3.5 w-3.5 text-blue-500/60" />
          ) : isLate ? (
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          )}
          <span>
            {isPending ? 'In transit' : isLate ? 'Late' : 'On time'}
          </span>
          {fillRate && <span className="text-muted-foreground text-xs">{fillRate}% fill rate</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Expected {format(new Date(delivery.expected_date), 'dd/MM/yyyy')}
          {delivery.actual_date && ` · received ${format(new Date(delivery.actual_date), 'dd/MM/yyyy')}`}
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <div>{delivery.ordered_qty} ordered / {delivery.received_qty} received</div>
        {delivery.unit_cost_actual != null && (
          <div>€{delivery.unit_cost_actual.toFixed(2)}/unit</div>
        )}
      </div>
    </div>
  )
}

function ContractRow({ contract }: { contract: SupplierContract }) {
  const isExpired = contract.contract_end && new Date(contract.contract_end) < new Date()
  const deviation = contract.price_deviation_pct

  return (
    <div className="flex items-start justify-between py-2 border-b border-border/50 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate">{contract.product_name} · {contract.variant_name}</span>
          <Link to={`/variant/${contract.variant_id}`} className="text-primary/70 hover:text-primary">
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <div className="text-xs text-muted-foreground font-mono">{contract.sku}</div>
        <div className="text-xs text-muted-foreground">
          €{contract.contracted_price.toFixed(2)}/unit
          {contract.min_order_qty && ` · min ${contract.min_order_qty}`}
          {isExpired ? (
            <span className="ml-2 text-red-500">Expired {contract.contract_end ? format(new Date(contract.contract_end), 'dd/MM/yyyy') : ''}</span>
          ) : contract.contract_end ? (
            <span className="ml-2">Expires {format(new Date(contract.contract_end), 'dd/MM/yyyy')}</span>
          ) : null}
        </div>
      </div>
      {deviation != null && (
        <div className={cn(
          'shrink-0 text-xs font-mono font-medium ml-3',
          deviation > 5 ? 'text-red-500' : deviation < -2 ? 'text-emerald-500' : 'text-muted-foreground',
        )}>
          {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupplierObjectPage() {
  const { supplierId } = useParams<{ supplierId: string }>()
  const navigate       = useNavigate()
  useActiveHotelId() // ensures hotel context is ready for RLS

  const { data: supplier, isLoading: loadingSupplier, error: supplierError } = useQuery({
    queryKey:  ['supplier-object', supplierId],
    queryFn:   () => fetchSupplierById(supplierId!),
    enabled:   !!supplierId,
    staleTime: 60_000,
  })

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey:  ['supplier-contracts', supplierId],
    queryFn:   () => fetchContractsForSupplier(supplierId!),
    enabled:   !!supplierId,
    staleTime: 120_000,
  })

  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey:  ['supplier-deliveries', supplierId],
    queryFn:   () => fetchDeliveriesForSupplier(supplierId!),
    enabled:   !!supplierId,
    staleTime: 60_000,
  })

  const { data: variantsSupplied = [] } = useQuery({
    queryKey:  ['supplier-variants', supplierId],
    queryFn:   () => fetchVariantsForSupplier(supplierId!),
    enabled:   !!supplierId,
    staleTime: 120_000,
  })

  // Cross-domain: Eye layer reliability — filter from cached data
  const { data: reliabilityRows = [] } = useSupplierReliability(90)
  const reliability = reliabilityRows.find((r) => r.supplier_id === supplierId) ?? null

  // ─── Loading / error ───────────────────────────────────────────────────────

  if (loadingSupplier) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading supplier…
      </div>
    )
  }

  if (supplierError || !supplier) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <XCircle className="h-8 w-8 text-red-500/60" />
        <p className="text-sm">Supplier not found or you don't have access.</p>
        <button type="button" onClick={() => { navigate(-1) }} className="text-xs text-primary hover:underline">← Go back</button>
      </div>
    )
  }

  // ─── Derived metrics ───────────────────────────────────────────────────────

  const activeContracts = contracts.filter((c) => c.is_active && (!c.contract_end || new Date(c.contract_end) >= new Date()))
  const expiredContracts = contracts.filter((c) => !c.is_active || (c.contract_end && new Date(c.contract_end) < new Date()))
  const pendingDeliveries = deliveries.filter((d) => !d.actual_date)
  const completedDeliveries = deliveries.filter((d) => !!d.actual_date)
  const lateDeliveries = completedDeliveries.filter((d) =>
    d.actual_date && new Date(d.actual_date) > new Date(d.expected_date)
  )

  const tier = reliability ? riskLevelFromRow(reliability) : 'medium'
  const score = reliability?.reliability_score ?? null

  const scoreAccent: 'green' | 'amber' | 'red' =
    tier === 'low' ? 'green' : tier === 'medium' ? 'amber' : 'red'

  const ltLabel = leadTimeLabel(supplier)
  const contractExpirySoon = hasContractExpiringSoon(activeContracts)
  const daysToExpiry = daysUntilContractExpiry(activeContracts)

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
        <span className="text-sm text-muted-foreground">Suppliers</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        <span className="text-sm font-medium text-foreground">{supplier.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">

          {/* ── Identity strip ── */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {score !== null && reliability && (
                <ScoreGauge score={score} tier={reliability.risk_tier} />
              )}
              <div>
                <h1 className="text-xl font-semibold">{supplier.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {supplier.contact_name && (
                    <span>{supplier.contact_name}</span>
                  )}
                  {supplier.email && (
                    <a href={`mailto:${supplier.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <Mail className="h-3 w-3" />
                      {supplier.email}
                    </a>
                  )}
                  {supplier.phone && (
                    <a href={`tel:${supplier.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <Phone className="h-3 w-3" />
                      {supplier.phone}
                    </a>
                  )}
                  {supplier.lead_time_days != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {ltLabel} lead time
                      <span className={cn(
                        'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
                        LT_SOURCE_BADGE[supplier.lead_time_source],
                      )}>
                        {leadTimeSourceLabel(supplier.lead_time_source)}
                      </span>
                    </span>
                  )}
                </div>
                {supplier.notes && (
                  <div className="mt-1 text-xs text-muted-foreground/70 italic">{supplier.notes}</div>
                )}
              </div>
            </div>
            {reliability && (
              <div className="flex items-center gap-2 shrink-0">
                <RiskTierBadge tier={reliability.risk_tier} />
              </div>
            )}
          </div>

          {/* ── 4 stat cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Reliability Score"
              value={score !== null ? score.toFixed(1) : '—'}
              sub={reliability ? `${reliability.total_orders} orders in 90d` : 'No delivery data'}
              accent={score !== null ? scoreAccent : 'muted'}
            />
            <StatCard
              label="On-Time %"
              value={reliability ? onTimePctLabel(reliability) : '—'}
              sub={reliability ? `${reliability.late_orders} late of ${reliability.total_orders}` : undefined}
              accent={
                reliability?.on_time_pct == null ? 'muted' :
                reliability.on_time_pct >= 85 ? 'green' :
                reliability.on_time_pct >= 65 ? 'amber' : 'red'
              }
            />
            <StatCard
              label="Avg Delay"
              value={reliability ? `${reliability.avg_delay_days.toFixed(1)}d` : '—'}
              sub={reliability ? `max ${reliability.max_delay_days}d` : undefined}
              accent={
                reliability?.avg_delay_days == null ? 'muted' :
                reliability.avg_delay_days <= 1 ? 'green' :
                reliability.avg_delay_days <= 3 ? 'amber' : 'red'
              }
            />
            <StatCard
              label="Cost Variance"
              value={reliability ? costVarianceLabel(reliability) : '—'}
              sub={reliability ? `€${reliability.total_value.toFixed(0)} total value` : 'No contracts'}
              accent={
                reliability?.avg_cost_variance_pct == null ? 'muted' :
                reliability.avg_cost_variance_pct > 5 ? 'red' :
                reliability.avg_cost_variance_pct > 2 ? 'amber' : 'green'
              }
            />
          </div>

          {/* ── Active contracts ── */}
          <div className="rounded border border-border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active Contracts ({activeContracts.length})
              </span>
              <Link to="/mind?panel=contracts" className="text-xs text-primary hover:underline">
                Manage →
              </Link>
            </div>
            {loadingContracts ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">Loading…</div>
            ) : activeContracts.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                No active contracts.
                {reliability?.risk_tier === 'critical' || reliability?.risk_tier === 'high'
                  ? ' Formalising contracts is recommended given reliability concerns.'
                  : ' Consider formalising pricing agreements.'}
              </div>
            ) : (
              <div className="px-3 divide-y-0">
                {activeContracts.map((c) => (
                  <ContractRow key={c.id} contract={c} />
                ))}
              </div>
            )}
            {contractExpirySoon && daysToExpiry !== null && (
              <div className="px-3 py-2 border-t border-amber-500/30 bg-amber-500/5 text-xs text-amber-500">
                Contract expires in {daysToExpiry}d — renew soon to avoid pricing gaps.
              </div>
            )}
            {expiredContracts.length > 0 && (
              <div className="px-3 py-2 border-t border-border text-xs text-amber-500/80">
                {expiredContracts.length} expired contract{expiredContracts.length > 1 ? 's' : ''} — review and renew.
              </div>
            )}
          </div>

          {/* ── Variants this supplier supplies ── */}
          {variantsSupplied.length > 0 && (
            <div className="rounded border border-border bg-card">
              <div className="px-3 py-2 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Variants Supplied ({variantsSupplied.length})
                </span>
              </div>
              <div className="px-3 divide-y divide-border/50">
                {variantsSupplied.map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Link
                          to={`/variant/${v.id}`}
                          className="font-medium hover:text-primary transition-colors hover:underline truncate"
                        >
                          {v.products?.name} · {v.name}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{v.sku}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        'text-xs font-mono',
                        stockUrgency(v) === 'critical' ? 'text-red-500' :
                        stockUrgency(v) === 'low'      ? 'text-amber-500' :
                        'text-emerald-500',
                      )}>
                        {v.current_stock} {v.unit_of_measure || 'units'}
                      </span>
                      <Link to={`/variant/${v.id}`} className="text-muted-foreground/60 hover:text-primary">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex flex-wrap gap-2">
            <Link
              to="/mind?panel=contracts"
              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <FileText className="h-4 w-4" />
              View Contracts
            </Link>
            <Link
              to="/mind?panel=procurement"
              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Package className="h-4 w-4" />
              Procurement
            </Link>
            <Link
              to="/mind?panel=suppliers"
              className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Star className="h-4 w-4" />
              Reliability Scorecard
            </Link>
            {(tier === 'critical' || tier === 'high') && (
              <Link
                to="/mind?panel=leverage"
                className="inline-flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <AlertTriangle className="h-4 w-4" />
                Negotiate Leverage
              </Link>
            )}
          </div>

          {/* ── Recent delivery history ── */}
          <div className="rounded border border-border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Delivery History — Last 20
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {pendingDeliveries.length > 0 && (
                  <span className="text-blue-500">{pendingDeliveries.length} in transit</span>
                )}
                {lateDeliveries.length > 0 && (
                  <span className="text-red-500">{lateDeliveries.length} late</span>
                )}
              </div>
            </div>
            {loadingDeliveries ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">Loading…</div>
            ) : deliveries.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                No delivery events recorded for this supplier.
                Delivery data is captured on the Flow · Deliveries tab when stock is received.
              </div>
            ) : (
              <div className="px-3 divide-y-0">
                {deliveries.map((d) => (
                  <DeliveryRow key={d.id} delivery={d} />
                ))}
              </div>
            )}
          </div>

          {reliability && (
            <div className="text-xs text-muted-foreground/50 pb-2">
              Reliability data based on last 90 days · last delivery{' '}
              {reliability.last_delivery_date
                ? formatDistanceToNow(new Date(reliability.last_delivery_date), { addSuffix: true })
                : 'unknown'}
            </div>
          )}

          {/* ── Graph connections ── */}
          <div className="rounded-lg border border-border bg-card p-4">
            <GraphConnections nodeType="supplier" nodeId={supplierId!} />
          </div>

        </div>
      </div>
    </div>
  )
}

// Layer: Cross-domain — Supplier Object Page
// Palantir-pattern: every named entity is navigable to its full object context.
// Combines Mind (contracts, POs), Eye (reliability, price history), Flow (deliveries).
// Route: /supplier/:supplierId
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

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
import { useSupplierReliability } from '@/features/eye/hooks'
import { fetchOpenCasesForSupplier } from '@/features/cases/api'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { cn } from '@/lib/utils'
import type { Supplier, SupplierContract, ProductVariant } from '@beacon/types'
import { ObjectAgentActivity } from '@/features/agents/ObjectAgentActivity'
import { ObjectViewFrame } from '@/components/ObjectViewFrame'
import { ReferencedInDocuments } from '@/components/ReferencedInDocuments'
import { OBJECT_PRESENTATION, GLOSSARY } from '@/lib/objectPresentation'
import { Metric } from '@/components/MetricStrip'
import { AuditRail } from '@/components/AuditRail'
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

function RiskTierBadge({ tier }: { tier: 'low' | 'medium' | 'high' | 'critical' }) {
  const intentMap: Record<typeof tier, Intent> = {
    low:      Intent.SUCCESS,
    medium:   Intent.WARNING,
    high:     Intent.DANGER,
    critical: Intent.DANGER,
  }
  return (
    <Tag intent={intentMap[tier]} minimal className="uppercase">
      {tier}
    </Tag>
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
            <Icon icon="time" size={14} className="text-blue-500/60" />
          ) : isLate ? (
            <Icon icon="trending-down" size={14} className="text-red-500" />
          ) : (
            <Icon icon="tick-circle" size={14} className="text-emerald-500" />
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
            <Icon icon="share" size={12} />
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
  const { supplierId = '' } = useParams<{ supplierId: string }>()
  const navigate       = useNavigate()
  const hotelId        = useActiveHotelId() // also scopes the open-cases lookup

  const { data: openCases = [] } = useQuery({
    queryKey:  ['supplier-open-cases', hotelId, supplierId],
    queryFn:   () => fetchOpenCasesForSupplier(hotelId ?? '', supplierId),
    enabled:   !!hotelId && !!supplierId,
    staleTime: 30_000,
  })

  const { data: supplier, isLoading: loadingSupplier, error: supplierError } = useQuery({
    queryKey:  ['supplier-object', supplierId],
    queryFn:   () => fetchSupplierById(supplierId),
    enabled:   !!supplierId,
    staleTime: 60_000,
  })

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey:  ['supplier-contracts', supplierId],
    queryFn:   () => fetchContractsForSupplier(supplierId),
    enabled:   !!supplierId,
    staleTime: 120_000,
  })

  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey:  ['supplier-deliveries', supplierId],
    queryFn:   () => fetchDeliveriesForSupplier(supplierId),
    enabled:   !!supplierId,
    staleTime: 60_000,
  })

  const { data: variantsSupplied = [] } = useQuery({
    queryKey:  ['supplier-variants', supplierId],
    queryFn:   () => fetchVariantsForSupplier(supplierId),
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
      <NonIdealState
        icon="cross-circle"
        title="Supplier not found"
        description="Supplier not found or you don&apos;t have access."
        action={
          <Button variant="minimal" intent={Intent.PRIMARY} onClick={() => { void navigate(-1) }}>
            ← Go back
          </Button>
        }
      />
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
    <ObjectViewFrame
      header={{
        breadcrumb: OBJECT_PRESENTATION.supplier.home,
        icon: OBJECT_PRESENTATION.supplier.icon,
        title: supplier.name,
        star: { id: `supplier:${supplierId}`, label: supplier.name, path: `/supplier/${supplierId}`, icon: 'shop' },
        tags: reliability ? <RiskTierBadge tier={reliability.risk_tier} /> : undefined,
        id: supplier.id,
      }}
      metrics={
        <>
        <Metric
          info={GLOSSARY.reliability} label="Reliability Score"
          value={score !== null ? score.toFixed(1) : '—'}
          sub={reliability ? `${reliability.total_orders} orders in 90d` : 'No delivery data'}
          accent={score !== null ? scoreAccent : 'muted'}
        />
        <Metric
          info={GLOSSARY.on_time_pct} label="On-Time %"
          value={reliability ? onTimePctLabel(reliability) : '—'}
          sub={reliability ? `${reliability.late_orders} late of ${reliability.total_orders}` : undefined}
          accent={reliability?.on_time_pct == null ? 'muted' : reliability.on_time_pct >= 85 ? 'green' : reliability.on_time_pct >= 65 ? 'amber' : 'red'}
        />
        <Metric
          info={GLOSSARY.avg_delay} label="Avg Delay"
          value={reliability ? `${reliability.avg_delay_days.toFixed(1)}d` : '—'}
          sub={reliability ? `max ${reliability.max_delay_days}d` : undefined}
          accent={reliability?.avg_delay_days == null ? 'muted' : reliability.avg_delay_days <= 1 ? 'green' : reliability.avg_delay_days <= 3 ? 'amber' : 'red'}
        />
        <Metric
          info={GLOSSARY.cost_variance} label="Cost Variance"
          value={reliability ? costVarianceLabel(reliability) : '—'}
          sub={reliability ? `€${reliability.total_value.toFixed(0)} total value` : 'No contracts'}
          accent={reliability?.avg_cost_variance_pct == null ? 'muted' : reliability.avg_cost_variance_pct > 5 ? 'red' : reliability.avg_cost_variance_pct > 2 ? 'amber' : 'green'}
        />
        </>
      }
      actions={
        <>
          <AnchorButton href="/mind?panel=contracts" icon="document" variant="minimal" size="small">View Contracts</AnchorButton>
          <AnchorButton href="/mind?panel=procurement" icon="box" variant="minimal" size="small">Procurement</AnchorButton>
          <AnchorButton href="/mind?panel=suppliers" icon="star" variant="minimal" size="small">Reliability Scorecard</AnchorButton>
          {(tier === 'critical' || tier === 'high') && (
            <AnchorButton href="/mind?panel=leverage" icon="warning-sign" intent={Intent.DANGER} variant="minimal" size="small">Negotiate Leverage</AnchorButton>
          )}
        </>
      }
      rail={<AuditRail nodeType="supplier" nodeId={supplierId} />}
    >

          {(supplier.contact_name || supplier.email || supplier.phone || supplier.lead_time_days != null) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {supplier.contact_name && <span className="flex items-center gap-1"><Icon icon="person" size={12} />{supplier.contact_name}</span>}
              {supplier.email && <a href={`mailto:${supplier.email}`} className="flex items-center gap-1 hover:text-foreground"><Icon icon="envelope" size={12} />{supplier.email}</a>}
              {supplier.phone && <a href={`tel:${supplier.phone}`} className="flex items-center gap-1 hover:text-foreground"><Icon icon="phone" size={12} />{supplier.phone}</a>}
              {supplier.lead_time_days != null && <span className="flex items-center gap-1"><Icon icon="time" size={12} />{ltLabel} lead · {leadTimeSourceLabel(supplier.lead_time_source)}</span>}
            </div>
          )}
          {supplier.notes && (
            <p className="text-xs text-muted-foreground/70 italic">{supplier.notes}</p>
          )}

          {/* ── Active contracts ── */}
          <Card compact className="!p-0">
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
              <div className="px-3">
                {activeContracts.map((c) => (
                  <ContractRow key={c.id} contract={c} />
                ))}
              </div>
            )}
            {contractExpirySoon && daysToExpiry !== null && (
              <Callout intent={Intent.WARNING} icon="time" compact className="!border-t !rounded-none">
                Contract expires in {daysToExpiry}d — renew soon to avoid pricing gaps.
              </Callout>
            )}
            {expiredContracts.length > 0 && (
              <div className="px-3 py-2 border-t border-border text-xs text-amber-500/80">
                {expiredContracts.length} expired contract{expiredContracts.length > 1 ? 's' : ''} — review and renew.
              </div>
            )}
          </Card>

          {/* ── Documents referencing this supplier (ingestion lineage) ── */}
          <ReferencedInDocuments nodeType="supplier" nodeId={supplierId} />

          {/* ── Open cases on this supplier (supplier-monitor effect) ── */}
          {openCases.length > 0 && (
            <Card compact className="!p-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Open Cases ({openCases.length})
                </span>
                <Link to="/mind?aip=cases" className="text-xs text-primary hover:underline">All cases →</Link>
              </div>
              <div className="divide-y divide-border/50">
                {openCases.map((c) => (
                  <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-2 transition-colors">
                    <span className="truncate">{c.title}</span>
                    <Tag minimal intent={c.status === 'in_review' ? Intent.WARNING : Intent.PRIMARY} className="!text-[10px] shrink-0 ml-2">{c.status}</Tag>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* ── Agent decisions across this supplier's items ── */}
          <ObjectAgentActivity
            variantIds={variantsSupplied.map((v) => v.id)}
            title="Agent decisions · supplier's items"
            emptyHint="No agent decisions on this supplier's items yet. Restock and waste proposals for the variants it supplies surface here."
          />

          {/* ── Variants this supplier supplies ── */}
          {variantsSupplied.length > 0 && (
            <Card compact className="!p-0">
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
                        <Icon icon="share" size={14} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Recent delivery history ── */}
          <Card compact className="!p-0">
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
              <div className="px-3">
                {deliveries.map((d) => (
                  <DeliveryRow key={d.id} delivery={d} />
                ))}
              </div>
            )}
          </Card>

          {reliability && (
            <div className="text-xs text-muted-foreground/50 pb-2">
              Reliability data based on last 90 days · last delivery{' '}
              {reliability.last_delivery_date
                ? formatDistanceToNow(new Date(reliability.last_delivery_date), { addSuffix: true })
                : 'unknown'}
            </div>
          )}

    </ObjectViewFrame>
  )
}

// Layer: Eye — Cross-Domain Incident Correlation Engine (Sprint 13)
// Synthesises waste, team, supply, occupancy, and stock signals into fused incident cards.
// Palantir Principle 6: cross-domain synthesis — one incident, not three widgets.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Callout,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useActiveIncidents } from '@/features/eye/hooks'
import { useHotelEdges } from '@/hooks/useHotelEdges'
import type { ActiveIncidentRow } from '@beacon/types'

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY = {
  critical: { label: 'CRITICAL', class: 'bg-red-500/15 text-red-400 border-red-500/30',   dot: 'bg-red-500',   border: 'border-l-red-500' },
  elevated: { label: 'ELEVATED', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-500', border: 'border-l-amber-500' },
  watch:    { label: 'WATCH',    class: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-500',  border: 'border-l-blue-500'  },
} as const

const SIGNAL_LABEL: Record<ActiveIncidentRow['primary_signal_type'], string> = {
  waste_spike:         'Waste Spike',
  stockout:            'Stockout',
  below_par_sustained: 'Below PAR',
  supply_gap:          'Supply Gap',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CorrelationPill({ active, icon, label }: { active: boolean; icon: IconName; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border',
      active
        ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
        : 'bg-muted/30 text-muted-foreground border-transparent opacity-40'
    )}>
      <Icon icon={icon} size={12} />
      {label}
    </span>
  )
}

function CorrelationCount({ count }: { count: number }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold',
      count >= 3 ? 'bg-red-500 text-white' : count >= 2 ? 'bg-amber-500 text-black' : 'bg-muted text-muted-foreground'
    )}>
      {count}
    </span>
  )
}

function MetricBlock({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn('p-3 rounded-lg border bg-card', highlight && 'border-red-500/30 bg-red-500/5')}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-lg font-mono font-semibold', highlight ? 'text-red-400' : 'text-foreground')}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

function IncidentCard({ incident, substituteCount }: { incident: ActiveIncidentRow; substituteCount: number }) {
  const [expanded, setExpanded] = useState(false)
  const sev = SEVERITY[incident.incident_severity]

  return (
    <div className={cn('border-l-4 rounded-r-lg bg-card border border-l-[4px] border-border overflow-hidden', sev.border)}>
      {/* Header row */}
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors"
        onClick={() => { setExpanded(!expanded); }}
      >
        {/* Expand icon */}
        <span className="mt-1 text-muted-foreground shrink-0">
          <Icon icon={expanded ? 'chevron-down' : 'chevron-right'} size={14} />
        </span>

        {/* Severity + variant */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={cn('px-2 py-0.5 rounded text-xs font-bold border', sev.class)}>
              {sev.label}
            </span>
            {incident.variant_id ? (
              <Link
                to={`/variant/${incident.variant_id}`}
                onClick={(e) => { e.stopPropagation() }}
                className="font-semibold text-sm truncate hover:text-primary hover:underline transition-colors"
              >
                {incident.variant_label}
              </Link>
            ) : (
              <span className="font-semibold text-sm truncate">{incident.variant_label}</span>
            )}
            {incident.category_name && (
              <span className="text-xs text-muted-foreground">— {incident.category_name}</span>
            )}
            <span className={cn('px-2 py-0.5 rounded text-xs border', 'bg-muted/30 text-muted-foreground border-transparent')}>
              {SIGNAL_LABEL[incident.primary_signal_type]}
            </span>
          </div>

          {/* Primary signal sentence */}
          <p className="text-sm text-muted-foreground mb-2 leading-snug">
            {incident.primary_signal}
          </p>

          {/* Correlation pills */}
          <div className="flex flex-wrap items-center gap-2">
            <CorrelationCount count={incident.correlation_count} />
            <span className="text-xs text-muted-foreground">correlated signals</span>
            <CorrelationPill active={!!incident.waste_spike_pct && incident.waste_spike_pct > 0} icon="trending-up" label="Waste" />
            <CorrelationPill active={incident.team_correlated}   icon="people"     label="Team"   />
            <CorrelationPill active={incident.supply_correlated} icon="truck"      label="Supply" />
            <CorrelationPill active={incident.occupancy_explains} icon="pulse"     label="Occupancy" />
            <CorrelationPill active={incident.stockout_days > 0} icon="box"        label="Stock"  />
          </div>
        </div>

        {/* Stock quick-read */}
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Stock</div>
          <div className={cn('text-sm font-mono font-semibold', incident.current_stock <= 0 ? 'text-red-400' : incident.current_stock < incident.par_level ? 'text-amber-400' : 'text-foreground')}>
            {incident.current_stock} / {incident.par_level} PAR
          </div>
          {incident.stockout_days > 0 && (
            <div className="text-xs text-red-400">{incident.stockout_days}d stockout</div>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/10">
          {/* Fused narrative + explain link */}
          <div className="mb-4 p-3 rounded-lg bg-background border border-border">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Icon icon="shield" size={12} /> Incident Intelligence
              </div>
              <Link
                to={`/flow?panel=causal&root_type=variant&root_id=${incident.variant_id}`}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                <Icon icon="git-branch" size={12} />
                Explain →
              </Link>
            </div>
            <p className="text-sm leading-relaxed">{incident.narrative}</p>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <MetricBlock
              label="Waste (7d)"
              value={`${incident.waste_units_7d.toFixed(1)} units`}
              sub={incident.waste_spike_pct != null ? `${incident.waste_spike_pct > 0 ? '+' : ''}${incident.waste_spike_pct.toFixed(0)}% vs baseline` : 'No baseline'}
              highlight={!!incident.waste_spike_pct && incident.waste_spike_pct > 50}
            />
            <MetricBlock
              label="Stockout Days"
              value={`${String(incident.stockout_days)}d`}
              sub={`${String(incident.below_par_days)}d below PAR`}
              highlight={incident.stockout_days > 0}
            />
            <MetricBlock
              label="Waste Rate"
              value={incident.waste_rate_pct != null ? `${incident.waste_rate_pct.toFixed(1)}%` : '—'}
              sub="of total consumption"
              highlight={!!incident.waste_rate_pct && incident.waste_rate_pct > 20}
            />
            <MetricBlock
              label="Occupancy 7d"
              value={incident.occupancy_7d_avg != null ? `${incident.occupancy_7d_avg.toFixed(0)}%` : 'No data'}
              sub={incident.occupancy_explains ? 'Explains demand' : incident.occupancy_contradicts ? 'Contradicts waste' : 'Neutral'}
            />
          </div>

          {/* Team + Supply threads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Team signal */}
            <div className={cn('p-3 rounded-lg border text-sm', incident.team_correlated ? 'border-violet-500/30 bg-violet-500/5' : 'border-border bg-card opacity-60')}>
              <div className="flex items-center gap-1.5 mb-1 text-xs font-medium text-muted-foreground">
                <Icon icon="people" size={12} />
                Team Signal
              </div>
              {incident.team_correlated && incident.top_actor_email ? (
                <div>
                  <span className="font-medium">{incident.top_actor_email.split('@')[0]}</span>
                  <span className="text-muted-foreground ml-1">handled {incident.top_actor_share_pct.toFixed(0)}% of activity</span>
                </div>
              ) : (
                <span className="text-muted-foreground">No dominant actor</span>
              )}
            </div>

            {/* Supply signal */}
            <div className={cn('p-3 rounded-lg border text-sm', incident.supply_correlated ? 'border-orange-500/30 bg-orange-500/5' : 'border-border bg-card opacity-60')}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Icon icon="truck" size={12} />
                  Supply Signal
                </div>
                {substituteCount > 0 && (
                  <Link
                    to={`/variant/${incident.variant_id}`}
                    onClick={(e) => { e.stopPropagation() }}
                    className="inline-flex items-center gap-1 rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400 hover:bg-violet-500/20 transition-colors"
                  >
                    <Icon icon="swap-horizontal" size={10} />
                    {substituteCount} substitute{substituteCount !== 1 ? 's' : ''}
                  </Link>
                )}
              </div>
              {incident.days_since_last_receive != null ? (
                <div>
                  <span className="font-medium">{incident.days_since_last_receive}d</span>
                  <span className="text-muted-foreground ml-1">since last receive</span>
                  {incident.supplier_name && <span className="text-muted-foreground"> · {incident.supplier_name}</span>}
                  {incident.open_po_overdue && <span className="ml-2 text-red-400 font-medium">PO overdue</span>}
                  {incident.has_open_po && !incident.open_po_overdue && <span className="ml-2 text-emerald-400">PO open</span>}
                </div>
              ) : (
                <span className="text-muted-foreground">No recent supply activity</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ incidents }: { incidents: ActiveIncidentRow[] }) {
  const critical = incidents.filter(i => i.incident_severity === 'critical').length
  const elevated = incidents.filter(i => i.incident_severity === 'elevated').length
  const multiCorr = incidents.filter(i => i.correlation_count >= 2).length
  const teamLinked = incidents.filter(i => i.team_correlated).length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {[
        { label: 'Critical Incidents', value: critical, sub: 'immediate action', highlight: critical > 0 },
        { label: 'Elevated',           value: elevated, sub: 'monitor closely',  highlight: false },
        { label: 'Multi-Domain',       value: multiCorr, sub: '≥2 correlated signals', highlight: false },
        { label: 'Team-Linked',        value: teamLinked, sub: 'dominant actor identified', highlight: false },
      ].map(({ label, value, sub, highlight }) => (
        <div key={label} className={cn('p-3 rounded-lg border bg-card', highlight && value > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-border')}>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={cn('text-2xl font-mono font-bold', highlight && value > 0 ? 'text-red-400' : 'text-foreground')}>{value}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SeverityFilter = 'all' | 'critical' | 'elevated' | 'watch'
type DomainFilter   = 'all' | 'team' | 'supply' | 'occupancy'

export default function IncidentCorrelationPage() {
  const [windowDays, setWindowDays] = useState(7)
  const [sevFilter,  setSevFilter]  = useState<SeverityFilter>('all')
  const [domFilter,  setDomFilter]  = useState<DomainFilter>('all')

  const { data: incidents  = [], isLoading, error } = useActiveIncidents(windowDays)
  const { data: hotelEdges = [] } = useHotelEdges()

  // Bidirectional similar_to count per variant
  const similarCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of hotelEdges) {
      if (e.edge_type !== 'similar_to') continue
      map.set(e.source_id, (map.get(e.source_id) ?? 0) + 1)
      map.set(e.target_id, (map.get(e.target_id) ?? 0) + 1)
    }
    return map
  }, [hotelEdges])

  const filtered = incidents.filter(i => {
    if (sevFilter !== 'all' && i.incident_severity !== sevFilter) return false
    if (domFilter === 'team'      && !i.team_correlated)   return false
    if (domFilter === 'supply'    && !i.supply_correlated)  return false
    if (domFilter === 'occupancy' && !i.occupancy_explains && !i.occupancy_contradicts) return false
    return true
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Icon icon="warning-sign" size={14} intent={Intent.WARNING} />
              Incident Correlation Engine
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cross-domain signals fused per variant — waste · team · supply · occupancy · stock
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Window:</span>
            <SegmentedControl
              size="small"
              value={String(windowDays)}
              onValueChange={(v) => { setWindowDays(Number(v)) }}
              options={[
                { value: '3',  label: '3d'  },
                { value: '7',  label: '7d'  },
                { value: '14', label: '14d' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-border shrink-0 flex flex-wrap items-center gap-3">
        {/* Severity filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Severity:</span>
          <SegmentedControl
            size="small"
            value={sevFilter}
            onValueChange={(v) => { setSevFilter(v as SeverityFilter) }}
            options={[
              { value: 'all',      label: 'All'      },
              { value: 'critical', label: 'Critical' },
              { value: 'elevated', label: 'Elevated' },
              { value: 'watch',    label: 'Watch'    },
            ]}
          />
        </div>

        <div className="h-5 border-l border-border" />

        {/* Domain filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Domain:</span>
          <SegmentedControl
            size="small"
            value={domFilter}
            onValueChange={(v) => { setDomFilter(v as DomainFilter) }}
            options={[
              { value: 'all',       label: 'All'       },
              { value: 'team',      label: 'Team'      },
              { value: 'supply',    label: 'Supply'    },
              { value: 'occupancy', label: 'Occupancy' },
            ]}
          />
        </div>

        <div className="ml-auto text-xs text-muted-foreground self-center">
          {filtered.length} of {incidents.length} incidents
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
            Scanning all domains for correlated signals…
          </div>
        )}

        {error && (
          <Callout intent={Intent.DANGER} icon="error">
            {error instanceof Error ? error.message : 'Failed to load incidents'}
          </Callout>
        )}

        {!isLoading && !error && (
          <>
            <SummaryStrip incidents={incidents} />

            {filtered.length === 0 ? (
              <NonIdealState
                icon="shield"
                title="No active incidents"
                description={`Scanned ${String(windowDays)}-day window across waste, team activity, supply chain, occupancy, and stock levels. ${incidents.length === 0 ? 'No anomalous correlations detected.' : 'No incidents match the current filters.'}`}
              />
            ) : (
              <div className="space-y-3">
                {filtered.map(incident => (
                  <IncidentCard
                    key={incident.variant_id}
                    incident={incident}
                    substituteCount={similarCount.get(incident.variant_id) ?? 0}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

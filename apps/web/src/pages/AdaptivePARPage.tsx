// Layer: Eye → Mind cross-layer
// Palantir principle: intelligence everywhere — every threshold carries its basis.
//
// AdaptivePARPage computes the statistically optimal PAR level for every variant
// using the full probabilistic model:
//   PAR = ceil(adj_μ × L + z × σ_dL)
// where
//   adj_μ  = mean_daily × occupancy_adj_factor   (real demand, forecast-adjusted)
//   L      = actual supplier lead time from PO history, or stated, or hotel median
//   z      = _normal_quantile(service_level)      — no hardcoding
//   σ_dL   = √(L×σ_d² + adj_μ²×σ_L²)            — combined demand + lead-time uncertainty
//
// Operators select their target service level, review the ranked recommendations,
// and apply individual or batch PAR changes with one click.

import { useState, useMemo, useCallback } from 'react'
import {
  SlidersHorizontal, Check, CheckCheck, X, TrendingUp, TrendingDown,
  Minus, Info, Package2, Loader2, AlertTriangle, Truck,
  ChevronDown, ChevronUp, Thermometer, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOptimalPAR } from '@/features/eye/hooks'
import { useUpdateVariant } from '@/features/inventory/hooks'
import type { OptimalPARRow } from '@beacon/types'

// ─── Service-level selector ────────────────────────────────────────────────────

const SERVICE_LEVELS = [
  { value: 0.90, label: '90%', description: '~36d/yr out of stock risk' },
  { value: 0.95, label: '95%', description: '~18d/yr out of stock risk' },
  { value: 0.99, label: '99%', description: '~4d/yr out of stock risk'  },
] as const

// ─── Filter tabs ───────────────────────────────────────────────────────────────

type FilterId = 'all' | 'increase' | 'decrease' | 'calibrated' | 'no_data'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all',        label: 'All'        },
  { id: 'increase',   label: 'Increase'   },
  { id: 'decrease',   label: 'Decrease'   },
  { id: 'calibrated', label: 'Calibrated' },
  { id: 'no_data',    label: 'No data'    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function changeIcon(type: OptimalPARRow['change_type']) {
  if (type === 'increase') return TrendingUp
  if (type === 'decrease') return TrendingDown
  return Minus
}

function changeColor(type: OptimalPARRow['change_type']): string {
  if (type === 'increase')   return 'text-red-600 dark:text-red-400'
  if (type === 'decrease')   return 'text-blue-600 dark:text-blue-400'
  if (type === 'calibrated') return 'text-green-600 dark:text-green-400'
  return 'text-muted-foreground'
}

function slColor(sl: number | null): string {
  if (sl === null)  return 'text-muted-foreground'
  if (sl >= 0.95)   return 'text-green-600 dark:text-green-400'
  if (sl >= 0.85)   return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function ltSourceBadge(src: OptimalPARRow['lead_time_source']) {
  const styles: Record<typeof src, string> = {
    po_history:       'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
    supplier_stated:  'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    hotel_median:     'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    unknown:          'bg-muted text-muted-foreground',
  }
  const labels: Record<typeof src, string> = {
    po_history:      'From POs',
    supplier_stated: 'Stated',
    hotel_median:    'Median',
    unknown:         'Unknown',
  }
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', styles[src])}>
      {labels[src]}
    </span>
  )
}

function ConfidenceDot({ score }: { score: number }) {
  return (
    <span className={cn(
      'inline-block h-2 w-2 rounded-full shrink-0',
      score >= 0.75 ? 'bg-green-500' :
      score >= 0.50 ? 'bg-amber-400' : 'bg-red-400',
    )} title={`Confidence: ${Math.round(score * 100)}%`} />
  )
}

// ─── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({
  rows,
  selected,
  onApplyAll,
  applying,
}: {
  rows:       OptimalPARRow[]
  selected:   Set<string>
  onApplyAll: () => void
  applying:   boolean
}) {
  const increases   = rows.filter((r) => r.change_type === 'increase').length
  const decreases   = rows.filter((r) => r.change_type === 'decrease').length
  const calibrated  = rows.filter((r) => r.change_type === 'calibrated').length
  const noData      = rows.filter((r) => r.change_type === 'no_data' || r.change_type === 'no_lead_time').length

  return (
    <div className="flex items-center gap-5 px-5 py-2.5 border-b bg-muted/30 text-xs shrink-0 flex-wrap">
      {increases > 0 && (
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-red-500" />
          <span className="font-semibold text-red-600">{increases}</span>
          <span className="text-muted-foreground">need increase</span>
        </div>
      )}
      {decreases > 0 && (
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-semibold text-blue-600">{decreases}</span>
          <span className="text-muted-foreground">can reduce</span>
        </div>
      )}
      {calibrated > 0 && (
        <div className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-green-500" />
          <span className="font-semibold text-green-600">{calibrated}</span>
          <span className="text-muted-foreground">calibrated</span>
        </div>
      )}
      {noData > 0 && (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold text-muted-foreground">{noData}</span>
          <span className="text-muted-foreground">insufficient data</span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        {selected.size > 0 && (
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onApplyAll}
            disabled={applying}
          >
            {applying
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <CheckCheck className="h-3 w-3" />
            }
            Apply {selected.size} change{selected.size > 1 ? 's' : ''}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── PAR row ──────────────────────────────────────────────────────────────────

function PARRow({
  row,
  checked,
  onToggle,
}: {
  row:      OptimalPARRow
  checked:  boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const ChangeIcon = changeIcon(row.change_type)
  const isActionable = row.change_type === 'increase' || row.change_type === 'decrease'
  const hasNoData = row.change_type === 'no_data' || row.change_type === 'no_lead_time'

  return (
    <div className={cn(
      'border-b border-border/50 last:border-0',
      checked && 'bg-primary/3',
      row.change_type === 'increase' && 'bg-red-50/10 dark:bg-red-950/5',
    )}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-5 py-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => { if (isActionable) onToggle() }}
          disabled={!isActionable}
          className={cn(
            'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
            isActionable
              ? checked
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-border hover:border-primary'
              : 'border-border/30 cursor-not-allowed opacity-40',
          )}
        >
          {checked && <Check className="h-2.5 w-2.5" />}
        </button>

        {/* Product */}
        <div className="w-44 shrink-0 min-w-0">
          <p className="text-sm font-semibold truncate">{row.product_name}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{row.sku}</p>
        </div>

        {/* Current PAR → Recommended PAR */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-center w-14">
            <p className="text-[10px] text-muted-foreground mb-0.5">Current</p>
            <span className="text-sm font-bold tabular-nums">{row.current_par}</span>
          </div>
          <ChangeIcon className={cn('h-4 w-4 shrink-0', changeColor(row.change_type))} />
          <div className="text-center w-14">
            <p className="text-[10px] text-muted-foreground mb-0.5">Optimal</p>
            <span className={cn(
              'text-sm font-bold tabular-nums',
              hasNoData ? 'text-muted-foreground' : changeColor(row.change_type),
            )}>
              {hasNoData ? '—' : row.recommended_par}
            </span>
          </div>
          {!hasNoData && (
            <span className={cn(
              'text-xs font-semibold tabular-nums w-12 text-right',
              changeColor(row.change_type),
            )}>
              {row.par_delta > 0 ? '+' : ''}{row.par_delta}
            </span>
          )}
        </div>

        {/* Service level at current PAR */}
        <div className="text-center w-24 shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">SL today</p>
          {row.service_level_at_current_par !== null ? (
            <>
              <span className={cn('text-sm font-bold tabular-nums', slColor(row.service_level_at_current_par))}>
                {Math.round(row.service_level_at_current_par * 100)}%
              </span>
              <div className="mt-0.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    row.service_level_at_current_par >= 0.95 ? 'bg-green-500' :
                    row.service_level_at_current_par >= 0.85 ? 'bg-amber-500' : 'bg-red-500',
                  )}
                  style={{ width: `${Math.round(row.service_level_at_current_par * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        {/* Expected stockouts/year */}
        <div className="text-center w-24 shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Stockouts/yr</p>
          {row.expected_stockouts_per_year !== null ? (
            <span className={cn(
              'text-sm font-bold tabular-nums',
              row.expected_stockouts_per_year > 5 ? 'text-red-600 dark:text-red-400' :
              row.expected_stockouts_per_year > 1 ? 'text-amber-600 dark:text-amber-400' :
              'text-green-600 dark:text-green-400',
            )}>
              {row.expected_stockouts_per_year.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        {/* Lead time source badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {row.supplier_name && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {row.lead_time_days !== null ? `${Math.round(row.lead_time_days)}d` : '?'}
            </span>
          )}
          {ltSourceBadge(row.lead_time_source)}
          {row.occupancy_adj_factor !== 1.0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 flex items-center gap-1">
              <Thermometer className="h-2.5 w-2.5" />
              ×{row.occupancy_adj_factor.toFixed(2)}
            </span>
          )}
        </div>

        {/* Confidence + expand */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <ConfidenceDot score={row.confidence_score} />
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {Math.round(row.confidence_score * 100)}%
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setExpanded((e) => !e) }}
            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {expanded
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Expanded: full rationale + safety stock breakdown */}
      {expanded && (
        <div className="px-5 pb-4 pl-12 border-t border-border/30 bg-muted/10">
          <div className="pt-3 grid grid-cols-3 gap-6 text-xs">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Demand model
              </p>
              <p>
                <span className="text-muted-foreground">Mean (30d): </span>
                <span className="font-medium">{row.mean_daily_30d.toFixed(2)}/day</span>
              </p>
              <p>
                <span className="text-muted-foreground">Stddev: </span>
                <span className="font-medium">±{row.stddev_daily.toFixed(2)}/day</span>
              </p>
              {row.occupancy_adj_factor !== 1.0 && (
                <p>
                  <span className="text-muted-foreground">Adj. mean: </span>
                  <span className="font-semibold text-violet-600 dark:text-violet-400">
                    {row.adj_mean_daily.toFixed(2)}/day
                  </span>
                  <span className="text-muted-foreground ml-1">
                    (r={row.occupancy_correlation?.toFixed(2)} occ corr)
                  </span>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Pattern: </span>
                <span className="font-medium">{row.demand_pattern}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Data days: </span>
                <span className={cn('font-medium', row.data_days < 7 ? 'text-amber-600' : '')}>
                  {row.data_days} / 30
                </span>
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Lead time
              </p>
              <p>
                <span className="text-muted-foreground">Supplier: </span>
                <span className="font-medium">{row.supplier_name ?? 'None assigned'}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Lead time L: </span>
                <span className="font-medium">
                  {row.lead_time_days !== null ? `${row.lead_time_days.toFixed(1)}d` : 'Unknown'}
                </span>
                <span className="text-muted-foreground ml-1">
                  [{row.lead_time_source.replace('_', ' ')}]
                </span>
              </p>
              {row.lead_time_stddev > 0 && (
                <p>
                  <span className="text-muted-foreground">LT σ: </span>
                  <span className="font-medium">±{row.lead_time_stddev.toFixed(1)}d</span>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">σ_dL: </span>
                <span className="font-medium">{row.sigma_demand_lt.toFixed(2)}</span>
                <span className="text-muted-foreground ml-1">(combined uncertainty)</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                PAR breakdown
              </p>
              {row.lead_time_days !== null && (
                <>
                  <p>
                    <span className="text-muted-foreground">Demand cover: </span>
                    <span className="font-medium">
                      {(row.adj_mean_daily * row.lead_time_days).toFixed(1)} units
                    </span>
                    <span className="text-muted-foreground ml-1">(μ × L)</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Safety stock: </span>
                    <span className="font-semibold text-primary">
                      {row.safety_stock.toFixed(1)} units
                    </span>
                    <span className="text-muted-foreground ml-1">(z × σ_dL)</span>
                  </p>
                </>
              )}
              <p>
                <span className="text-muted-foreground">Recommended PAR: </span>
                <span className="font-bold">{row.recommended_par}</span>
              </p>
            </div>
          </div>

          {/* Rationale */}
          <div className="mt-3 flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded px-2.5 py-2">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="font-mono leading-relaxed">{row.rationale}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdaptivePARPage() {
  const [serviceLevel, setServiceLevel] = useState(0.95)
  const [filter, setFilter]             = useState<FilterId>('all')
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [applying, setApplying]         = useState(false)

  const { data: rows = [], isLoading, dataUpdatedAt } = useOptimalPAR(serviceLevel)
  const updateVariant = useUpdateVariant()

  // Reset selection when data or service level changes
  const handleServiceLevelChange = useCallback((sl: number) => {
    setServiceLevel(sl)
    setSelected(new Set())
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'no_data') return rows.filter(
      (r) => r.change_type === 'no_data' || r.change_type === 'no_lead_time',
    )
    return rows.filter((r) => r.change_type === filter)
  }, [rows, filter])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleApplySelected = useCallback(async () => {
    const toApply = rows.filter(
      (r) => selected.has(r.variant_id) &&
             (r.change_type === 'increase' || r.change_type === 'decrease'),
    )
    if (toApply.length === 0) return
    setApplying(true)
    let success = 0
    for (const row of toApply) {
      try {
        await updateVariant.mutateAsync({
          id:    row.variant_id,
          input: { low_stock_threshold: row.recommended_par },
        })
        success++
      } catch {
        // individual failure already toasted by mutation
      }
    }
    if (success > 0) {
      toast.success(`Updated PAR for ${success} variant${success > 1 ? 's' : ''}`)
    }
    setSelected(new Set())
    setApplying(false)
  }, [rows, selected, updateVariant])

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Adaptive PAR Engine</h1>
              <p className="text-xs text-muted-foreground">
                Eye · Mind Layer · PAR = μ×L + z×σ_dL · no hardcoded values · all inputs derived from data
              </p>
            </div>
          </div>

          {/* Service level selector */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Target in-stock rate
            </p>
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              {SERVICE_LEVELS.map((sl) => (
                <button
                  key={sl.value}
                  type="button"
                  onClick={() => { handleServiceLevelChange(sl.value) }}
                  className={cn(
                    'flex flex-col items-center px-3 py-1.5 rounded text-xs transition-colors',
                    serviceLevel === sl.value
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  title={sl.description}
                >
                  <span className="font-bold">{sl.label}</span>
                  <span className={cn('text-[9px]', serviceLevel === sl.value ? 'opacity-70' : 'opacity-50')}>
                    {sl.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {lastUpdated && (
            <span className="text-xs text-muted-foreground self-end">
              Updated {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Computing optimal PAR levels…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center px-6">
            <Package2 className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No variants with sufficient consumption data found.
            </p>
          </div>
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex items-center gap-0 border-b shrink-0">
              {FILTERS.map((f) => {
                const count = f.id === 'all'
                  ? rows.length
                  : f.id === 'no_data'
                  ? rows.filter((r) => r.change_type === 'no_data' || r.change_type === 'no_lead_time').length
                  : rows.filter((r) => r.change_type === f.id).length
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { setFilter(f.id) }}
                    className={cn(
                      'px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5',
                      filter === f.id
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {f.label}
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full tabular-nums',
                      filter === f.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                    )}>
                      {count}
                    </span>
                  </button>
                )
              })}

              {/* Select all for current filter */}
              <div className="ml-auto px-4 flex items-center gap-2">
                {filtered.some((r) => r.change_type === 'increase' || r.change_type === 'decrease') && (
                  <button
                    type="button"
                    onClick={() => {
                      const actionable = filtered
                        .filter((r) => r.change_type === 'increase' || r.change_type === 'decrease')
                        .map((r) => r.variant_id)
                      const allSelected = actionable.every((id) => selected.has(id))
                      if (allSelected) {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          actionable.forEach((id) => next.delete(id))
                          return next
                        })
                      } else {
                        setSelected((prev) => new Set([...prev, ...actionable]))
                      }
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Zap className="h-3 w-3" />
                    Select all actionable
                  </button>
                )}
              </div>
            </div>

            {/* Summary strip */}
            <SummaryStrip
              rows={rows}
              selected={selected}
              onApplyAll={handleApplySelected}
              applying={applying}
            />

            {/* Table header */}
            <div className="flex items-center gap-3 px-5 py-1.5 border-b bg-muted/20 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
              <div className="w-4 shrink-0" />
              <div className="w-44 shrink-0">Product</div>
              <div className="w-48 shrink-0">Current → Optimal (delta)</div>
              <div className="w-24 shrink-0 text-center">SL today</div>
              <div className="w-24 shrink-0 text-center">Stockouts/yr</div>
              <div className="flex-1">Lead time · Occ adj</div>
              <div className="shrink-0">Confidence</div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
                  <X className="h-4 w-4" />
                  No variants match this filter
                </div>
              ) : (
                filtered.map((row) => (
                  <PARRow
                    key={row.variant_id}
                    row={row}
                    checked={selected.has(row.variant_id)}
                    onToggle={() => { toggleSelect(row.variant_id) }}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2 text-[10px] text-muted-foreground border-t shrink-0">
              Formula: PAR = ⌈adj_μ × L + z × σ_dL⌉ where σ_dL = √(L×σ_d² + adj_μ²×σ_L²) ·
              z from _normal_quantile({(serviceLevel * 100).toFixed(0)}% SL) ·
              L from PO history (≥3 POs) › supplier stated › hotel median ·
              adj_μ applies occupancy forecast when Pearson r ≥ 0.35 ·
              Confidence penalised for lead time source quality + data days
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Layer: Eye → Mind cross-layer
// Palantir principle: intelligence everywhere — every threshold carries its basis.
//
// AdaptivePARPage computes the statistically optimal PAR level for every variant
// using the full probabilistic model. Operators select their target service level,
// review the ranked recommendations, and apply individual or batch PAR changes.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Button,
  Callout,
  Checkbox,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function changeIcon(type: OptimalPARRow['change_type']): IconName {
  if (type === 'increase') return 'trending-up'
  if (type === 'decrease') return 'trending-down'
  return 'minus'
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

function LeadTimeSourceBadge({ src }: { src: OptimalPARRow['lead_time_source'] }) {
  const config: Record<typeof src, { label: string; intent: Intent }> = {
    po_history:      { label: 'From POs', intent: Intent.SUCCESS },
    supplier_stated: { label: 'Stated',   intent: Intent.PRIMARY },
    hotel_median:    { label: 'Median',   intent: Intent.WARNING },
    unknown:         { label: 'Unknown',  intent: Intent.NONE },
  }
  const cfg = config[src]
  return <Tag intent={cfg.intent} minimal>{cfg.label}</Tag>
}

function ConfidenceDot({ score }: { score: number }) {
  return (
    <span className={cn(
      'inline-block h-2 w-2 rounded-full shrink-0',
      score >= 0.75 ? 'bg-green-500' :
      score >= 0.50 ? 'bg-amber-400' : 'bg-red-400',
    )} title={`Confidence: ${String(Math.round(score * 100))}%`} />
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
          <Icon icon="trending-up" size={14} className="text-red-500" />
          <span className="font-semibold text-red-600">{increases}</span>
          <span className="text-muted-foreground">need increase</span>
        </div>
      )}
      {decreases > 0 && (
        <div className="flex items-center gap-1.5">
          <Icon icon="trending-down" size={14} className="text-blue-500" />
          <span className="font-semibold text-blue-600">{decreases}</span>
          <span className="text-muted-foreground">can reduce</span>
        </div>
      )}
      {calibrated > 0 && (
        <div className="flex items-center gap-1.5">
          <Icon icon="tick" size={14} className="text-green-500" />
          <span className="font-semibold text-green-600">{calibrated}</span>
          <span className="text-muted-foreground">calibrated</span>
        </div>
      )}
      {noData > 0 && (
        <div className="flex items-center gap-1.5">
          <Icon icon="warning-sign" size={14} className="text-muted-foreground" />
          <span className="font-semibold text-muted-foreground">{noData}</span>
          <span className="text-muted-foreground">insufficient data</span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        {selected.size > 0 && (
          <Button
            icon="double-chevron-up"
            intent={Intent.PRIMARY}
            size="small"
            loading={applying}
            onClick={onApplyAll}
          >
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
        <Checkbox
          checked={checked}
          disabled={!isActionable}
          onChange={() => { if (isActionable) onToggle() }}
          className="!mb-0"
        />

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
          <Icon icon={changeIcon(row.change_type)} size={14} className={cn('shrink-0', changeColor(row.change_type))} />
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
                  style={{ width: `${String(Math.round(row.service_level_at_current_par * 100))}%` }}
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
              <Icon icon="truck" size={12} />
              {row.lead_time_days !== null ? `${String(Math.round(row.lead_time_days))}d` : '?'}
            </span>
          )}
          <LeadTimeSourceBadge src={row.lead_time_source} />
          {row.occupancy_adj_factor !== 1.0 && (
            <Tag intent={Intent.PRIMARY} minimal icon="temperature">
              ×{row.occupancy_adj_factor.toFixed(2)}
            </Tag>
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
          <Button
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            variant="minimal"
            size="small"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={() => { setExpanded((e) => !e) }}
          />
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
          <Callout intent={Intent.NONE} icon="info-sign" compact className="mt-3">
            <span className="font-mono leading-relaxed text-[10px]">{row.rationale}</span>
          </Callout>
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
      toast.success(`Updated PAR for ${String(success)} variant${success > 1 ? 's' : ''}`)
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
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
              <Icon icon="horizontal-bar-chart-desc" size={14} intent={Intent.PRIMARY} />
            </div>
            <div>
              <h1 className="text-base font-semibold">Adaptive PAR Engine</h1>
              <p className="text-xs text-muted-foreground">
                Insights · PAR = μ×L + z×σ_dL · no hardcoded values · all inputs derived from data
              </p>
            </div>
          </div>

          {/* Service level selector */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Target in-stock rate
            </p>
            <SegmentedControl
              size="small"
              value={String(serviceLevel)}
              onValueChange={(v) => { handleServiceLevelChange(parseFloat(v)) }}
              options={SERVICE_LEVELS.map((sl) => ({ value: String(sl.value), label: sl.label }))}
            />
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
            <Spinner size={SpinnerSize.SMALL} />
            Computing optimal PAR levels…
          </div>
        ) : rows.length === 0 ? (
          <NonIdealState
            icon="box"
            title="No variants with sufficient consumption data found"
          />
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex items-center gap-3 border-b shrink-0 px-4 py-2">
              <SegmentedControl
                size="small"
                value={filter}
                onValueChange={(v) => { setFilter(v as FilterId) }}
                options={[
                  { value: 'all',        label: `All (${String(rows.length)})` },
                  { value: 'increase',   label: `Increase (${String(rows.filter((r) => r.change_type === 'increase').length)})` },
                  { value: 'decrease',   label: `Decrease (${String(rows.filter((r) => r.change_type === 'decrease').length)})` },
                  { value: 'calibrated', label: `Calibrated (${String(rows.filter((r) => r.change_type === 'calibrated').length)})` },
                  { value: 'no_data',    label: `No data (${String(rows.filter((r) => r.change_type === 'no_data' || r.change_type === 'no_lead_time').length)})` },
                ]}
              />

              {/* Select all for current filter */}
              {filtered.some((r) => r.change_type === 'increase' || r.change_type === 'decrease') && (
                <Button
                  icon="flash"
                  variant="minimal"
                  size="small"
                  className="ml-auto"
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
                >
                  Select all actionable
                </Button>
              )}
            </div>

            {/* Summary strip */}
            <SummaryStrip
              rows={rows}
              selected={selected}
              onApplyAll={() => { void handleApplySelected() }}
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
                  <Icon icon="cross" size={14} />
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

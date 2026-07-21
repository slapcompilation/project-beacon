// Layer: Eye — Waste Radar analytical surface (Sprint 14)
// Palantir principle: cross-domain synthesis. Every write-off spike is shown with:
//   • anomaly_score (1–10) — magnitude × occupancy inverse
//   • occupancy context at time of spike
//   • category breakdown (Breakage / Theft / Spoilage)
//   • team attribution (top write-off contributor in the 7-day window)
// Purpose: turn the correlation_score logic already in get_briefing_actions() into a
// full analytical surface so operators see the complete anomaly picture, not just the top 2.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Button,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useWasteRadar } from '@/features/eye/hooks'
import { CausalChainPanel } from '@/components/CausalChainPanel'
import type { WasteRadarRow } from '@beacon/types'

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const tier =
    score >= 8 ? 'critical' :
    score >= 5 ? 'high' :
    score >= 3 ? 'medium' : 'low'

  return (
    <div className={cn(
      'flex items-center justify-center w-9 h-9 rounded-lg font-bold text-base tabular-nums shrink-0',
      tier === 'critical' && 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-800',
      tier === 'high'     && 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 ring-1 ring-orange-300 dark:ring-orange-800',
      tier === 'medium'   && 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
      tier === 'low'      && 'bg-muted text-muted-foreground',
    )}>
      {score}
    </div>
  )
}

// ─── Occupancy band pill ──────────────────────────────────────────────────────

function OccupancyBand({ band, pct }: { band: WasteRadarRow['occupancy_band']; pct: number }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded',
      band === 'low'    && 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
      band === 'normal' && 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
      band === 'high'   && 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
    )}>
      <Icon icon="temperature" size={10} />
      {pct}% occ · {band}
    </span>
  )
}

// ─── Category breakdown pills ─────────────────────────────────────────────────

function CategoryPills({ row }: { row: WasteRadarRow }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {row.breakage_qty > 0 && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
          Breakage ×{row.breakage_qty}
        </span>
      )}
      {row.theft_qty > 0 && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
          Theft ×{row.theft_qty}
        </span>
      )}
      {row.spoilage_qty > 0 && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400">
          Spoilage ×{row.spoilage_qty}
        </span>
      )}
    </div>
  )
}

// ─── Radar row ────────────────────────────────────────────────────────────────

function RadarRow({
  row,
  rank,
  currency,
  expanded,
  onToggleExpand,
  explaining,
  onToggleExplain,
}: {
  row: WasteRadarRow
  rank: number
  currency: string
  expanded: boolean
  onToggleExpand: () => void
  explaining: boolean
  onToggleExplain: () => void
}) {
  const navigate = useNavigate()
  const isProbableTheft = row.occupancy_band === 'low' && row.theft_qty > 0
  const isHighAnomaly = row.anomaly_score >= 8

  return (
    <div className={cn(
      'border-b border-border/50 last:border-0 transition-colors',
      isHighAnomaly ? 'bg-red-50/20 dark:bg-red-950/5' : '',
    )}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Rank + score */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0 w-9">
          <span className="text-[10px] text-muted-foreground font-mono">#{rank}</span>
          <ScoreBadge score={row.anomaly_score} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/variant/${row.variant_id}`}
              className="text-sm font-semibold leading-tight hover:text-primary hover:underline transition-colors"
            >
              {row.variant_label}
            </Link>
            <div className="flex items-center gap-1.5 shrink-0">
              <OccupancyBand band={row.occupancy_band} pct={row.avg_occupancy_7d} />
            </div>
          </div>

          {/* Spike stats */}
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{row.qty_7d} units</span>
            {' '}written off this week vs{' '}
            <span className="font-medium">{row.avg_weekly} 4wk avg</span>
            {' '}
            <span className={cn(
              'inline-flex items-center gap-0.5 font-bold',
              row.pct_above_baseline >= 100 ? 'text-red-600' :
              row.pct_above_baseline >= 50  ? 'text-amber-600' : 'text-yellow-600',
            )}>
              <Icon icon="trending-up" size={12} />
              +{row.pct_above_baseline}% vs baseline
            </span>
          </p>

          {/* Category + attribution */}
          <div className="flex items-center gap-3 flex-wrap">
            <CategoryPills row={row} />
            {row.top_user_email && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Icon icon="people" size={10} />
                {row.top_user_email} · {row.top_user_qty} units
              </span>
            )}
            {row.waste_cost_7d > 0 && (
              <span className="text-[10px] text-muted-foreground font-medium">
                {formatCurrency(row.waste_cost_7d, currency)} at risk
              </span>
            )}
          </div>

          {/* Synthesis signal — shown when context is especially meaningful */}
          {isProbableTheft && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-700 dark:text-red-400 font-medium">
              <Icon icon="shield" size={12} className="shrink-0" />
              Low occupancy + Theft category — high probability of non-operational loss
            </div>
          )}
          {row.occupancy_band === 'low' && row.anomaly_score >= 7 && !isProbableTheft && (
            <div className="flex items-center gap-1.5 text-[11px] text-orange-700 dark:text-orange-400 font-medium">
              <Icon icon="warning-sign" size={12} className="shrink-0" />
              Strong anomaly at low occupancy — spike not explained by operational demand
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <Button
            size="small"
            variant={explaining ? 'solid' : 'outlined'}
            intent={explaining ? Intent.PRIMARY : Intent.NONE}
            icon="git-branch"
            onClick={onToggleExplain}
            title="Root cause attribution — traverses the Reality Graph to explain this anomaly"
          >
            Explain
          </Button>
          <Button
            size="small"
            variant="outlined"
            icon="arrow-top-right"
            onClick={() => {
              void navigate('/flow?panel=timeline', {
                state: { focusVariantId: row.variant_id, focusLabel: row.variant_label },
              })
            }}
          >
            Review
          </Button>
          <Button
            variant="minimal"
            size="small"
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            onClick={onToggleExpand}
            aria-label={expanded ? 'Collapse' : 'Expand details'}
          />
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-4 pb-4 pl-16 border-t border-border/30 bg-muted/20">
          <div className="pt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Anomaly breakdown</p>
              <p><span className="text-muted-foreground">Spike:</span> {row.pct_above_baseline}% above 4-week baseline</p>
              <p><span className="text-muted-foreground">Occupancy factor:</span>{' '}
                {row.occupancy_band === 'low' ? '×1.5 (low occ amplifies signal)' :
                 row.occupancy_band === 'normal' ? '×1.25' : '×1.0 (high occ, likely operational)'}
              </p>
              <p><span className="text-muted-foreground">Anomaly score:</span> {row.anomaly_score}/10</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">This week</p>
              {row.breakage_qty > 0 && <p><span className="text-muted-foreground">Breakage:</span> {row.breakage_qty} units</p>}
              {row.theft_qty > 0    && <p><span className="text-muted-foreground">Theft:</span> {row.theft_qty} units</p>}
              {row.spoilage_qty > 0 && <p><span className="text-muted-foreground">Spoilage:</span> {row.spoilage_qty} units</p>}
              {row.waste_cost_7d > 0 && <p><span className="text-muted-foreground">Cost at risk:</span> {formatCurrency(row.waste_cost_7d, currency)}</p>}
            </div>
          </div>
          {row.top_user_email && (
            <div className="mt-3 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Attribution</p>
              <p className="flex items-center gap-1.5">
                <Icon icon="people" size={12} className="text-muted-foreground" />
                <span className="font-medium">{row.top_user_email}</span>
                <span className="text-muted-foreground">logged the most units this week ({row.top_user_qty} units)</span>
              </p>
            </div>
          )}
          <p className="mt-3 text-[10px] text-muted-foreground">
            Spike detection: ≥50% above 4-week weekly baseline · occupancy from last 7 days · 7-day write-off window
          </p>
        </div>
      )}

      {/* Root Cause Attribution panel */}
      {explaining && (
        <div className="px-4 pb-4 pl-16 border-t border-border/30">
          <CausalChainPanel
            variantId={row.variant_id}
            anomalyType="waste_spike"
            onClose={onToggleExplain}
            className="mt-3"
          />
        </div>
      )}
    </div>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ rows, currency }: { rows: WasteRadarRow[]; currency: string }) {
  const totalCost = rows.reduce((s, r) => s + r.waste_cost_7d, 0)
  const criticalCount = rows.filter((r) => r.anomaly_score >= 8).length
  const probableTheft = rows.filter((r) => r.occupancy_band === 'low' && r.theft_qty > 0).length

  return (
    <div className="flex items-center gap-6 px-4 py-3 border-b bg-muted/30 text-xs">
      <div className="flex items-center gap-1.5">
        <Icon icon="flame" size={12} className="text-red-500" />
        <span className="font-semibold text-foreground">{rows.length}</span>
        <span className="text-muted-foreground">anomal{rows.length === 1 ? 'y' : 'ies'} detected</span>
      </div>
      {criticalCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Icon icon="warning-sign" size={12} className="text-red-600" />
          <span className="font-semibold text-red-600">{criticalCount}</span>
          <span className="text-muted-foreground">critical (score ≥8)</span>
        </div>
      )}
      {probableTheft > 0 && (
        <div className="flex items-center gap-1.5">
          <Icon icon="shield" size={12} className="text-red-700" />
          <span className="font-semibold text-red-700">{probableTheft}</span>
          <span className="text-muted-foreground">probable theft signal</span>
        </div>
      )}
      {totalCost > 0 && (
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-muted-foreground">Total cost at risk:</span>
          <span className="font-semibold text-foreground">{formatCurrency(totalCost, currency)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WasteRadarPage() {
  const currency = useCurrency()
  const { data: rows = [], isLoading, dataUpdatedAt } = useWasteRadar()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [explainedId, setExplainedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'anomaly' | 'cost' | 'spike'>('anomaly')

  const sorted = useMemo(() => {
    const copy = [...rows]
    if (sortBy === 'cost')   copy.sort((a, b) => b.waste_cost_7d - a.waste_cost_7d)
    if (sortBy === 'spike')  copy.sort((a, b) => b.pct_above_baseline - a.pct_above_baseline)
    // default: anomaly_score DESC (already from DB, but re-sort for safety)
    if (sortBy === 'anomaly') copy.sort((a, b) => b.anomaly_score - a.anomaly_score || b.qty_7d - a.qty_7d)
    return copy
  }, [rows, sortBy])

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/30">
              <Icon icon="satellite" size={14} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Waste Radar</h1>
              <p className="text-xs text-muted-foreground">
                Insights · 7-day write-off anomalies vs 4-week baseline · ranked by signal strength
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">Updated {lastUpdated}</span>
            )}
            {/* Sort controls */}
            <SegmentedControl
              size="small"
              value={sortBy}
              onValueChange={(v) => { setSortBy(v as 'anomaly' | 'cost' | 'spike') }}
              options={[
                { value: 'anomaly', label: 'Anomaly score' },
                { value: 'cost',    label: 'Cost at risk'  },
                { value: 'spike',   label: 'Spike %'       },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
          </div>
        ) : rows.length === 0 ? (
          <NonIdealState
            icon="eye-open"
            title="No anomalies detected"
            description={`All write-off categories (Breakage, Theft, Spoilage) are within 50% of their 4-week weekly baseline. Scanned at ${lastUpdated ?? 'load time'}. Threshold: ≥50% above 4-week avg · occupancy-weighted · anomaly score 1–10.`}
          />
        ) : (
          <>
            <SummaryStrip rows={rows} currency={currency} />
            <div>
              {sorted.map((row, i) => (
                <RadarRow
                  key={row.variant_id}
                  row={row}
                  rank={i + 1}
                  currency={currency}
                  expanded={expandedId === row.variant_id}
                  onToggleExpand={() => {
                    setExpandedId((prev) => prev === row.variant_id ? null : row.variant_id)
                  }}
                  explaining={explainedId === row.variant_id}
                  onToggleExplain={() => {
                    setExplainedId((prev) => prev === row.variant_id ? null : row.variant_id)
                  }}
                />
              ))}
            </div>
            <div className="px-4 py-3 text-[10px] text-muted-foreground border-t">
              Spike detection: ≥50% above 4-week weekly avg (Breakage + Theft + Spoilage) ·
              anomaly_score = spike% × occupancy_factor / 30, clamped 1–10 ·
              low occupancy (&lt;50%) amplifies score ×1.5 · normal (&lt;70%) ×1.25 · high ×1.0 ·
              team attribution: user with highest write-off volume in 7-day window
            </div>
          </>
        )}
      </div>
    </div>
  )
}

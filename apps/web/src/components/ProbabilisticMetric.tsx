// Layer: Eye — Probabilistic metric chip
// Palantir principle: never display a prediction without its basis and confidence.
//
// Shows: stock · ~Xd · P% in Td  (coloured by risk level)
// Insufficient data: stock · ~Xd · — sparse data  (greyed)
// Tooltip: full breakdown (mean rate, stddev, confidence, data days, pattern)

import { cn } from '@/lib/utils'
import type { StockoutProbabilityRow } from '@beacon/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function probColor(prob: number): string {
  if (prob >= 70) return 'text-red-600 dark:text-red-400'
  if (prob >= 30) return 'text-amber-600 dark:text-amber-400'
  return 'text-green-600 dark:text-green-500'
}

function probBgColor(prob: number): string {
  if (prob >= 70) return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50'
  if (prob >= 30) return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
  return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50'
}

function confidenceDot(score: number): string {
  if (score >= 0.8) return 'bg-green-500'
  if (score >= 0.4) return 'bg-amber-400'
  return 'bg-muted-foreground/40'
}

function patternLabel(pattern: StockoutProbabilityRow['demand_pattern']): string {
  switch (pattern) {
    case 'steady':       return 'Steady demand'
    case 'variable':     return 'Variable demand'
    case 'event_driven': return 'Event-driven spikes'
    case 'sparse':       return 'Sparse history'
  }
}

function daysLabel(days: number): string {
  if (days >= 999) return '∞d'
  if (days < 1)    return '<1d'
  return `${days.toFixed(1)}d`
}

// ─── Full tooltip content (title attribute) ───────────────────────────────────

function buildTooltip(row: StockoutProbabilityRow, horizon: 7 | 14 | 30): string {
  const prob = horizon === 7 ? row.stockout_prob_7d
             : horizon === 14 ? row.stockout_prob_14d
             : row.stockout_prob_30d

  const lines = [
    `${row.product_name} · ${row.sku}`,
    `Stock: ${String(row.current_stock)} units`,
    `Mean consumption: ${row.mean_daily_30d.toFixed(2)}/day (30d avg)`,
    row.stddev_daily > 0
      ? `Stddev: ±${row.stddev_daily.toFixed(2)}/day`
      : 'Stddev: 0 (deterministic)',
    prob != null
      ? `P(stockout in ${String(horizon)}d): ${prob.toFixed(1)}%`
      : 'Insufficient data for probability',
    `Confidence: ${Math.round(row.confidence_score * 100)}% (${String(row.data_days)} active days)`,
    `Pattern: ${patternLabel(row.demand_pattern)}`,
    `Based on: 30-day rolling consumption window`,
  ]
  return lines.join('\n')
}

// ─── Probability bar (0–100) ──────────────────────────────────────────────────

function ProbBar({ prob, compact }: { prob: number; compact: boolean }) {
  const width = `${Math.min(100, prob).toFixed(1)}%`
  const color  = prob >= 70 ? 'bg-red-500' : prob >= 30 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className={cn('rounded-full bg-muted/60 overflow-hidden', compact ? 'h-1 w-16' : 'h-1.5 w-24')}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width }} />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ProbabilisticMetricProps {
  row:      StockoutProbabilityRow
  /** Which horizon's probability to display. Defaults to 7. */
  horizon?: 7 | 14 | 30
  /** Compact mode: single line, no bar. Use in table rows. */
  compact?: boolean
  className?: string
}

export function ProbabilisticMetric({
  row,
  horizon  = 7,
  compact  = false,
  className,
}: ProbabilisticMetricProps) {
  const prob = horizon === 7 ? row.stockout_prob_7d
             : horizon === 14 ? row.stockout_prob_14d
             : row.stockout_prob_30d

  const isInsufficient = prob === null
  const days           = daysLabel(row.days_until_zero)

  if (compact) {
    // ── Compact: one-line pill used inside table rows ──────────────────────
    return (
      <span
        title={buildTooltip(row, horizon)}
        className={cn('inline-flex items-center gap-1.5 text-[11px] tabular-nums', className)}
      >
        <span className="text-muted-foreground">{String(row.current_stock)}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="text-muted-foreground">~{days}</span>
        <span className="text-muted-foreground/50">·</span>
        {isInsufficient ? (
          <span className="text-muted-foreground/50 italic">sparse data</span>
        ) : (
          <span className={cn('font-medium', probColor(prob!))}>
            {prob!.toFixed(0)}% in {String(horizon)}d
          </span>
        )}
        {/* Confidence dot */}
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', confidenceDot(row.confidence_score))}
          title={`Confidence: ${Math.round(row.confidence_score * 100)}%`}
        />
      </span>
    )
  }

  // ── Full card variant used in Risk Matrix / standalone views ──────────────
  return (
    <div
      title={buildTooltip(row, horizon)}
      className={cn(
        'rounded-lg border px-4 py-3 space-y-2 text-sm',
        isInsufficient
          ? 'bg-muted/20 border-muted/40'
          : probBgColor(prob!),
        className,
      )}
    >
      {/* Top row: product · days */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{row.product_name}</span>
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {String(row.current_stock)} units · ~{days}
        </span>
      </div>

      {/* Probability display */}
      {isInsufficient ? (
        <p className="text-xs text-muted-foreground italic">
          Insufficient history — {String(row.data_days)} day{row.data_days !== 1 ? 's' : ''} of data
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">P(stockout in {String(horizon)}d)</span>
              <span className={cn('text-sm font-bold tabular-nums', probColor(prob!))}>
                {prob!.toFixed(1)}%
              </span>
            </div>
            <ProbBar prob={prob!} compact={false} />
          </div>
        </div>
      )}

      {/* Footer: confidence + pattern */}
      <div className="flex items-center gap-2 pt-0.5">
        <span className={cn('h-2 w-2 rounded-full shrink-0', confidenceDot(row.confidence_score))} />
        <span className="text-[10px] text-muted-foreground">
          {Math.round(row.confidence_score * 100)}% confidence
          {' · '}
          {patternLabel(row.demand_pattern)}
          {' · '}
          based on {String(row.data_days)}-day avg
        </span>
      </div>
    </div>
  )
}

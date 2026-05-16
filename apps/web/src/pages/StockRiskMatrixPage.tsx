// Layer: Eye — Stock Risk Matrix
// Palantir principle: operators see the full probability landscape,
// not just the items that crossed a threshold. Every variant's uncertainty
// is quantified and sorted by risk so the highest-confidence, highest-risk
// items are always at the top.
//
// Shows: all active variants ranked by stockout probability
//        with confidence bands, demand pattern, and 7/14/30d horizon toggle.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState } from 'react'
import {
  Button,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useStockoutProbabilities } from '@/features/inventory/hooks'
import { ProbabilisticMetric } from '@/components/ProbabilisticMetric'
import type { StockoutProbabilityRow } from '@beacon/types'

// ─── Horizon toggle ───────────────────────────────────────────────────────────

type Horizon = 7 | 14 | 30

function HorizonToggle({ value, onChange }: { value: Horizon; onChange: (h: Horizon) => void }) {
  return (
    <SegmentedControl
      size="small"
      value={String(value)}
      onValueChange={(v) => { onChange(Number(v) as Horizon) }}
      options={[
        { label: '7d',  value: '7'  },
        { label: '14d', value: '14' },
        { label: '30d', value: '30' },
      ]}
    />
  )
}

// ─── Risk tier helpers ────────────────────────────────────────────────────────

type Tier = 'high' | 'moderate' | 'low' | 'no_data'

function riskTier(row: StockoutProbabilityRow, horizon: Horizon): Tier {
  const prob = horizon === 7  ? row.stockout_prob_7d
             : horizon === 14 ? row.stockout_prob_14d
             : row.stockout_prob_30d
  if (prob === null) return 'no_data'
  if (prob >= 70)    return 'high'
  if (prob >= 30)    return 'moderate'
  return 'low'
}

const TIER_META: Record<Tier, { label: string; icon: IconName; color: string; bg: string; border: string }> = {
  high:     { label: 'High Risk',         icon: 'warning-sign', color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50/60 dark:bg-red-950/20',    border: 'border-red-200 dark:border-red-900' },
  moderate: { label: 'Moderate Risk',     icon: 'time',         color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/60 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-900' },
  low:      { label: 'Low Risk',          icon: 'tick-circle',  color: 'text-green-600 dark:text-green-500', bg: 'bg-green-50/30 dark:bg-green-950/10', border: 'border-green-200/60 dark:border-green-900/40' },
  no_data:  { label: 'Insufficient Data', icon: 'help',         color: 'text-muted-foreground',              bg: 'bg-muted/20',                          border: 'border-muted/40' },
}

function TierHeader({ tier, count }: { tier: Tier; count: number }) {
  const meta = TIER_META[tier]
  return (
    <div className={cn('flex items-center gap-2 px-5 py-2.5 rounded-lg border', meta.bg, meta.border)}>
      <Icon icon={meta.icon} size={14} className={cn('shrink-0', meta.color)} />
      <span className={cn('text-xs font-semibold', meta.color)}>{meta.label}</span>
      <span className="text-xs text-muted-foreground ml-auto">{String(count)} variant{count !== 1 ? 's' : ''}</span>
    </div>
  )
}

// ─── Single row ───────────────────────────────────────────────────────────────

function MatrixRow({ row, horizon }: { row: StockoutProbabilityRow; horizon: Horizon }) {
  const prob = horizon === 7  ? row.stockout_prob_7d
             : horizon === 14 ? row.stockout_prob_14d
             : row.stockout_prob_30d

  const tier  = riskTier(row, horizon)
  const width = prob != null ? `${Math.min(100, prob).toFixed(1)}%` : '0%'
  const barColor = tier === 'high' ? 'bg-red-500' : tier === 'moderate' ? 'bg-amber-400' : 'bg-green-500'

  return (
    <div className={cn(
      'flex items-center gap-4 px-5 py-3 rounded-lg border transition-colors hover:bg-muted/20',
      tier === 'high'     && 'border-red-200/70 dark:border-red-900/40',
      tier === 'moderate' && 'border-amber-200/70 dark:border-amber-900/40',
      tier === 'low'      && 'border-transparent',
      tier === 'no_data'  && 'border-transparent opacity-60',
    )}>
      {/* Identity */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{row.product_name}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">{row.sku}</p>
      </div>

      {/* Probability + bar */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-32 space-y-1 text-right">
          {prob != null ? (
            <>
              <p className={cn(
                'text-sm font-bold tabular-nums',
                tier === 'high' ? 'text-red-600 dark:text-red-400' :
                tier === 'moderate' ? 'text-amber-600 dark:text-amber-400' :
                'text-green-600 dark:text-green-500',
              )}>
                {prob.toFixed(1)}%
              </p>
              <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
                <div className={cn('h-full rounded-full', barColor)} style={{ width }} />
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">no data</p>
          )}
        </div>

        {/* Compact metric: stock · days · confidence */}
        <ProbabilisticMetric row={row} horizon={horizon} compact className="text-[10px]" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StockRiskMatrixPage() {
  const { data = [], isLoading, refetch, isFetching } = useStockoutProbabilities()
  const [horizon, setHorizon] = useState<Horizon>(7)

  const { high, moderate, low, no_data } = useMemo(() => {
    const groups = { high: [] as StockoutProbabilityRow[], moderate: [] as StockoutProbabilityRow[], low: [] as StockoutProbabilityRow[], no_data: [] as StockoutProbabilityRow[] }
    for (const row of data) groups[riskTier(row, horizon)].push(row)
    return groups
  }, [data, horizon])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground gap-2">
        <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
        Computing probability distributions…
      </div>
    )
  }

  const total = data.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-4 shrink-0 bg-background">
        <div>
          <h1 className="text-base font-semibold">Eye · Stock Risk Matrix</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stockout probability per variant · Normal distribution model · 30-day rolling window
            {total > 0 && ` · ${String(total)} active variants`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HorizonToggle value={horizon} onChange={setHorizon} />
          <Button
            icon="refresh"
            variant="minimal"
            size="small"
            onClick={() => { void refetch() }}
            loading={isFetching}
            aria-label="Refresh"
          />
        </div>
      </div>

      {/* Summary strip */}
      {total > 0 && (
        <div className="grid grid-cols-4 gap-3 px-8 py-4 border-b shrink-0">
          <div className="text-center">
            <p className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">{String(high.length)}</p>
            <p className="text-[10px] text-muted-foreground">High risk ≥70%</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{String(moderate.length)}</p>
            <p className="text-[10px] text-muted-foreground">Moderate 30–70%</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-green-600 dark:text-green-500 tabular-nums">{String(low.length)}</p>
            <p className="text-[10px] text-muted-foreground">Low risk &lt;30%</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-muted-foreground tabular-nums">{String(no_data.length)}</p>
            <p className="text-[10px] text-muted-foreground">Insufficient data</p>
          </div>
        </div>
      )}

      {/* Matrix list */}
      <div className="flex-1 overflow-auto px-8 py-4 space-y-4">
        {total === 0 ? (
          <NonIdealState
            icon="tick-circle"
            title="No active variants"
            description="No active variants found."
          />
        ) : (
          <>
            {high.length > 0 && (
              <section className="space-y-2">
                <TierHeader tier="high" count={high.length} />
                {high.map((r) => <MatrixRow key={r.variant_id} row={r} horizon={horizon} />)}
              </section>
            )}
            {moderate.length > 0 && (
              <section className="space-y-2">
                <TierHeader tier="moderate" count={moderate.length} />
                {moderate.map((r) => <MatrixRow key={r.variant_id} row={r} horizon={horizon} />)}
              </section>
            )}
            {low.length > 0 && (
              <section className="space-y-2">
                <TierHeader tier="low" count={low.length} />
                {low.map((r) => <MatrixRow key={r.variant_id} row={r} horizon={horizon} />)}
              </section>
            )}
            {no_data.length > 0 && (
              <section className="space-y-2">
                <TierHeader tier="no_data" count={no_data.length} />
                <p className="text-[10px] text-muted-foreground px-5">
                  These variants have fewer than 3 days of consumption history.
                  Probability estimates require a minimum data window to be statistically meaningful.
                </p>
                {no_data.map((r) => <MatrixRow key={r.variant_id} row={r} horizon={horizon} />)}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

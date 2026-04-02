// Layer: Eye — Stock Risk Matrix
// Palantir principle: operators see the full probability landscape,
// not just the items that crossed a threshold. Every variant's uncertainty
// is quantified and sorted by risk so the highest-confidence, highest-risk
// items are always at the top.
//
// Shows: all active variants ranked by stockout probability
//        with confidence bands, demand pattern, and 7/14/30d horizon toggle.

import { useMemo, useState } from 'react'
import { AlertTriangle, Clock, CheckCircle2, HelpCircle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStockoutProbabilities } from '@/features/inventory/hooks'
import { ProbabilisticMetric } from '@/components/ProbabilisticMetric'
import type { StockoutProbabilityRow } from '@beacon/types'

// ─── Horizon toggle ───────────────────────────────────────────────────────────

type Horizon = 7 | 14 | 30

function HorizonToggle({ value, onChange }: { value: Horizon; onChange: (h: Horizon) => void }) {
  return (
    <div className="flex rounded-md border overflow-hidden text-xs shrink-0">
      {([7, 14, 30] as Horizon[]).map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => { onChange(h) }}
          className={cn(
            'px-3 py-1.5 transition-colors',
            value === h
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted/50',
          )}
        >
          {String(h)}d
        </button>
      ))}
    </div>
  )
}

// ─── Risk tier helpers ────────────────────────────────────────────────────────

function riskTier(row: StockoutProbabilityRow, horizon: Horizon): 'high' | 'moderate' | 'low' | 'no_data' {
  const prob = horizon === 7  ? row.stockout_prob_7d
             : horizon === 14 ? row.stockout_prob_14d
             : row.stockout_prob_30d
  if (prob === null) return 'no_data'
  if (prob >= 70)    return 'high'
  if (prob >= 30)    return 'moderate'
  return 'low'
}

function TierHeader({ tier, count }: { tier: 'high' | 'moderate' | 'low' | 'no_data'; count: number }) {
  const config = {
    high:    { label: 'High Risk',        icon: AlertTriangle, color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50/60 dark:bg-red-950/20',     border: 'border-red-200 dark:border-red-900' },
    moderate:{ label: 'Moderate Risk',    icon: Clock,         color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/60 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-900' },
    low:     { label: 'Low Risk',         icon: CheckCircle2,  color: 'text-green-600 dark:text-green-500', bg: 'bg-green-50/30 dark:bg-green-950/10',  border: 'border-green-200/60 dark:border-green-900/40' },
    no_data: { label: 'Insufficient Data',icon: HelpCircle,    color: 'text-muted-foreground',              bg: 'bg-muted/20',                          border: 'border-muted/40' },
  }[tier]
  const Icon = config.icon
  return (
    <div className={cn('flex items-center gap-2 px-5 py-2.5 rounded-lg border', config.bg, config.border)}>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', config.color)} />
      <span className={cn('text-xs font-semibold', config.color)}>{config.label}</span>
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
        <Loader2 className="h-5 w-5 animate-spin" />
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
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => { void refetch() }}
            disabled={isFetching}
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          </Button>
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
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No active variants found.</p>
          </div>
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

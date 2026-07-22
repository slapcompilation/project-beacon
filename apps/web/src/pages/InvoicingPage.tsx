// Layer: Mind — Invoicing Intelligence (Sprint 17, Phase 8)
// Palantir principle: decision support, not data display.
// Answers: "Which suppliers are systematically overcharging us, and by how much?"
// Cross-domain synthesis: invoice pattern + fill rate + leverage score → negotiation brief.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  Button,
  Callout,
  HTMLSelect,
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
import { useInvoiceIntelligence, usePriceVarianceBySupplier } from '@/features/mind/hooks'
import type { InvoiceIntelligenceRow, PriceVarianceBySupplierRow } from '@beacon/types'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function LeverageBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-red-500'
    : score >= 40 ? 'bg-yellow-500'
    : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${String(score)}%` }} />
      </div>
      <span className={cn(
        'text-xs font-semibold tabular-nums',
        score >= 70 ? 'text-red-600 dark:text-red-400'
        : score >= 40 ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-foreground',
      )}>
        {score}/100
      </span>
    </div>
  )
}

function StreakBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
      count >= 3
        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
        : count >= 2
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
        : 'bg-muted text-muted-foreground',
    )}>
      <Icon icon="trending-up" size={10} />
      {count} in a row
    </span>
  )
}

// ─── Supplier row ──────────────────────────────────────────────────────────────

function SupplierRow({
  row,
  priceVariance,
  currency,
  expanded,
  onToggle,
  onNegotiate,
}: {
  row: InvoiceIntelligenceRow
  priceVariance: PriceVarianceBySupplierRow | undefined
  currency: string
  expanded: boolean
  onToggle: () => void
  onNegotiate: () => void
}) {
  const varPct = row.avg_variance_pct
  const isOvercharged = varPct > 0
  const aboveRate = row.total_deliveries > 0
    ? Math.round((row.deliveries_above_baseline / row.total_deliveries) * 100)
    : 0

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      row.anomaly_flag
        ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
        : 'border-border bg-card',
    )}>
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {/* Anomaly indicator */}
        <div className="shrink-0">
          {row.anomaly_flag ? (
            <Icon icon="warning-sign" size={14} className="text-red-500" />
          ) : (
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
          )}
        </div>

        {/* Supplier name + streak */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{row.supplier_name}</span>
            <StreakBadge count={row.consecutive_above_count} />
            {row.anomaly_flag && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                anomaly
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {row.total_deliveries} deliveries in window ·
            {' '}{aboveRate}% above baseline ·
            {' '}last {formatDistanceToNow(new Date(row.last_delivery_at), { addSuffix: true })}
          </p>
        </div>

        {/* Avg overcharge */}
        <div className="shrink-0 text-right">
          <p className={cn(
            'text-sm font-semibold tabular-nums',
            isOvercharged
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-600 dark:text-green-400',
          )}>
            {isOvercharged ? '+' : ''}{varPct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">avg variance</p>
        </div>

        {/* Financial impact */}
        <div className="shrink-0 text-right hidden sm:block">
          <p className={cn(
            'text-sm font-semibold tabular-nums',
            row.total_financial_impact > 0
              ? 'text-red-600 dark:text-red-400'
              : row.total_financial_impact < 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-muted-foreground',
          )}>
            {row.total_financial_impact > 0 ? '+' : ''}
            {formatCurrency(row.total_financial_impact, currency)}
          </p>
          <p className="text-[10px] text-muted-foreground">financial impact</p>
        </div>

        {/* Leverage */}
        <div className="shrink-0 hidden md:block">
          <LeverageBar score={row.leverage_score} />
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-muted-foreground">
          <Icon icon={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">

          {/* Anomaly narrative */}
          {row.anomaly_flag && (
            <Callout intent={Intent.DANGER} icon="warning-sign" compact>
              {row.consecutive_above_count >= 3 ? (
                <>
                  <strong>{row.supplier_name}</strong> has charged above the contracted
                  rate on the last <strong>{row.consecutive_above_count} consecutive
                  deliveries</strong>
                  {row.avg_variance_pct > 0 && (
                    <> (avg +{row.avg_variance_pct.toFixed(1)}% above expected)</>
                  )}
                  . This is a systematic pricing pattern, not a one-time variance.
                </>
              ) : (
                <>
                  <strong>{row.supplier_name}</strong> has averaged
                  {' '}<strong>+{row.avg_variance_pct.toFixed(1)}%</strong> above
                  expected cost across {row.deliveries_above_baseline} of{' '}
                  {row.total_deliveries} deliveries in this period.
                </>
              )}
            </Callout>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Deliveries above</p>
              <p className="text-lg font-semibold mt-0.5">
                {row.deliveries_above_baseline}/{row.total_deliveries}
              </p>
              <p className="text-[10px] text-muted-foreground">{aboveRate}% of window</p>
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current streak</p>
              <p className={cn(
                'text-lg font-semibold mt-0.5',
                row.consecutive_above_count >= 3 ? 'text-red-600 dark:text-red-400'
                : row.consecutive_above_count >= 1 ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-green-600 dark:text-green-400',
              )}>
                {row.consecutive_above_count === 0
                  ? 'None'
                  : `${String(row.consecutive_above_count)} above`}
              </p>
              <p className="text-[10px] text-muted-foreground">consecutive deliveries</p>
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg overcharge</p>
              <p className={cn(
                'text-lg font-semibold mt-0.5 tabular-nums',
                varPct > 5 ? 'text-red-600 dark:text-red-400'
                : varPct > 0 ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-green-600 dark:text-green-400',
              )}>
                {varPct > 0 ? '+' : ''}{varPct.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">vs expected unit cost</p>
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Financial impact</p>
              <p className={cn(
                'text-lg font-semibold mt-0.5 tabular-nums',
                row.total_financial_impact > 0 ? 'text-red-600 dark:text-red-400'
                : row.total_financial_impact < 0 ? 'text-green-600 dark:text-green-400'
                : 'text-muted-foreground',
              )}>
                {row.total_financial_impact > 0 ? '+' : ''}
                {formatCurrency(row.total_financial_impact, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground">total in period</p>
            </div>
          </div>

          {/* Cross-domain synthesis: invoice pattern + fill rate */}
          {priceVariance && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cross-domain synthesis
              </p>
              <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                {priceVariance.avg_variance_pct != null && priceVariance.avg_variance_pct > 0 && (
                  <p>
                    <span className="font-medium text-foreground">Price pattern confirmed:</span>
                    {' '}Over the full window, {row.supplier_name} charged +{priceVariance.avg_variance_pct.toFixed(1)}% above baseline on
                    average ({priceVariance.receive_count} receives).
                    {' '}Total overcharge: <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(priceVariance.total_overcharge, currency)}</span>.
                  </p>
                )}
                {row.leverage_score >= 40 && (
                  <p>
                    <span className="font-medium text-foreground">Negotiation leverage:</span>
                    {' '}Score {row.leverage_score}/100.
                    {row.consecutive_above_count >= 3
                      ? ' A documented streak of overcharges is strong grounds to request a price correction or contract review.'
                      : row.avg_variance_pct > 10
                      ? ' Sustained overcharging above 10% indicates pricing drift that requires a formal review.'
                      : ' Moderate leverage — raise at next supplier review.'
                    }
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Confidence footnote */}
          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
            <Icon icon="info-sign" size={10} className="shrink-0 mt-0.5" />
            <span>
              Based on {row.total_deliveries} deliveries with recorded unit costs in the selected window.
              Expected cost = product_variants.cost (master price list). Leverage score = streak weight + overcharge magnitude + financial impact.
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              size="small"
              intent={Intent.PRIMARY}
              icon="th"
              endIcon="arrow-right"
              onClick={onNegotiate}
            >
              Open Negotiation Prep
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({
  rows,
  currency,
}: {
  rows: InvoiceIntelligenceRow[]
  currency: string
}) {
  const anomalyCount = rows.filter((r) => r.anomaly_flag).length
  const totalImpact  = rows.reduce((s, r) => s + r.total_financial_impact, 0)
  const maxStreak    = rows.reduce((m, r) => Math.max(m, r.consecutive_above_count), 0)

  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg border bg-card p-4">
      <div className="text-center">
        <p className={cn(
          'text-2xl font-bold',
          anomalyCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
        )}>
          {anomalyCount}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          anomaly{anomalyCount !== 1 ? 'ies' : ''} detected
        </p>
      </div>
      <div className="text-center">
        <p className={cn(
          'text-2xl font-bold tabular-nums',
          totalImpact > 0 ? 'text-red-600 dark:text-red-400'
          : totalImpact < 0 ? 'text-green-600 dark:text-green-400'
          : 'text-foreground',
        )}>
          {totalImpact > 0 ? '+' : ''}{formatCurrency(totalImpact, currency)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">total financial impact</p>
      </div>
      <div className="text-center">
        <p className={cn(
          'text-2xl font-bold',
          maxStreak >= 3 ? 'text-red-600 dark:text-red-400'
          : maxStreak >= 1 ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-green-600 dark:text-green-400',
        )}>
          {maxStreak}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">longest current streak</p>
      </div>
    </div>
  )
}

// ─── Sort toggle ────────────────────────────────────────────────────────────────

type SortKey = 'leverage_score' | 'total_financial_impact' | 'avg_variance_pct' | 'consecutive_above_count'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'leverage_score',           label: 'Sort: Leverage'      },
  { value: 'total_financial_impact',   label: 'Sort: Impact'        },
  { value: 'avg_variance_pct',         label: 'Sort: Overcharge %'  },
  { value: 'consecutive_above_count',  label: 'Sort: Streak'        },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function InvoicingPage() {
  const navigate  = useNavigate()
  const currency  = useCurrency()
  const [days, setDays] = useState<30 | 90 | 180>(90)
  const [sortBy, setSortBy] = useState<SortKey>('leverage_score')
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)

  const { data: rows = [], isLoading }      = useInvoiceIntelligence(days)
  const { data: priceVariance = [] }        = usePriceVarianceBySupplier(days)

  const priceVarianceMap = useMemo(
    () => new Map(priceVariance.map((r) => [r.supplier_name, r])),
    [priceVariance],
  )

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => b[sortBy] - a[sortBy])
  }, [rows, sortBy])

  const anomalyRows = sorted.filter((r) => r.anomaly_flag)
  const normalRows  = sorted.filter((r) => !r.anomaly_flag)

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-start justify-between border-b px-4 md:px-8 py-5 flex-shrink-0 gap-4">
        <div>
          <h1 className="text-xl font-semibold">Operations · Invoicing Intelligence</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Per-supplier invoice pricing patterns · consecutive overcharge streak detection
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Range */}
          <SegmentedControl
            size="small"
            value={String(days)}
            onValueChange={(v) => { setDays(Number(v) as 30 | 90 | 180) }}
            options={[
              { value: '30',  label: '30d'  },
              { value: '90',  label: '90d'  },
              { value: '180', label: '180d' },
            ]}
          />

          {/* Sort */}
          <HTMLSelect
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortKey) }}
            options={SORT_OPTIONS}
            minimal
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-8 py-5 space-y-6">

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
            Analysing invoice patterns…
          </div>
        ) : rows.length === 0 ? (
          <NonIdealState
            icon="tick-circle"
            title="No invoice patterns to analyse"
            description="Invoice intelligence requires at least 2 deliveries with recorded unit costs (entered at receiving time). Log unit costs when receiving stock to activate pattern detection."
          />
        ) : (
          <>
            {/* Summary strip */}
            <SummaryStrip rows={rows} currency={currency} />

            {/* Anomaly section */}
            {anomalyRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon icon="warning-sign" size={14} className="text-red-500" />
                  <h2 className="text-sm font-semibold">
                    Anomalies requiring attention
                    <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {anomalyRows.length}
                    </span>
                  </h2>
                </div>
                {anomalyRows.map((row) => (
                  <SupplierRow
                    key={row.supplier_name}
                    row={row}
                    priceVariance={priceVarianceMap.get(row.supplier_name)}
                    currency={currency}
                    expanded={expandedSupplier === row.supplier_name}
                    onToggle={() => {
                      setExpandedSupplier((s) => s === row.supplier_name ? null : row.supplier_name)
                    }}
                    onNegotiate={() => { void navigate('/mind?panel=intelligence') }}
                  />
                ))}
              </div>
            )}

            {/* Normal section */}
            {normalRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon icon="horizontal-bar-chart" size={14} className="text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Within acceptable range
                    <span className="ml-1.5 text-xs font-normal">({normalRows.length})</span>
                  </h2>
                </div>
                {normalRows.map((row) => (
                  <SupplierRow
                    key={row.supplier_name}
                    row={row}
                    priceVariance={priceVarianceMap.get(row.supplier_name)}
                    currency={currency}
                    expanded={expandedSupplier === row.supplier_name}
                    onToggle={() => {
                      setExpandedSupplier((s) => s === row.supplier_name ? null : row.supplier_name)
                    }}
                    onNegotiate={() => { void navigate('/mind?panel=intelligence') }}
                  />
                ))}
              </div>
            )}

            {/* Confidence footer */}
            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground pb-4">
              <Icon icon="info-sign" size={12} className="shrink-0 mt-0.5" />
              <span>
                Pattern analysis covers delivers with recorded unit costs in the {days}-day window.
                Anomaly threshold: 3+ consecutive overcharges OR avg overcharge &gt;10%.
                Leverage score = streak weight (12/delivery) + overcharge magnitude (max 40) + financial impact (max 20).
                Only suppliers with ≥2 data points are shown.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

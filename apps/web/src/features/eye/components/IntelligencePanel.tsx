// Cross-domain signals (depletion, waste, dead stock, cost-at-risk) ranked by urgency.

import { useNavigate } from 'react-router-dom'
import { Button, Icon, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useShiftIntelligence } from '../hooks'
import type { ShiftIntelligenceRow } from '../api'

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    pct >= 75 ? 'bg-green-500'
    : pct >= 50 ? 'bg-yellow-500'
    : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5" title={`${String(pct)}% confidence`}>
      <div className="h-1 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${String(pct)}%` }} />
      </div>
      <span className="text-[9px] text-muted-foreground tabular-nums font-mono">{String(pct)}%</span>
    </div>
  )
}

const SIGNAL_META: Record<ShiftIntelligenceRow['signal_type'], {
  icon: IconName
  borderClass: (critical: boolean, warning: boolean) => string
  iconClass: (critical: boolean, warning: boolean) => string
  pillClass: (critical: boolean, warning: boolean) => string
}> = {
  depletion_risk: {
    icon: 'trending-down',
    borderClass: (c, w) =>
      c ? 'border-red-200 bg-red-50/40 dark:border-red-800 dark:bg-red-950/20'
      : w ? 'border-yellow-200 bg-yellow-50/40 dark:border-yellow-800 dark:bg-yellow-950/20'
      : 'border-border bg-muted/20',
    iconClass: (c, w) =>
      c ? 'bg-red-100 text-red-600 dark:bg-red-900/40'
      : w ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800',
    pillClass: (c, w) =>
      c ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
      : w ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  waste_spike: {
    icon: 'flame',
    borderClass: () => 'border-orange-200 bg-orange-50/40 dark:border-orange-800 dark:bg-orange-950/20',
    iconClass:   () => 'bg-orange-100 text-orange-600 dark:bg-orange-900/40',
    pillClass:   () => 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  },
  dead_stock: {
    icon: 'archive',
    borderClass: () => 'border-slate-200 bg-slate-50/40 dark:border-slate-700 dark:bg-slate-900/30',
    iconClass:   () => 'bg-slate-100 text-slate-500 dark:bg-slate-800',
    pillClass:   () => 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  cost_at_risk: {
    icon: 'calendar',
    borderClass: () => 'border-purple-200 bg-purple-50/40 dark:border-purple-800 dark:bg-purple-950/20',
    iconClass:   () => 'bg-purple-100 text-purple-600 dark:bg-purple-900/40',
    pillClass:   () => 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  },
}

function SignalCard({
  row, currency, onRestock,
}: {
  row: ShiftIntelligenceRow
  currency: string
  onRestock: (variantId: string, qty: number) => void
}) {
  const isDepletion = row.signal_type === 'depletion_risk'
  const isCritical  = isDepletion && row.days_until_zero !== null && row.days_until_zero <= 3
  const isWarning   = isDepletion && row.days_until_zero !== null && row.days_until_zero <= 14 && !isCritical

  const meta = SIGNAL_META[row.signal_type]

  const label = row.variant_name !== 'Standard'
    ? `${row.product_name} — ${row.variant_name}`
    : row.product_name

  return (
    <div className={cn('rounded-lg border px-3 py-2.5 space-y-1.5', meta.borderClass(isCritical, isWarning))}>
      <div className="flex items-start gap-2">
        <div className={cn('mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full', meta.iconClass(isCritical, isWarning))}>
          <Icon icon={meta.icon} size={10} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-snug truncate">{label}</p>
          {isDepletion && row.days_until_zero !== null && (
            <p className={cn(
              'text-xs font-bold tabular-nums',
              isCritical ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400',
            )}>
              ~{String(Math.round(row.days_until_zero))}d supply left
              {row.days_band !== null && row.days_band > 0 && (
                <span className="ml-1 font-normal text-muted-foreground">
                  ±{String(Math.round(row.days_band))}d
                </span>
              )}
            </p>
          )}
          {row.signal_type === 'waste_spike' && (
            <p className="text-xs font-bold tabular-nums text-orange-700 dark:text-orange-400">
              Consumption spike detected
            </p>
          )}
          {row.signal_type === 'dead_stock' && (
            <p className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-400">
              Capital locked — no movement
            </p>
          )}
          {row.signal_type === 'cost_at_risk' && (
            <p className="text-xs font-bold tabular-nums text-purple-700 dark:text-purple-400">
              Expiry risk · {formatCurrency(row.cost_at_risk, currency)} exposed
            </p>
          )}
        </div>

        <span className={cn(
          'flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums uppercase tracking-wide',
          meta.pillClass(isCritical, isWarning),
        )}>
          {String(Math.round(row.urgency_score * 100))}%
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed pl-7">
        {row.signal_note}
      </p>

      <div className="flex items-center justify-between gap-2 pl-7">
        <div className="flex items-center gap-3">
          <ConfidenceBar value={row.confidence} />
          {row.cost_at_risk > 0 && row.signal_type !== 'cost_at_risk' && (
            <span className="text-[10px] text-muted-foreground">
              {formatCurrency(row.cost_at_risk, currency)} at risk
            </span>
          )}
        </div>

        {isDepletion && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => { onRestock(row.variant_id, Math.ceil(row.avg_daily * 30)) }}
          >
            Restock
          </Button>
        )}
      </div>

      <p className="text-[9px] text-muted-foreground/60 pl-7 font-mono">{row.basis}</p>
    </div>
  )
}

interface IntelligencePanelProps {
  currency: string
  onRestock: (variantId: string, qty: number) => void
}

export function IntelligencePanel({ currency, onRestock }: IntelligencePanelProps) {
  const navigate = useNavigate()
  const { data: signals = [], isLoading } = useShiftIntelligence(30)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
          <Icon icon="predictive-analysis" size={10} className="text-orange-500" />
          Eye · Intelligence
        </p>
        <button
          onClick={() => { void navigate('/reports?tab=forecast') }}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
        >
          All <Icon icon="arrow-right" size={10} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
        </div>
      ) : signals.length === 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50/40 dark:border-green-800 dark:bg-green-950/20 px-3 py-3 text-center">
          <p className="text-xs font-medium text-green-700 dark:text-green-400">All signals clear</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            No depletion risks, consumption spikes, dead stock, or expiry exposure
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((row) => (
            <SignalCard
              key={`${row.signal_type}-${row.variant_id}`}
              row={row}
              currency={currency}
              onRestock={onRestock}
            />
          ))}
        </div>
      )}
    </div>
  )
}

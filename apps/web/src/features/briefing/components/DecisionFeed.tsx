import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { CheckCircle2, RefreshCw, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBriefingActions } from '@/features/briefing/hooks'
import { BAND, BAND_CFG } from './constants'
import { ActionCard } from './ActionCard'
import type { BriefingAction } from '@beacon/types'

function PriorityGroup({
  band, actions, currency,
}: {
  band: 'act' | 'monitor' | 'info'
  actions: BriefingAction[]
  currency: string
}) {
  const cfg = BAND_CFG[band]
  const [open, setOpen] = useState(band !== 'info')

  if (actions.length === 0) return null

  return (
    <div className={cn('rounded-lg border overflow-hidden', cfg.dividerCls)}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <span className={cn('text-xs font-semibold uppercase tracking-wider', cfg.labelCls)}>
          {cfg.label}
        </span>
        <span className={cn('text-xs font-bold tabular-nums ml-auto', cfg.labelCls)}>
          {actions.length}
        </span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div>
          {actions.map((a, i) => (
            <ActionCard key={`${a.action_type}-${a.entity_id ?? String(i)}`} action={a} currency={currency} />
          ))}
        </div>
      )}
    </div>
  )
}

export function DecisionFeed({ currency }: { currency: string }) {
  const { data: actions = [], isLoading, dataUpdatedAt, refetch, isRefetching } = useBriefingActions()

  const sortBand = (items: BriefingAction[]) =>
    [...items].sort((a, b) => b.correlation_score - a.correlation_score)

  const nonProposals = actions.filter((a) => a.action_type !== 'restock_proposal')
  const actNow   = sortBand(nonProposals.filter((a) => BAND(a.priority) === 'act'))
  const monitor  = sortBand(nonProposals.filter((a) => BAND(a.priority) === 'monitor'))
  const info     = sortBand(nonProposals.filter((a) => BAND(a.priority) === 'info'))

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            {isLoading ? 'Loading…' : nonProposals.length === 0 ? 'All clear' : `${String(nonProposals.length)} item${nonProposals.length > 1 ? 's' : ''} need attention`}
          </h2>
          {lastUpdated && !isLoading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => { void refetch() }}
          disabled={isRefetching}
          title="Refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Checking all layers…</span>
        </div>
      )}

      {!isLoading && nonProposals.length === 0 && (
        <div className="rounded-lg border bg-muted/10 px-6 py-10 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500/60" />
          <p className="text-sm font-medium">No action required right now</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            Stock levels are above par, no invoice discrepancies pending, no expiry warnings,
            and write-off patterns are within baseline.
          </p>
          {lastUpdated && (
            <p className="text-[10px] text-muted-foreground/60">
              Based on live data · {format(lastUpdated, 'HH:mm')}
            </p>
          )}
        </div>
      )}

      {!isLoading && nonProposals.length > 0 && (
        <>
          <PriorityGroup band="act"     actions={actNow}  currency={currency} />
          <PriorityGroup band="monitor" actions={monitor} currency={currency} />
          <PriorityGroup band="info"    actions={info}    currency={currency} />
        </>
      )}
    </div>
  )
}

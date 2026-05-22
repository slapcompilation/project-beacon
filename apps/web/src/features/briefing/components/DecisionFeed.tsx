import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Button, Icon, Intent, NonIdealState, Spinner, SpinnerSize } from '@blueprintjs/core'
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
        <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={14} className="text-muted-foreground" />
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
          variant="minimal"
          size="small"
          icon="refresh"
          onClick={() => { void refetch() }}
          disabled={isRefetching}
          loading={isRefetching}
          title="Refresh"
          aria-label="Refresh"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
          <span className="text-xs">Checking all layers…</span>
        </div>
      )}

      {!isLoading && nonProposals.length === 0 && (
        <NonIdealState
          icon="tick-circle"
          title="No action required right now"
          description={
            <>
              Stock levels are above par, no invoice discrepancies pending, no expiry warnings,
              and write-off patterns are within baseline.
              {lastUpdated && (
                <p className="text-[10px] text-muted-foreground/60 mt-2">
                  Based on live data · {format(lastUpdated, 'HH:mm')}
                </p>
              )}
            </>
          }
        />
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

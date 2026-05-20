// "Why did this happen?" drawer. Renders get_causal_trace() output for any node.

import { formatDistanceToNow, format } from 'date-fns'
import { Drawer, Icon, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useCausalTrace, type TraceRootType } from '@/features/graph/hooks'
import type { CausalTraceStep } from '@beacon/types'

const NODE_STYLE: Record<string, { icon: IconName; color: string; bg: string }> = {
  notification:    { icon: 'notifications',  color: 'text-yellow-600',       bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
  stock_log:       { icon: 'box',            color: 'text-orange-600',       bg: 'bg-orange-50 dark:bg-orange-950/30' },
  restock_request: { icon: 'shopping-cart',  color: 'text-blue-600',         bg: 'bg-blue-50 dark:bg-blue-950/30' },
  restock_receive: { icon: 'truck',          color: 'text-green-600',        bg: 'bg-green-50 dark:bg-green-950/30' },
  variant:         { icon: 'box',            color: 'text-slate-600',        bg: 'bg-slate-50 dark:bg-slate-950/30' },
  _default:        { icon: 'graph',          color: 'text-muted-foreground', bg: 'bg-muted/40' },
}

function nodeStyle(nodeType: string) {
  return NODE_STYLE[nodeType] ?? NODE_STYLE._default
}

const STEP_BORDER: Record<number, string> = {
  0: 'border-primary/40 bg-primary/5',
  1: '',
  2: '',
  3: 'opacity-80',
  4: 'opacity-60',
}

function TraceStep({ step, isLast }: { step: CausalTraceStep; isLast: boolean }) {
  const style = nodeStyle(step.node_type)
  const isRoot = step.step === 0

  return (
    <div className="relative flex gap-3">
      {!isLast && (
        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
      )}

      <div className={cn(
        'relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border',
        isRoot ? 'border-primary/40 bg-primary/10' : `border-border ${style.bg}`,
      )}>
        <Icon icon={style.icon} size={14} className={style.color} />
      </div>

      <div className={cn(
        'mb-4 flex-1 rounded-lg border p-3',
        isRoot ? 'border-primary/30 bg-primary/5' : 'border-border',
        STEP_BORDER[step.step] ?? '',
      )}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className={cn(
            'text-xs font-semibold',
            isRoot ? 'text-primary' : style.color,
          )}>
            {step.event_label}
          </span>
          <span
            className="text-[10px] text-muted-foreground flex-shrink-0"
            title={format(new Date(step.happened_at), 'PPpp')}
          >
            {formatDistanceToNow(new Date(step.happened_at), { addSuffix: true })}
          </span>
        </div>

        <p className="text-xs leading-relaxed">{step.description}</p>

        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {step.actor !== 'System' && step.actor !== 'Reality Graph' && (
            <span className="text-[10px] text-muted-foreground">
              by <span className="font-medium">{step.actor}</span>
            </span>
          )}
          {step.causal_link && (
            <span className="text-[10px] text-muted-foreground/60 italic">
              {step.causal_link}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export interface CausalTracePanelProps {
  open:     boolean
  onClose:  () => void
  rootType: TraceRootType | null
  rootId:   string | null
  /** Short label shown in the panel header, e.g. "Consumption Spike — Towels" */
  title?:   string
}

export function CausalTracePanel({
  open,
  onClose,
  rootType,
  rootId,
  title,
}: CausalTracePanelProps) {
  const { data: steps = [], isLoading, error } = useCausalTrace(
    open ? rootType : null,
    open ? rootId  : null,
  )

  const grouped = steps.reduce<Map<number, CausalTraceStep[]>>((acc, s) => {
    const list = acc.get(s.step) ?? []
    list.push(s)
    acc.set(s.step, list)
    return acc
  }, new Map())

  const ordered = Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .flatMap(([, list]) => list)

  const stepCount = steps.length

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      position="right"
      size="28rem"
      title={
        <div className="flex items-center gap-2 min-w-0">
          <Icon icon="git-branch" size={14} className="text-muted-foreground flex-shrink-0" />
          <span>Why did this happen?</span>
          {title && <span className="text-xs text-muted-foreground truncate ml-2">{title}</span>}
        </div>
      }
      className="!p-0"
    >
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
            <p className="text-xs">Traversing graph…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <Icon icon="error" size={24} intent={Intent.DANGER} />
            <p className="text-sm text-destructive">Failed to load trace</p>
            <p className="text-xs text-muted-foreground">{(error).message}</p>
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Icon icon="graph" size={32} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No trace data available</p>
            <p className="text-xs text-muted-foreground/60 max-w-[220px] leading-relaxed">
              Causal traces become richer as the Reality Graph accumulates edges
              from receive → consume → restock operations.
            </p>
          </div>
        ) : (
          <div>
            {ordered.map((step, i) => (
              <TraceStep
                key={`${String(step.step)}-${step.node_id}`}
                step={step}
                isLast={i === ordered.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {stepCount > 0 && (
        <div className="flex-shrink-0 border-t px-5 py-3">
          <p className="text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">{stepCount}</span> events in trace
            · based on Reality Graph traversal
            {rootType && (
              <span className="ml-1 opacity-50">· root: {rootType}</span>
            )}
          </p>
        </div>
      )}
    </Drawer>
  )
}

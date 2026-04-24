// Layer: Eye → Mind — Causal Trace Panel
// Given any Reality Graph node (notification, variant, restock_request),
// renders the explanation chain: "why did this happen?"
// Spine: get_causal_trace() graph traversal. No LLM required.
// Palantir principle: auditability as a first-class feature.

import { formatDistanceToNow, format } from 'date-fns'
import {
  X, Loader2, GitBranch,
  Package, ShoppingCart, Truck, Bell, Network,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCausalTrace, type TraceRootType } from '@/features/graph/hooks'
import type { CausalTraceStep } from '@beacon/types'

// ─── Node type → icon + colour ────────────────────────────────────────────────

const NODE_STYLE: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  notification:    { icon: Bell,         color: 'text-yellow-600',  bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
  stock_log:       { icon: Package,      color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-950/30' },
  restock_request: { icon: ShoppingCart, color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
  restock_receive: { icon: Truck,        color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-950/30' },
  variant:         { icon: Package,      color: 'text-slate-600',   bg: 'bg-slate-50 dark:bg-slate-950/30' },
  _default:        { icon: Network,      color: 'text-muted-foreground', bg: 'bg-muted/40' },
}

function nodeStyle(nodeType: string) {
  return NODE_STYLE[nodeType] ?? NODE_STYLE._default
}

// Step 0 (root) gets a special border treatment
const STEP_BORDER: Record<number, string> = {
  0: 'border-primary/40 bg-primary/5',
  1: '',
  2: '',
  3: 'opacity-80',
  4: 'opacity-60',
}

// ─── Single trace step ─────────────────────────────────────────────────────────

function TraceStep({ step, isLast }: { step: CausalTraceStep; isLast: boolean }) {
  const style = nodeStyle(step.node_type)
  const Icon = style.icon
  const isRoot = step.step === 0

  return (
    <div className="relative flex gap-3">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
      )}

      {/* Node icon */}
      <div className={cn(
        'relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border',
        isRoot ? 'border-primary/40 bg-primary/10' : `border-border ${style.bg}`,
      )}>
        <Icon className={cn('h-3.5 w-3.5', style.color)} />
      </div>

      {/* Content */}
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

// ─── Panel ─────────────────────────────────────────────────────────────────────

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

  // Group steps by step number, preserving insertion order within each group
  const grouped = steps.reduce<Map<number, CausalTraceStep[]>>((acc, s) => {
    const list = acc.get(s.step) ?? []
    list.push(s)
    acc.set(s.step, list)
    return acc
  }, new Map())

  // Flatten: root first (step 0), then steps 1-4 in ascending order
  const ordered = Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .flatMap(([, list]) => list)

  const stepCount = steps.length

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <SheetTitle className="text-sm font-semibold truncate">
                Why did this happen?
              </SheetTitle>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {title && (
            <p className="text-xs text-muted-foreground mt-1 truncate pl-6">{title}</p>
          )}
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-xs">Traversing graph…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="text-sm text-destructive">Failed to load trace</p>
              <p className="text-xs text-muted-foreground">{(error).message}</p>
            </div>
          ) : ordered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Network className="h-8 w-8 text-muted-foreground/30" />
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

        {/* Footer */}
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
      </SheetContent>
    </Sheet>
  )
}

// Layer: Flow — Visual Reality Graph directed-edge diagram
// Renders causal edges (consumes, restocks, reverts, triggered_alert) as
// typed [source node] ──edge──► [target node] rows.
// Revert chains are shown as indented children of the original event.

import { useMemo } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useVariantFlow } from '../hooks'
import type { RelationshipEdge } from '@beacon/types'

const EDGE_CFG: Record<string, { label: string; icon: IconName; card: string; badge: string }> = {
  consumes: {
    label: 'consumes',
    icon: 'trending-down',
    card: 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  },
  restocks: {
    label: 'restocks',
    icon: 'add-to-folder',
    card: 'border-green-200 bg-green-50/60 dark:border-green-800 dark:bg-green-950/20',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  },
  reverts: {
    label: 'reverts',
    icon: 'undo',
    card: 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  },
  triggered_alert: {
    label: 'triggered alert',
    icon: 'flash',
    card: 'border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  },
  causes: {
    label: 'causes',
    icon: 'arrow-right',
    card: 'border-purple-200 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-950/20',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  },
  belongs_to_session: {
    label: 'stocktake',
    icon: 'git-branch',
    card: 'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  },
}

function getEdgeCfg(type: string) {
  return EDGE_CFG[type] ?? {
    label: type,
    icon: 'arrow-right' as IconName,
    card: 'border-border bg-muted/20',
    badge: 'bg-muted text-muted-foreground',
  }
}

// ─── Node chips ───────────────────────────────────────────────────────────────

const NODE_CHIP: Record<string, { label: string; cls: string }> = {
  variant: {
    label: 'Variant',
    cls: 'bg-primary/10 text-primary border-primary/20',
  },
  stock_log: {
    label: 'Stock Log',
    cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  },
  restock_request: {
    label: 'Restock',
    cls: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-700',
  },
  alert: {
    label: 'Alert',
    cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700',
  },
  stocktake_session: {
    label: 'Stocktake',
    cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700',
  },
}

function NodeChip({ type, label }: { type: string; label?: string }) {
  const cfg = NODE_CHIP[type] ?? {
    label: type,
    cls: 'bg-muted text-muted-foreground border-border',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        cfg.cls,
      )}
    >
      {label ?? cfg.label}
    </span>
  )
}

// ─── Edge metadata line ───────────────────────────────────────────────────────

function EdgeMeta({ edge }: { edge: RelationshipEdge }) {
  const meta = edge.metadata
  if (!meta) return null

  const parts: string[] = []
  if (typeof meta.delta === 'number') {
    parts.push(`${meta.delta > 0 ? '+' : ''}${String(meta.delta)} units`)
  }
  if (typeof meta.quantity_received === 'number') {
    parts.push(`+${String(meta.quantity_received)} received`)
  }
  if (typeof meta.reason === 'string' && meta.reason) {
    parts.push(meta.reason)
  }

  if (parts.length === 0) return null
  return <span className="text-[11px] text-muted-foreground">{parts.join(' · ')}</span>
}

// ─── Single edge card ─────────────────────────────────────────────────────────

function EdgeCard({
  edge,
  isReverted,
  correctionEdge,
  variantName,
  depth = 0,
}: {
  edge: RelationshipEdge
  isReverted: boolean
  correctionEdge: RelationshipEdge | undefined
  variantName: string
  depth?: number
}) {
  const fmtDate = useDateFormat()
  const cfg = getEdgeCfg(edge.edge_type)

  const sourceLabel = edge.source_type === 'variant' ? variantName : undefined
  const targetLabel = edge.target_type === 'variant' ? variantName : undefined

  return (
    <div>
      <div
        className={cn(
          'rounded-lg border p-3 transition-opacity',
          cfg.card,
          isReverted && 'opacity-45',
        )}
      >
        {/* Node → edge → node header */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <NodeChip type={edge.source_type} label={sourceLabel} />

          {/* Edge connector */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="block h-px w-3 bg-current opacity-25" />
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                cfg.badge,
              )}
            >
              <Icon icon={cfg.icon} size={10} />
              {cfg.label}
            </span>
            <span className="block h-px w-3 bg-current opacity-25" />
            <span className="text-muted-foreground text-[10px]">›</span>
          </div>

          <NodeChip type={edge.target_type} label={targetLabel} />

          {isReverted && (
            <span className="ml-auto text-[10px] italic text-muted-foreground">undone</span>
          )}
        </div>

        {/* Metadata + timestamp */}
        <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
          <EdgeMeta edge={edge} />
          <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
            {`${fmtDate(new Date(edge.created_at))} · ${format(new Date(edge.created_at), 'HH:mm')}`}
          </span>
        </div>
      </div>

      {/* Correction edge — rendered inline, indented with a visual connector */}
      {correctionEdge && (
        <div className="ml-5 mt-1 flex gap-2">
          {/* Vertical connector line */}
          <div className="flex flex-col items-center">
            <div className="w-px flex-1 bg-amber-300 dark:bg-amber-700" />
            <Icon icon="undo" size={12} className="text-amber-500 shrink-0 my-0.5" />
          </div>
          <div className="flex-1 pb-1">
            <EdgeCard
              edge={correctionEdge}
              isReverted={false}
              correctionEdge={undefined}
              variantName={variantName}
              depth={depth + 1}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function GraphStats({ edges }: { edges: RelationshipEdge[] }) {
  const consumed = edges
    .filter((e) => e.edge_type === 'consumes')
    .reduce((sum, e) => {
      const d = e.metadata?.delta as number | undefined
      return sum + (d != null && d < 0 ? Math.abs(d) : 0)
    }, 0)

  const restocked = edges
    .filter((e) => e.edge_type === 'restocks')
    .reduce((sum, e) => {
      const q = e.metadata?.quantity_received as number | undefined
      return sum + (q ?? 0)
    }, 0)

  const corrections = edges.filter((e) => e.edge_type === 'reverts').length
  const eventCount = edges.filter((e) => e.edge_type !== 'reverts').length

  return (
    <div className="grid grid-cols-4 gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
      {(
        [
          {
            label: 'Consumed',
            value: consumed > 0 ? `-${String(consumed)}` : '—',
            color: consumed > 0 ? 'text-red-600 dark:text-red-400' : '',
          },
          {
            label: 'Restocked',
            value: restocked > 0 ? `+${String(restocked)}` : '—',
            color: restocked > 0 ? 'text-green-600 dark:text-green-400' : '',
          },
          { label: 'Events', value: String(eventCount), color: '' },
          {
            label: 'Corrections',
            value: String(corrections),
            color: corrections > 0 ? 'text-amber-600 dark:text-amber-400' : '',
          },
        ] as const
      ).map(({ label, value, color }) => (
        <div key={label} className="text-center">
          <p className={cn('text-sm font-bold tabular-nums', color)}>{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Story synthesis card ─────────────────────────────────────────────────────
// Synthesizes the edge history into natural language so operators immediately
// understand the causal sequence without reading every row.

function StorySummary({
  edges,
  variantName,
  currentStock,
}: {
  edges: RelationshipEdge[]
  variantName: string
  currentStock?: number
}) {
  const totalConsumed = edges
    .filter((e) => e.edge_type === 'consumes')
    .reduce((s, e) => {
      const d = e.metadata?.delta as number | undefined
      return s + (d != null && d < 0 ? Math.abs(d) : 0)
    }, 0)

  const totalRestocked = edges
    .filter((e) => e.edge_type === 'restocks')
    .reduce((s, e) => {
      const q = e.metadata?.quantity_received as number | undefined
      return s + (q ?? 0)
    }, 0)

  const corrections    = edges.filter((e) => e.edge_type === 'reverts').length
  const eventCount     = edges.filter((e) => e.edge_type !== 'reverts').length
  const alertsTriggered = edges.filter((e) => e.edge_type === 'triggered_alert').length

  const oldest = edges.reduce<string | null>((oldest, e) => {
    if (!oldest) return e.created_at
    return e.created_at < oldest ? e.created_at : oldest
  }, null)

  // Compose sentences
  const sentences: string[] = []

  if (eventCount > 0 && oldest) {
    sentences.push(
      `${String(eventCount)} event${eventCount !== 1 ? 's' : ''} recorded since ${formatDistanceToNow(new Date(oldest), { addSuffix: true })}.`
    )
  }

  if (totalConsumed > 0 && totalRestocked > 0) {
    sentences.push(`Consumed ${String(totalConsumed)} unit${totalConsumed !== 1 ? 's' : ''}, restocked ${String(totalRestocked)} unit${totalRestocked !== 1 ? 's' : ''}.`)
  } else if (totalConsumed > 0) {
    sentences.push(`Consumed ${String(totalConsumed)} unit${totalConsumed !== 1 ? 's' : ''} — no restocks yet.`)
  } else if (totalRestocked > 0) {
    sentences.push(`Restocked ${String(totalRestocked)} unit${totalRestocked !== 1 ? 's' : ''} — no consumption recorded.`)
  }

  if (corrections > 0) {
    sentences.push(`${String(corrections)} correction${corrections !== 1 ? 's' : ''} applied.`)
  }

  if (alertsTriggered > 0) {
    sentences.push(`${String(alertsTriggered)} alert${alertsTriggered !== 1 ? 's' : ''} triggered.`)
  }

  if (currentStock !== undefined) {
    if (currentStock === 0) {
      sentences.push('Currently out of stock.')
    } else {
      const net = totalRestocked - totalConsumed
      const trend = net > 0 ? 'net positive' : net < 0 ? 'net negative' : 'net neutral'
      sentences.push(`Balance: ${String(currentStock)} unit${currentStock !== 1 ? 's' : ''} (${trend} history).`)
    }
  }

  if (sentences.length === 0) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3">
      <Icon icon="book" size={14} className="text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
          Story · {variantName}
        </p>
        <p className="text-sm leading-relaxed text-foreground">
          {sentences.join(' ')}
        </p>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface FlowGraphProps {
  variantId: string
  variantName: string
  currentStock?: number
}

export function FlowGraph({ variantId, variantName, currentStock }: FlowGraphProps) {
  const { data: edges = [], isLoading } = useVariantFlow(variantId)

  // Revert logic:
  // A `reverts` edge: source_id = revert_log, target_id = original_log
  // A correction consumes edge: source_id = revert_log (same as reverts edge's source_id)

  // Set of stock_log IDs that were reverted (targets of reverts edges)
  const revertedLogIds = useMemo(
    () => new Set(edges.filter((e) => e.edge_type === 'reverts').map((e) => e.target_id)),
    [edges],
  )

  // Set of stock_log IDs that ARE corrections (sources of reverts edges)
  const correctionLogIds = useMemo(
    () => new Set(edges.filter((e) => e.edge_type === 'reverts').map((e) => e.source_id)),
    [edges],
  )

  // Map: original_log_id → revert_log_id
  const revertLogForOriginal = useMemo(
    () =>
      new Map(
        edges.filter((e) => e.edge_type === 'reverts').map((e) => [e.target_id, e.source_id]),
      ),
    [edges],
  )

  // Pre-index consumes edges by their source_id for fast lookup
  const consumesBySouceId = useMemo(
    () => new Map(edges.filter((e) => e.edge_type === 'consumes').map((e) => [e.source_id, e])),
    [edges],
  )

  // Top-level edges = all edges EXCEPT:
  //   - reverts edges (rendered inline as connectors)
  //   - correction consumes edges (rendered as children of their originals)
  const topLevel = useMemo(
    () =>
      edges.filter(
        (e) =>
          e.edge_type !== 'reverts' &&
          !(e.edge_type === 'consumes' && correctionLogIds.has(e.source_id)),
      ),
    [edges, correctionLogIds],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Loading graph…
      </div>
    )
  }

  if (edges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Icon icon="graph" size={32} className="text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">No graph edges yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Edges appear automatically after stock events — adjustments, restocks, and corrections are
          all recorded here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <StorySummary edges={edges} variantName={variantName} currentStock={currentStock} />
      <GraphStats edges={edges} />

      <div className="space-y-2">
        {topLevel.map((edge) => {
          // For a consumes edge, check if the original stock_log was later reverted
          const isReverted =
            edge.edge_type === 'consumes' && revertedLogIds.has(edge.source_id)

          // If reverted, find the correction consumes edge to show inline
          const correctionLogId = isReverted
            ? revertLogForOriginal.get(edge.source_id)
            : undefined
          const correctionEdge =
            correctionLogId != null ? consumesBySouceId.get(correctionLogId) : undefined

          return (
            <EdgeCard
              key={edge.id}
              edge={edge}
              isReverted={isReverted}
              correctionEdge={correctionEdge}
              variantName={variantName}
            />
          )
        })}
      </div>
    </div>
  )
}

// Reusable right-rail audit log for Object Views. Reads every
// relationship_edges row touching the node, renders them oldest-last so the
// rail reads as "what happened to this object, in order".
//
// CLAUDE.md mandates "the right rail always carries the audit log for that
// node" — this component implements that contract once, every Object View
// drops it in.

import { useMemo } from 'react'
import { Card, Icon, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import type { NodeType } from '@beacon/reality-graph'
import { useNodeEdges, type EdgeRow } from '@/hooks/useNodeEdges'

interface Props {
  nodeType: NodeType
  nodeId:   string
  /** Compact width — Object Views render at ~960px wide; 240px rail leaves room. */
  className?: string
}

export function AuditRail({ nodeType, nodeId, className }: Props) {
  const { data: rows = [], isLoading } = useNodeEdges(nodeType, nodeId)

  // Reverse-chronological feed already from the query; reverse for "earliest first"
  // so the eye reads top-to-bottom like a timeline.
  const events = useMemo(() => [...rows].reverse(), [rows])

  return (
    <aside className={className ?? 'w-60 shrink-0 hidden lg:flex flex-col'}>
      <header className="flex items-center gap-2 mb-2">
        <Icon icon="history" size={12} className="text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Audit</h3>
        {rows.length > 0 && (
          <Tag minimal className="text-[10px] ml-auto">{String(rows.length)}</Tag>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-4"><Spinner size={SpinnerSize.SMALL} /></div>
        ) : events.length === 0 ? (
          <Card className="text-[11px] text-muted-foreground italic">
            No audit edges yet. Decisions, refinements, and links to this object will appear here in chronological order.
          </Card>
        ) : (
          <ol className="space-y-1">
            {events.map((edge) => (
              <li key={edge.id}>
                <EdgeRow edge={edge} forNodeId={nodeId} forNodeType={nodeType} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  )
}

function EdgeRow({ edge, forNodeId, forNodeType }: { edge: EdgeRow; forNodeId: string; forNodeType: NodeType }) {
  const isOutgoing = edge.source_id === forNodeId && edge.source_type === forNodeType
  const peer = isOutgoing
    ? { type: edge.target_type, id: edge.target_id }
    : { type: edge.source_type, id: edge.source_id }

  return (
    <div className="border-l-2 border-border/40 pl-2 py-1 text-[11px]">
      <div className="flex items-center gap-1 flex-wrap">
        <Icon icon={isOutgoing ? 'arrow-right' : 'arrow-left'} size={9} className="text-muted-foreground" />
        <Tag minimal className="font-mono text-[9px]">{edge.edge_type}</Tag>
        <Tag minimal intent={triggerIntent(edge.triggered_by)} className="text-[9px]">{edge.triggered_by}</Tag>
      </div>
      <div className="text-muted-foreground mt-0.5 flex items-baseline gap-1 flex-wrap">
        <span>{isOutgoing ? '→' : '←'}</span>
        <span className="font-mono">{peer.type}</span>
        <span className="font-mono opacity-60 truncate" title={peer.id}>{peer.id.slice(0, 8)}</span>
      </div>
      <div className="text-muted-foreground/70 text-[10px] mt-0.5">
        {formatDistanceToNow(new Date(edge.created_at), { addSuffix: true })}
      </div>
    </div>
  )
}

function triggerIntent(triggeredBy: string) {
  switch (triggeredBy) {
    case 'user':                  return 'primary'  as const
    case 'ai_proposal_accepted':  return 'success'  as const
    case 'ai_auto_approved':      return 'warning'  as const
    case 'automation_threshold':  return 'warning'  as const
    case 'revert':                return 'danger'   as const
    case 'system':                return 'none'     as const
    default:                      return 'none'     as const
  }
}

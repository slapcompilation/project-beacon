// Layer: meta — graph connections panel
// Renders all relationship_edges touching a node as clickable typed chips.
// Grouped by edge type; audit-only edges (belongs_to_hotel, created_by) collapsed.
// Used by every object page to surface live ontology context.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useNodeEdges } from '@/hooks/useNodeEdges'
import { otherSide } from '@beacon/reality-graph'
import type { NodeType, EdgeType } from '@beacon/reality-graph'
import { objectPath, NODE_LABELS, EDGE_LABELS } from '@/lib/objectPresentation'


// ─── Edge type display labels ──────────────────────────────────────────────────


// Structural noise, collapsed by default. belongs_to_hotel and created_by were
// here too until migration 252 retired them — tenancy and authorship are columns.
const AUDIT_EDGES: EdgeType[] = ['belongs_to_session']

// Color accent per edge type
const EDGE_COLOR: Partial<Record<EdgeType, string>> = {
  causes:          'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  triggered_alert: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  restocks:         'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  fulfills:         'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  approved_by:      'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  rejected_by:      'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  reverts:          'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
  sourced_from:     'border-cyan-300 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400',
  linked_to_po:     'border-cyan-300 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400',
  invoiced_by:      'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
  influenced_by_occupancy:  'border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400',
  influenced_by_principle: 'border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400',
  similar_to:       'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400',
}

const DEFAULT_EDGE_COLOR = 'border-muted bg-muted/40 text-muted-foreground'

// ─── Node type label ────────────────────────────────────────────────────────


// ─── Single chip ──────────────────────────────────────────────────────────────

interface ChipProps {
  nodeId:   string
  nodeType: NodeType
  edgeType: EdgeType
  createdAt: string
  role:     'source' | 'target'
}

function EdgeChip({ nodeId, nodeType, edgeType, createdAt, role }: ChipProps) {
  const path = objectPath(nodeType, nodeId)
  const nodeLabel = NODE_LABELS[nodeType]
  const colorCls = EDGE_COLOR[edgeType] ?? DEFAULT_EDGE_COLOR
  const shortId = nodeId.slice(0, 8)
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true })

  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
        colorCls,
        path && 'hover:opacity-80 cursor-pointer',
      )}
      title={`${nodeType}:${nodeId} · ${timeAgo} · ${role}`}
    >
      <span className="opacity-60">{nodeLabel}</span>
      <span className="font-mono opacity-50">{shortId}</span>
    </span>
  )

  if (path) {
    return <Link to={path}>{content}</Link>
  }
  return content
}

// ─── Edge group ───────────────────────────────────────────────────────────────

interface GroupProps {
  edgeType:  EdgeType
  edges:     ReturnType<typeof useNodeEdges>['data']
  nodeId:    string
}

function EdgeGroup({ edgeType, edges = [], nodeId }: GroupProps) {
  const label = EDGE_LABELS[edgeType]

  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 min-w-[6rem] flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {edges.map((edge) => {
          const other = otherSide(edge, nodeId)
          return (
            <EdgeChip
              key={edge.id}
              nodeId={other.id}
              nodeType={other.type}
              edgeType={edge.edge_type}
              createdAt={edge.created_at}
              role={other.role}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GraphConnectionsProps {
  nodeType: NodeType
  nodeId:   string
  className?: string
}

export function GraphConnections({ nodeType, nodeId, className }: GraphConnectionsProps) {
  const { data: edges = [], isLoading } = useNodeEdges(nodeType, nodeId)
  const [auditOpen, setAuditOpen] = useState(false)

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
        <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
        Loading connections…
      </div>
    )
  }

  if (edges.length === 0) {
    return (
      <div className={cn('text-xs text-muted-foreground/50 italic', className)}>
        No edges recorded for this node yet.
      </div>
    )
  }

  // Partition into signal vs audit
  const signalEdges = edges.filter((e) => !AUDIT_EDGES.includes(e.edge_type))
  const auditEdges  = edges.filter((e) => AUDIT_EDGES.includes(e.edge_type))

  // Group signal edges by type
  const grouped = signalEdges.reduce<Partial<Record<EdgeType, typeof edges>>>((acc, edge) => {
    const key = edge.edge_type
    if (!acc[key]) acc[key] = []
    acc[key].push(edge)
    return acc
  }, {})

  const edgeTypes = Object.keys(grouped) as EdgeType[]

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icon icon="git-branch" size={14} />
        Graph connections
        <span className="ml-auto font-normal text-[10px] text-muted-foreground/50">
          {edges.length} edge{edges.length !== 1 ? 's' : ''}
        </span>
      </div>

      {edgeTypes.length === 0 && (
        <p className="text-xs text-muted-foreground/50 italic">Only audit edges present.</p>
      )}

      <div className="space-y-1.5">
        {edgeTypes.map((et) => (
          <EdgeGroup key={et} edgeType={et} edges={grouped[et]} nodeId={nodeId} />
        ))}
      </div>

      {auditEdges.length > 0 && (
        <div className="pt-1 border-t border-dashed">
          <button
            type="button"
            onClick={() => { setAuditOpen((v) => !v); }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <Icon icon={auditOpen ? 'chevron-down' : 'chevron-right'} size={12} />
            Audit edges ({auditEdges.length})
          </button>
          {auditOpen && (
            <div className="mt-1.5 space-y-1.5">
              {(Object.keys(
                auditEdges.reduce<Partial<Record<EdgeType, typeof edges>>>((acc, e) => {
                  const existing = acc[e.edge_type]
                  if (!existing) { acc[e.edge_type] = [e]; return acc }
                  existing.push(e)
                  return acc
                }, {})
              ) as EdgeType[]).map((et) => (
                <EdgeGroup
                  key={et}
                  edgeType={et}
                  edges={auditEdges.filter((e) => e.edge_type === et)}
                  nodeId={nodeId}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

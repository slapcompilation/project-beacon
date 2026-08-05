// LLM-proposed entity links queue. Suggestions are produced by running
// "Suggest entity links" on a Document (the entity-extract edge fn). Operator
// approves → describes_entity edge writes into the graph; reject → row closes.

import { Link } from 'react-router-dom'
import { Button, Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import {
  useApproveSuggestion,
  usePendingEntityLinkSuggestions,
  useRejectSuggestion,
} from '@/features/entityLinks/hooks'
import type { EntityLinkSuggestionEnriched } from '@/features/entityLinks/api'

export default function EntityLinkSuggestionsPage() {
  const { data: rows = [], isLoading, isError, refetch, isFetching } = usePendingEntityLinkSuggestions()
  const approve = useApproveSuggestion()
  const reject  = useRejectSuggestion()

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }
  if (isError) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to load suggestions"
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            Entity Link Suggestions
            {rows.length > 0 && (
              <Tag minimal intent={Intent.WARNING}>{String(rows.length)} pending</Tag>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            LLM-proposed describes_entity edges. Approve to write the edge into the graph; reject to close the suggestion.
          </p>
        </div>
        <Button
          variant="minimal"
          size="small"
          icon="refresh"
          loading={isFetching}
          onClick={() => { void refetch() }}
        >
          Refresh
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {rows.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="search-template" size={32} className="text-muted-foreground/40" />}
            title="No entity links to review"
            description="Suggestions appear here after you open a Document and run “Suggest entity links”. Each is an LLM-proposed describes_entity edge with its evidence — approve to write it into the graph, reject to dismiss."
            action={
              <Link to="/documents">
                <Button intent={Intent.PRIMARY} icon="document">Go to Documents</Button>
              </Link>
            }
          />
        ) : (
          rows.map((row) => (
            <SuggestionRow
              key={row.id}
              row={row}
              busy={approve.isPending || reject.isPending}
              onApprove={() => { approve.mutate(row) }}
              onReject={() => { reject.mutate(row) }}
            />
          ))
        )}
      </div>
    </div>
  )
}

function SuggestionRow({
  row, busy, onApprove, onReject,
}: {
  row: EntityLinkSuggestionEnriched
  busy: boolean
  onApprove: () => void
  onReject:  () => void
}) {
  const borderClass =
    row.confidence >= 0.85 ? 'border-l-emerald-500' :
    row.confidence >= 0.65 ? 'border-l-amber-400'   :
    'border-l-red-500'

  return (
    <Card className={`flex flex-col gap-3 border-l-2 ${borderClass}`}>
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={Intent.PRIMARY} className="font-mono">{row.entity_type}</Tag>
          <Tag minimal>{Math.round(row.confidence * 100)}%</Tag>
          {row.chunk_key && <Tag minimal icon="layers">{row.chunk_key}</Tag>}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
        </span>
      </header>

      <p className="text-sm">{row.reasoning}</p>

      {row.evidence_snippet && (
        <blockquote className="text-xs text-muted-foreground italic border-l-2 border-border/40 pl-3 leading-relaxed">
          "{row.evidence_snippet}"
        </blockquote>
      )}

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <div className="flex items-baseline gap-1.5">
          <Icon icon="document" size={11} />
          <Link to={`/documents/${row.document_id}`} className="hover:underline">
            {row.document_title ?? row.document_id}
          </Link>
        </div>
        <div className="flex items-baseline gap-1.5">
          <Icon icon="cube" size={11} />
          <Link to={entityPath(row.entity_type, row.entity_id)} className="font-mono hover:underline">
            {row.entity_id}
          </Link>
        </div>
      </div>

      <footer className="flex items-center justify-end gap-2">
        <Button
          intent={Intent.DANGER}
          variant="minimal"
          icon="cross"
          disabled={busy}
          onClick={onReject}
        >
          Reject
        </Button>
        <Button
          intent={Intent.PRIMARY}
          icon="tick"
          loading={busy}
          onClick={onApprove}
        >
          Approve &amp; link
        </Button>
      </footer>
    </Card>
  )
}

function entityPath(type: string, id: string): string {
  switch (type) {
    case 'variant':         return `/objects/variant/${id}`
    case 'supplier':        return `/objects/supplier/${id}`
    case 'product':         return `/objects/product/${id}`
    case 'purchase_order':  return `/objects/purchase_order/${id}`
    case 'restock_request': return `/objects/restock_request/${id}`
    case 'case':            return `/cases/${id}`
    default:                return '#'
  }
}

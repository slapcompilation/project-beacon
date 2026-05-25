// Approved Answers — tier-1 cache management.
//
// Every curated Q/A pair shows its hit count + when it last served.
// High-hit entries surface to the top so operators can spot the
// stable-knowledge subset of their cache. Retire to stop serving it.

import { Button, Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import {
  useApprovedAnswers,
  useRetireApprovedAnswer,
} from '@/features/approvedAnswers/hooks'
import type { ApprovedAnswerRow } from '@/features/approvedAnswers/api'

export default function ApprovedAnswersPage() {
  const { data: rows = [], isLoading, isError, refetch, isFetching } = useApprovedAnswers()
  const retire = useRetireApprovedAnswer()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
      </div>
    )
  }

  if (isError) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to load approved answers"
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }

  const totalHits = rows.reduce((s, r) => s + r.hit_count, 0)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            Approved Answers
            {rows.length > 0 && <Tag minimal intent={Intent.PRIMARY}>{String(rows.length)} cached</Tag>}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tier-1 cache. The copilot checks here first; a similar enough question gets the cached answer instead of a fresh LLM call.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span><span className="font-semibold text-foreground">{String(totalHits)}</span> total hits</span>
          <Button variant="minimal" size="small" icon="refresh" loading={isFetching} onClick={() => { void refetch() }}>Refresh</Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {rows.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="bookmark" size={32} className="text-muted-foreground/40" />}
            title="No curated answers yet"
            description='Open a copilot reply and click "Curate this answer" to add it. The next similar question gets served from cache instead of hitting the LLM.'
          />
        ) : (
          rows.map((row) => (
            <AnswerRow
              key={row.id}
              row={row}
              busy={retire.isPending}
              onRetire={() => { retire.mutate(row.id) }}
            />
          ))
        )}
      </div>

      {rows.length > 0 && (
        <div className="shrink-0 border-t px-4 py-2 bg-muted/20 text-[10px] text-muted-foreground">
          Similarity threshold: Jaccard ≥ 0.60 (v1 text-overlap). pgvector + cosine similarity arrives in Phase 14.b; the embedding_ref column is reserved so the upgrade is additive.
        </div>
      )}
    </div>
  )
}

function AnswerRow({
  row, busy, onRetire,
}: {
  row: ApprovedAnswerRow
  busy: boolean
  onRetire: () => void
}) {
  return (
    <Card className="flex flex-col gap-2 border-l-2 border-l-emerald-500">
      <header className="flex items-center gap-2 flex-wrap">
        <Icon icon="bookmark" size={12} className="text-emerald-500" />
        <Tag minimal intent={Intent.SUCCESS} icon="cube">
          {String(row.hit_count)} hit{row.hit_count === 1 ? '' : 's'}
        </Tag>
        {row.last_served_at && (
          <span className="text-[11px] text-muted-foreground">
            last served {formatDistanceToNow(new Date(row.last_served_at), { addSuffix: true })}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">
          curated {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
        </span>
      </header>

      <section className="space-y-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Question</h4>
        <p className="text-sm">{row.question}</p>
      </section>

      <section className="space-y-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Answer</h4>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{row.answer}</p>
      </section>

      <footer className="flex items-center justify-end gap-2">
        <Button
          variant="minimal"
          intent={Intent.DANGER}
          icon="archive"
          size="small"
          disabled={busy}
          onClick={onRetire}
        >
          Retire
        </Button>
      </footer>
    </Card>
  )
}

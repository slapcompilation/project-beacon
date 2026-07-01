// Ontology — the self-evolving graph. Beacon scans your data for typed concepts
// the ontology doesn't capture yet (a removal_category sitting in free text) and
// proposes typed extensions. Approving one grows the ontology — auditably, under
// your review: the decision persists in ontology_proposals and the value becomes
// a recognized type the detector stops re-proposing. Detection runs live in
// reality-graph's detect_ontology_gaps Logic Tool.

import {
  Button, Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import type { DetectOntologyGapsOutput } from '@beacon/reality-graph'
import { useApprovedExtensions, useDecideOntologyGap, useOntologyGaps } from '@/features/ontology/hooks'
import type { OntologyProposalRow } from '@/features/ontology/api'

type Gap = DetectOntologyGapsOutput['gaps'][number]

export default function OntologyPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useOntologyGaps()
  const { data: extensions = [] } = useApprovedExtensions()
  const decide = useDecideOntologyGap()

  // A real error gets the retry state; "no data yet" (loading or scope resolving)
  // just shows the spinner — not a scary "failed to scan".
  if (isError) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to scan the ontology"
        description={error instanceof Error ? error.message : undefined}
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }
  if (isLoading || !data) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }

  const { gaps, scanned } = data
  const pendingFor = (proposed: string, status: 'approved' | 'rejected') =>
    decide.isPending && decide.variables.gap.proposed === proposed && decide.variables.status === status

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold">Ontology</h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Beacon watches your data for typed concepts the ontology doesn't capture yet. Approving a
            proposal grows the ontology — under your review, never on its own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{scanned.toLocaleString()} stock movements scanned</span>
          <Button variant="minimal" size="small" icon="refresh" loading={isFetching} onClick={() => { void refetch() }}>Refresh</Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {gaps.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="graph" size={32} className="text-muted-foreground/40" />}
            title="No open ontology gaps"
            description={
              `Scanned ${scanned.toLocaleString()} stock movements — every recurring pattern is either already typed, ` +
              `approved below, or dismissed. New patterns surface here as they accumulate.`
            }
          />
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Proposed typed extensions
            </p>
            {gaps.map((g) => (
              <GapCard
                key={`${g.targetField}:${g.proposed}`}
                gap={g}
                busy={decide.isPending}
                approving={pendingFor(g.proposed, 'approved')}
                dismissing={pendingFor(g.proposed, 'rejected')}
                onApprove={() => { decide.mutate({ gap: g, status: 'approved' }) }}
                onDismiss={() => { decide.mutate({ gap: g, status: 'rejected' }) }}
              />
            ))}
          </>
        )}

        {extensions.length > 0 && <GrownOntology rows={extensions} />}
      </div>
    </div>
  )
}

function GapCard({
  gap, busy, approving, dismissing, onApprove, onDismiss,
}: {
  gap: Gap
  busy: boolean
  approving: boolean
  dismissing: boolean
  onApprove: () => void
  onDismiss: () => void
}) {
  const border =
    gap.confidence >= 0.85 ? 'border-l-emerald-500' :
    gap.confidence >= 0.6  ? 'border-l-amber-400'   :
    'border-l-red-500'
  const isEdge = gap.kind === 'new_edge_type'

  return (
    <Card className={`flex flex-col gap-3 border-l-2 ${border}`}>
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={Intent.PRIMARY} icon={isEdge ? 'link' : 'plus'}>{isEdge ? 'new edge type' : 'new category'}</Tag>
          <span className="font-mono text-sm font-semibold">{gap.proposed}</span>
          <Icon icon="arrow-right" size={11} className="text-muted-foreground" />
          <Tag minimal className="font-mono !text-[10px]">{gap.targetType}.{gap.targetField}</Tag>
        </div>
        <Tag minimal intent={gap.confidence >= 0.85 ? Intent.SUCCESS : gap.confidence >= 0.6 ? Intent.WARNING : Intent.DANGER}>
          {Math.round(gap.confidence * 100)}% confidence
        </Tag>
      </header>

      <p className="text-sm">{gap.rationale}</p>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">{gap.evidence.occurrences.toLocaleString()}</span>
          {' / '}{gap.evidence.totalConsidered.toLocaleString()} {isEdge ? 'edges' : 'untyped movements'}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden max-w-[200px]">
          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${String(Math.round(gap.evidence.coverage * 100))}%` }} />
        </div>
        <span className="tabular-nums">{Math.round(gap.evidence.coverage * 100)}% coverage</span>
      </div>

      {!isEdge && gap.evidence.examples.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">e.g.</span>
          {gap.evidence.examples.map((ex) => (
            <Tag key={ex} minimal className="!text-[10px] italic">"{ex}"</Tag>
          ))}
        </div>
      )}

      <footer className="flex items-center justify-end gap-2 border-t border-border/40 pt-2">
        <Button variant="minimal" size="small" icon="cross" disabled={busy} loading={dismissing} onClick={onDismiss}>
          Dismiss
        </Button>
        <Button intent={Intent.PRIMARY} size="small" icon="tick" disabled={busy} loading={approving} onClick={onApprove}>
          Approve &amp; type
        </Button>
      </footer>
    </Card>
  )
}

function GrownOntology({ rows }: { rows: OntologyProposalRow[] }) {
  return (
    <Card className="flex flex-col gap-2 mt-2">
      <div className="flex items-center gap-2">
        <Icon icon="confirm" size={13} className="text-emerald-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Recognized extensions — the ontology you've grown
        </p>
      </div>
      <div className="divide-y divide-border/40">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold">{r.proposed}</span>
              <Icon icon="arrow-right" size={10} className="text-muted-foreground" />
              <Tag minimal className="font-mono !text-[10px]">{r.target_type}.{r.target_field}</Tag>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">
              approved {formatDistanceToNow(new Date(r.decided_at), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

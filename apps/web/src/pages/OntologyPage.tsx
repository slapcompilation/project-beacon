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
import type { DetectOntologyGapsOutput, NodeType } from '@beacon/reality-graph'
import { actionDescriptors, LIFECYCLES } from '@beacon/reality-graph'
import { NODE_LABELS, EDGE_LABELS, OBJECT_PRESENTATION } from '@/lib/objectPresentation'
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

        <VocabularySection />
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
    <Card data-testid={`gap-${gap.proposed}`} className={`flex flex-col gap-3 border-l-2 ${border}`}>
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

// The vocabulary the graph speaks TODAY, read from the live registries — the
// exhaustive NODE/EDGE label records and the action descriptors. Nothing here
// is hand-written; when the ontology grows, the compiler grows this page.
function VocabularySection() {
  const nodeTypes = Object.entries(NODE_LABELS)
  const edgeTypes = Object.entries(EDGE_LABELS)
  const actions = Object.entries(actionDescriptors)
  const pres = OBJECT_PRESENTATION as Partial<Record<NodeType, { icon: import('@blueprintjs/icons').IconName }>>

  return (
    <section className="space-y-3 pt-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Current vocabulary — from the live registries
      </p>

      <Card compact className="!p-0">
        <VocabHeader icon="cube" title="Node types" count={nodeTypes.length} hint="What kinds of things exist. Types with an icon have a full Object View." />
        <div className="flex flex-wrap gap-1.5 p-3">
          {nodeTypes.map(([name, label]) => {
            const p = pres[name as NodeType]
            return (
              <Tag key={name} minimal icon={p ? <Icon icon={p.icon} size={11} /> : undefined} title={name}>
                {label}
              </Tag>
            )
          })}
        </div>
      </Card>

      <Card compact className="!p-0">
        <VocabHeader icon="flow-linear" title="Edge types" count={edgeTypes.length} hint="How things connect — every relationship is named, never a bare foreign key." />
        <div className="flex flex-wrap gap-1.5 p-3">
          {edgeTypes.map(([name, label]) => (
            <Tag key={name} minimal className="font-mono text-[10px]" title={label}>{name}</Tag>
          ))}
        </div>
      </Card>

      <Card compact className="!p-0">
        <VocabHeader icon="flow-branch" title="Lifecycles" count={Object.keys(LIFECYCLES).length} hint="How stateful things move — enforced at the database boundary, illegal transitions refused." />
        <ul className="divide-y divide-border/30">
          {Object.entries(LIFECYCLES).map(([node, machine]) => (
            <li key={node} className="px-3 py-2 text-xs space-y-0.5">
              <span className="font-mono text-[10px] text-muted-foreground">{node}</span>
              {Object.entries(machine).map(([from, next]) => (
                <div key={from} className="flex items-baseline gap-1.5 pl-3 font-mono text-[10px]">
                  <span>{from}</span>
                  <Icon icon="arrow-right" size={9} className="text-muted-foreground/50 self-center" />
                  {next.length > 0
                    ? <span className="text-muted-foreground">{next.join(' · ')}</span>
                    : <Tag minimal className="!text-[9px]">terminal</Tag>}
                </div>
              ))}
            </li>
          ))}
        </ul>
      </Card>

      <Card compact className="!p-0">
        <VocabHeader icon="take-action" title="Actions" count={actions.length} hint="What can be done — every write flows through one of these, audited." />
        <ul className="divide-y divide-border/30">
          {actions.map(([type, d]) => (
            <li key={type} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-muted-foreground w-44 shrink-0 truncate" title={type}>{type}</span>
              <span className="flex-1 truncate">{d.title}</span>
              <Tag minimal intent={d.invocationMode === 'apply-immediately' ? Intent.SUCCESS : Intent.NONE} className="text-[9px]">
                {d.invocationMode}
              </Tag>
              <Tag minimal className="text-[9px]">{d.approvalTier}</Tag>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}

function VocabHeader({ icon, title, count, hint }: { icon: import('@blueprintjs/icons').IconName; title: string; count: number; hint: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
      <Icon icon={icon} size={12} className="text-muted-foreground" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
      <Tag minimal className="text-[10px]">{count}</Tag>
      <span className="text-[11px] text-muted-foreground/70 ml-1 truncate">{hint}</span>
    </div>
  )
}

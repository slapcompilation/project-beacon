// Ontology — the self-evolving graph, step 1. Beacon scans your data for typed
// concepts the ontology doesn't capture yet (a removal_category sitting in free
// text today) and proposes typed extensions with evidence + confidence. The
// graph grows under your review, never on its own; detection runs in
// reality-graph's detect_ontology_gaps Logic Tool.

import {
  Button, Callout, Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag, Tooltip,
} from '@blueprintjs/core'
import type { DetectOntologyGapsOutput } from '@beacon/reality-graph'
import { useOntologyGaps } from '@/features/ontology/hooks'

type Gap = DetectOntologyGapsOutput['gaps'][number]

export default function OntologyPage() {
  const { data, isLoading, isError, refetch, isFetching } = useOntologyGaps()

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }
  if (isError || !data) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to scan the ontology"
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }

  const { gaps, scanned } = data

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold">Ontology</h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Beacon watches your data for typed concepts the ontology doesn't capture yet, and proposes
            extensions. The graph grows under your review — never on its own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{scanned.toLocaleString()} removals scanned</span>
          <Button variant="minimal" size="small" icon="refresh" loading={isFetching} onClick={() => { void refetch() }}>Refresh</Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {gaps.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="graph" size={32} className="text-muted-foreground/40" />}
            title="No ontology gaps right now"
            description={
              `Scanned ${scanned.toLocaleString()} stock removals — every recurring pattern is either already typed ` +
              `or there isn't enough free-text signal yet. New patterns surface here as they accumulate.`
            }
          />
        ) : (
          <>
            <Callout intent={Intent.PRIMARY} icon="lightbulb" title="Proposed typed extensions">
              These patterns recur in your free-text data but aren't typed concepts yet. Detection runs today;
              approving a proposal to grow the typed ontology — and recording that decision in the audit log —
              lands in the next step.
            </Callout>
            {gaps.map((g) => <GapCard key={`${g.targetField}:${g.proposed}`} gap={g} />)}
          </>
        )}
      </div>
    </div>
  )
}

function GapCard({ gap }: { gap: Gap }) {
  const border =
    gap.confidence >= 0.85 ? 'border-l-emerald-500' :
    gap.confidence >= 0.6  ? 'border-l-amber-400'   :
    'border-l-red-500'

  return (
    <Card className={`flex flex-col gap-3 border-l-2 ${border}`}>
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={Intent.PRIMARY} icon="plus">new category</Tag>
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
          {' / '}{gap.evidence.totalConsidered.toLocaleString()} uncategorized removals
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden max-w-[200px]">
          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${String(Math.round(gap.evidence.coverage * 100))}%` }} />
        </div>
        <span className="tabular-nums">{Math.round(gap.evidence.coverage * 100)}% coverage</span>
      </div>

      {gap.evidence.examples.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">e.g.</span>
          {gap.evidence.examples.map((ex) => (
            <Tag key={ex} minimal className="!text-[10px] italic">"{ex}"</Tag>
          ))}
        </div>
      )}

      <footer className="flex items-center justify-end gap-2 border-t border-border/40 pt-2">
        <Tooltip content="Persisting + applying approved extensions lands in the next step" compact>
          <Button variant="minimal" size="small" icon="cross" disabled>Dismiss</Button>
        </Tooltip>
        <Tooltip content="Persisting + applying approved extensions lands in the next step" compact>
          <Button intent={Intent.PRIMARY} size="small" icon="tick" disabled>Approve &amp; type</Button>
        </Tooltip>
      </footer>
    </Card>
  )
}

// Renders one persisted proposal with confidence + reasoning + provenance +
// the agent run trace (collapsible). Approve dispatches the typed BeaconAction;
// Refine opens an inline NL input that triggers a new agent run with
// parent_version_id pointing at this proposal.

import { useState } from 'react'
import { Button, Card, Icon, Intent, Tag, TextArea } from '@blueprintjs/core'
import type { AgentRunTrace, BeaconAction } from '@beacon/reality-graph'
import { cn } from '@/lib/utils'
import { ConfidenceBadge } from './ConfidenceBadge'
import { TracePanel } from './TracePanel'
import { ProposalDiff } from './ProposalDiff'
import type { PersistedProposal } from './useRestockAdvisor'

interface Props {
  persisted: PersistedProposal
  /** Shared across multiple proposals from the same run. */
  trace: AgentRunTrace
  /** Approve handler — dispatches the action, then marks proposal approved. */
  onApprove: (proposalId: string, action: BeaconAction) => Promise<void>
  /** Refine handler — re-runs the agent with the operator's NL note. */
  onRefine?: (proposalId: string, note: string) => Promise<void>
  /** When set, render a diff above showing what changed from the parent. */
  parentAction?: BeaconAction
  compact?: boolean
}

export function ProposalCard({ persisted, trace, onApprove, onRefine, parentAction, compact }: Props) {
  const { proposal, row } = persisted
  const [traceOpen, setTraceOpen] = useState(false)
  const [refineOpen, setRefineOpen] = useState(false)
  const [refineText, setRefineText] = useState('')
  const [pending, setPending] = useState<'approve' | 'refine' | null>(null)
  const [done, setDone] = useState<'approved' | 'refined' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { action } = proposal
  const supported = isApprovalSupported(action)
  const summary = summarize(action)
  const superseded = row.status === 'superseded'
  const autoApproved = row.status === 'approved' && row.decided_at !== null && done !== 'approved'

  const handleApprove = async () => {
    setPending('approve')
    setError(null)
    try {
      await onApprove(row.id, action)
      setDone('approved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setPending(null)
    }
  }

  const handleRefine = async () => {
    if (!onRefine || !refineText.trim()) return
    setPending('refine')
    setError(null)
    try {
      await onRefine(row.id, refineText.trim())
      setDone('refined')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed')
    } finally {
      setPending(null)
    }
  }

  return (
    <Card className={cn('flex flex-col gap-3', compact ? 'p-3' : 'p-4', superseded && 'opacity-60')}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={Intent.PRIMARY}>{action.type}</Tag>
          <ConfidenceBadge confidence={proposal.confidence} />
          {row.parent_version_id && (
            <Tag minimal icon="refresh" intent={Intent.NONE}>Refined</Tag>
          )}
        </div>
        {done === 'approved' && <Tag minimal intent={Intent.SUCCESS} icon="tick">Applied</Tag>}
        {autoApproved && <Tag minimal intent={Intent.SUCCESS} icon="automatic-updates">Auto-approved</Tag>}
        {superseded && <Tag minimal icon="archive">Superseded</Tag>}
      </header>

      {parentAction && <ProposalDiff parent={parentAction} child={action} />}

      <p className="text-sm font-medium">{summary}</p>

      <section className="space-y-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Reasoning
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{proposal.reasoning}</p>
      </section>

      {proposal.provenance.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Provenance
          </h4>
          <ul className="space-y-0.5">
            {proposal.provenance.map((p, i) => (
              <li key={`${p.ref}-${String(i)}`} className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
                <Icon icon={p.kind === 'tool' ? 'function' : 'document'} size={10} className="mt-0.5" />
                <span className="font-mono">{p.ref}</span>
                {p.detail && <span className="opacity-70">— {p.detail}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-border/40 pt-2">
        <button
          type="button"
          onClick={() => { setTraceOpen((v) => !v) }}
          className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon icon={traceOpen ? 'chevron-down' : 'chevron-right'} size={10} />
          {traceOpen ? 'Hide' : 'Show'} agent trace ({trace.steps.length} steps)
        </button>
        {traceOpen && (
          <div className="mt-2 max-h-[420px] overflow-y-auto">
            <TracePanel trace={trace} />
          </div>
        )}
      </div>

      {refineOpen && onRefine && !done && (
        <div className="space-y-2 border-t border-border/40 pt-2">
          <TextArea
            value={refineText}
            onChange={(e) => { setRefineText(e.target.value) }}
            placeholder="e.g. Use 200 instead, or prefer a different supplier"
            fill
            rows={3}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="minimal" size="small" onClick={() => { setRefineOpen(false); setRefineText('') }}>
              Cancel
            </Button>
            <Button
              intent={Intent.PRIMARY}
              size="small"
              loading={pending === 'refine'}
              disabled={!refineText.trim() || pending !== null}
              onClick={() => { void handleRefine() }}
            >
              Submit refinement
            </Button>
          </div>
        </div>
      )}

      {error && <div className="text-xs text-destructive">{error}</div>}

      <footer className="flex items-center justify-end gap-2">
        {!supported && (
          <span className="text-[10px] text-muted-foreground italic mr-auto">
            Direct {action.type} dispatch will land in a follow-up.
          </span>
        )}
        {onRefine && !done && !superseded && (
          <Button
            variant="minimal"
            icon="annotation"
            disabled={pending !== null}
            onClick={() => { setRefineOpen((v) => !v) }}
          >
            Refine
          </Button>
        )}
        <Button
          intent={Intent.PRIMARY}
          icon="tick"
          loading={pending === 'approve'}
          disabled={!supported || done !== null || superseded || autoApproved || pending !== null}
          onClick={() => { void handleApprove() }}
        >
          {done === 'approved' || autoApproved ? 'Approved' : 'Approve'}
        </Button>
      </footer>
    </Card>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isApprovalSupported(action: BeaconAction): boolean {
  return action.type === 'REQUEST_RESTOCK' || action.type === 'TRANSFER_STOCK'
}

function summarize(action: BeaconAction): string {
  switch (action.type) {
    case 'REQUEST_RESTOCK':
      return `Request ${String(action.quantityNeeded)} units from ${action.supplier ?? 'supplier TBD'}${
        action.urgency ? ` · ${action.urgency} urgency` : ''
      }`
    case 'TRANSFER_STOCK':
      return `Transfer ${String(action.quantity)} units from sister property`
    default:
      return `${action.type} proposal`
  }
}

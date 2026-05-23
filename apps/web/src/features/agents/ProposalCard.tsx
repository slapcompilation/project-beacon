// Renders one AgentProposal with confidence + reasoning + provenance + the
// agent run trace (collapsible). The Approve button dispatches the typed
// BeaconAction; the registry handles validation + audit.

import { useState } from 'react'
import { Button, Card, Icon, Intent, Tag } from '@blueprintjs/core'
import type { AgentProposal, AgentRunTrace, BeaconAction } from '@beacon/reality-graph'
import { cn } from '@/lib/utils'
import { ConfidenceBadge } from './ConfidenceBadge'
import { TracePanel } from './TracePanel'

interface Props {
  proposal: AgentProposal
  /** Shared across multiple proposals from the same run. */
  trace: AgentRunTrace
  /** Approve handler — receives the typed action, returns the new node id on success. */
  onApprove: (action: BeaconAction) => Promise<void>
  /** When true, render in a more compact form (slide-overs). */
  compact?: boolean
}

export function ProposalCard({ proposal, trace, onApprove, compact }: Props) {
  const [traceOpen, setTraceOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { action } = proposal
  const supported = isApprovalSupported(action)
  const summary = summarize(action)

  const handleApprove = async () => {
    setPending(true)
    setError(null)
    try {
      await onApprove(action)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className={cn('flex flex-col gap-3', compact ? 'p-3' : 'p-4')}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={Intent.PRIMARY}>{action.type}</Tag>
          <ConfidenceBadge confidence={proposal.confidence} />
        </div>
        {done && (
          <Tag minimal intent={Intent.SUCCESS} icon="tick">Applied</Tag>
        )}
      </header>

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

      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}

      <footer className="flex items-center justify-end gap-2">
        {!supported && (
          <span className="text-[10px] text-muted-foreground italic mr-auto">
            Dispatch for {action.type} lands in a follow-up
          </span>
        )}
        <Button
          intent={Intent.PRIMARY}
          icon="tick"
          loading={pending}
          disabled={!supported || done}
          onClick={() => { void handleApprove() }}
        >
          {done ? 'Approved' : 'Approve'}
        </Button>
      </footer>
    </Card>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isApprovalSupported(action: BeaconAction): boolean {
  // Phase 2: REQUEST_RESTOCK wires through dispatchAction. TRANSFER_STOCK
  // requires executor + supabase tables → Phase 3.
  return action.type === 'REQUEST_RESTOCK'
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

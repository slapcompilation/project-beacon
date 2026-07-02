// Case Object View — workflow envelope detail.
// Anatomy: header → metric strip → action bar → body sections.

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ObjectHeaderBand } from '@/components/ObjectHeaderBand'
import {
  Button, Callout, Card, FormGroup, Icon, InputGroup,
  Intent, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  useCase,
  useDetachProposalFromCase,
  useTransitionCase,
} from '@/features/cases/hooks'
import type { CaseStatus } from '@/features/cases/api'
import { fetchProposal, type ProposalRow } from '@/features/agents/proposalsApi'
import { ConfidenceBadge } from '@/features/agents/ConfidenceBadge'
import { AuditRail } from '@/components/AuditRail'

const NEXT_STATUS: Record<CaseStatus, CaseStatus[]> = {
  open:      ['in_review', 'resolved', 'closed'],
  in_review: ['open', 'resolved', 'closed'],
  resolved:  ['closed', 'open'],
  closed:    ['open'],
}

export default function CaseObjectPage() {
  const { caseId = '' } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const { data: row, isLoading } = useCase(caseId)
  const transition = useTransitionCase()
  const detach     = useDetachProposalFromCase()

  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const [outcomeAction, setOutcomeAction] = useState('')
  const [outcomeSummary, setOutcomeSummary] = useState('')

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner intent={Intent.PRIMARY} /></div>
  }
  if (!row) {
    return (
      <NonIdealState
        icon="search-template"
        title="Case not found"
        action={<Button onClick={() => { void navigate('/cases') }}>Back to Cases</Button>}
      />
    )
  }

  const nextOptions = NEXT_STATUS[row.status]

  const handleResolve = (status: CaseStatus) => {
    if (status === 'resolved' || status === 'closed') {
      setOutcomeOpen(true)
      return
    }
    transition.mutate({ id: row.id, status })
  }

  const submitOutcome = (status: CaseStatus) => {
    transition.mutate({
      id:     row.id,
      status,
      outcome: outcomeAction.trim() || outcomeSummary.trim()
        ? { action_type: outcomeAction.trim() || 'unspecified', summary: outcomeSummary.trim() }
        : null,
    })
    setOutcomeOpen(false)
    setOutcomeAction('')
    setOutcomeSummary('')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ObjectHeaderBand
        breadcrumb={{ label: 'Cases', to: '/cases' }}
        icon="folder-open"
        title={row.title}
        star={{ id: `case:${caseId}`, label: row.title, path: `/cases/${caseId}`, icon: 'folder-open' }}
        tags={<Tag minimal intent={statusIntent(row.status)}>{row.status.replace('_', ' ')}</Tag>}
        id={row.id}
      />

      {/* Metric strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border shrink-0">
        <Metric label="Status"     value={row.status.replace('_', ' ')} />
        <Metric label="Proposals"  value={String(row.proposal_ids.length)} />
        <Metric label="Inputs"     value={String(row.input_refs.length)} />
        <Metric label="Age"        value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-2 px-6 py-3 border-b shrink-0 flex-wrap">
        {nextOptions.map((s) => (
          <Button
            key={s}
            intent={s === 'resolved' || s === 'closed' ? Intent.SUCCESS : Intent.PRIMARY}
            variant="minimal"
            icon={s === 'resolved' || s === 'closed' ? 'tick' : 'arrow-right'}
            loading={transition.isPending}
            onClick={() => { handleResolve(s) }}
          >
            → {s.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {outcomeOpen && (
        <div className="px-6 py-3 border-b bg-muted/20 shrink-0 space-y-2">
          <h3 className="text-xs font-semibold">Record outcome</h3>
          <div className="grid grid-cols-2 gap-2">
            <FormGroup label="Action type" className="mb-0">
              <InputGroup value={outcomeAction} onChange={(e) => { setOutcomeAction(e.target.value) }} placeholder="REQUEST_RESTOCK" />
            </FormGroup>
            <FormGroup label="Summary" className="mb-0">
              <InputGroup value={outcomeSummary} onChange={(e) => { setOutcomeSummary(e.target.value) }} placeholder="One-line summary" />
            </FormGroup>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="minimal" onClick={() => { setOutcomeOpen(false) }}>Cancel</Button>
            <Button intent={Intent.SUCCESS} icon="tick" onClick={() => { submitOutcome('resolved') }}>Resolve</Button>
            <Button intent={Intent.NONE}    icon="archive" onClick={() => { submitOutcome('closed') }}>Close</Button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex gap-4">
       <div className="flex-1 min-w-0 space-y-4">
        {row.outcome && (
          <Section title="Outcome" icon="tick">
            <Callout intent={Intent.SUCCESS} icon="confirm" title={row.outcome.action_type}>
              {row.outcome.summary}
            </Callout>
          </Section>
        )}

        <Section title="Inputs" icon="import" subtitle="Signals that triggered the case (alerts, agent runs, operator notes).">
          {row.input_refs.length === 0 ? (
            <Card className="text-xs italic text-muted-foreground">No inputs recorded.</Card>
          ) : (
            <ul className="space-y-1">
              {row.input_refs.map((r, i) => (
                <li key={`${r.kind}-${r.ref}-${String(i)}`} className="flex items-center gap-2 text-xs">
                  <Tag minimal intent={Intent.PRIMARY}>{r.kind}</Tag>
                  <span className="font-mono">{r.ref}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Proposals" icon="annotation" subtitle={`${String(row.proposal_ids.length)} attached`}>
          {row.proposal_ids.length === 0 ? (
            <Card className="text-xs italic text-muted-foreground">No proposals attached. Open one from the Review Queue and click "Add to case".</Card>
          ) : (
            <div className="space-y-1.5">
              {row.proposal_ids.map((pid) => (
                <AttachedProposalRow
                  key={pid}
                  proposalId={pid}
                  onDetach={() => { detach.mutate({ caseId: row.id, proposalId: pid }) }}
                  busy={detach.isPending}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="Audit" icon="time">
          <Card className="text-xs space-y-1">
            <div>Opened by user <span className="font-mono">{row.opened_by_user_id}</span></div>
            <div>Created {new Date(row.created_at).toISOString()}</div>
            {row.resolved_at && <div>Resolved {new Date(row.resolved_at).toISOString()} by <span className="font-mono">{row.resolved_by_user_id ?? '—'}</span></div>}
          </Card>
        </Section>
       </div>
       <AuditRail nodeType="case" nodeId={row.id} />
      </div>

    </div>
  )
}

function AttachedProposalRow({ proposalId, onDetach, busy }: { proposalId: string; onDetach: () => void; busy: boolean }) {
  const { data: prop } = useQuery<ProposalRow | null>({
    queryKey: ['proposal', proposalId],
    queryFn:  () => fetchProposal(proposalId),
    enabled:  !!proposalId,
    staleTime: 30_000,
  })
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border border-border/40 rounded text-xs">
      {prop ? (
        <>
          <Tag minimal intent={Intent.PRIMARY} className="font-mono text-[10px]">{prop.action_type}</Tag>
          <ConfidenceBadge confidence={prop.confidence} />
          <Tag minimal>{prop.status}</Tag>
          <span className="flex-1 truncate text-muted-foreground">{prop.reasoning}</span>
        </>
      ) : (
        <span className="flex-1 font-mono text-muted-foreground">{proposalId}</span>
      )}
      <Link
        to={`/proposals/${proposalId}`}
        className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
      >
        <Icon icon="document-open" size={10} />
        Open
      </Link>
      <Button
        variant="minimal"
        size="small"
        icon="cross"
        intent={Intent.DANGER}
        disabled={busy}
        onClick={onDetach}
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-semibold capitalize">{value}</div>
    </div>
  )
}

function Section({ title, icon, subtitle, children }: { title: string; icon: 'tick' | 'import' | 'annotation' | 'time'; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground -mt-1.5 ml-6">{subtitle}</p>}
      {children}
    </section>
  )
}

function statusIntent(status: CaseStatus): Intent {
  switch (status) {
    case 'open':      return Intent.WARNING
    case 'in_review': return Intent.PRIMARY
    case 'resolved':  return Intent.SUCCESS
    case 'closed':    return Intent.NONE
  }
}

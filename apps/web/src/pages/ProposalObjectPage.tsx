// Proposal Object View — full detail of one agent proposal.
// Anatomy: header → metric strip → action bar → body sections.

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Icon, Intent, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { actionDescriptors, type BeaconAction } from '@beacon/reality-graph'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { dispatchAction } from '@/lib/actions/dispatch'
import {
  decideProposal, fetchProposal, fetchProposalsByParent,
} from '@/features/agents/proposalsApi'
import { ConfidenceBadge } from '@/features/agents/ConfidenceBadge'
import { ActionFormModal } from '@/features/actions/ActionFormModal'
import { AuditRail } from '@/components/AuditRail'
import {
  useAttachProposalToCase,
  useCases,
  useCasesForProposal,
  useCreateCase,
} from '@/features/cases/hooks'
import { useCreateActionChain } from '@/features/actionChains/hooks'

export default function ProposalObjectPage() {
  const { proposalId = '' } = useParams<{ proposalId: string }>()
  const navigate = useNavigate()
  const hotelId  = useActiveHotelId()
  const userId   = useAuthStore((s) => s.userId)
  const qc       = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: row, isLoading } = useQuery({
    queryKey: ['proposal', proposalId],
    queryFn:  () => fetchProposal(proposalId),
    enabled:  !!proposalId,
  })

  const { data: children = [] } = useQuery({
    queryKey: ['proposal-children', proposalId],
    queryFn:  () => fetchProposalsByParent(proposalId),
    enabled:  !!proposalId,
  })

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!row || !hotelId || !userId) throw new Error('Missing context')
      const action = row.action_payload as unknown as BeaconAction
      const result = await dispatchAction(
        { ...action, triggeredBy: 'ai_proposal_accepted' } as BeaconAction,
        { hotelId, actorId: userId, triggeredBy: 'ai_proposal_accepted' },
      )
      if (!result.success) throw new Error(result.error.message)
      await decideProposal({ proposalId: row.id, status: 'approved', decidedByUserId: userId })
    },
    onSuccess: () => {
      toast.success('Proposal approved')
      void qc.invalidateQueries({ queryKey: ['proposal', proposalId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!row || !userId) throw new Error('Missing context')
      await decideProposal({ proposalId: row.id, status: 'rejected', decidedByUserId: userId })
    },
    onSuccess: () => {
      toast.success('Proposal rejected')
      void qc.invalidateQueries({ queryKey: ['proposal', proposalId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner intent={Intent.PRIMARY} /></div>
  }
  if (!row) {
    return (
      <NonIdealState
        icon="search-template"
        title="Proposal not found"
        action={<Button onClick={() => { void navigate('/review-queue') }}>Back to Review Queue</Button>}
      />
    )
  }

  const action       = row.action_payload as unknown as BeaconAction
  const descriptor   = actionDescriptors[action.type]
  const canEdit      = descriptor.invocationMode === 'open-form' && descriptor.fields.length > 0
  const decided      = row.status !== 'pending'
  const statusIntent = row.status === 'approved' ? Intent.SUCCESS : row.status === 'rejected' ? Intent.DANGER : row.status === 'superseded' ? Intent.NONE : Intent.WARNING

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link to="/review-queue" className="text-xs text-muted-foreground hover:text-foreground">Review Queue</Link>
          <Icon icon="chevron-right" size={10} className="text-muted-foreground" />
          <Icon icon="annotation" size={14} className="text-violet-500" />
          <h1 className="text-sm font-semibold">Proposal</h1>
          <Tag minimal intent={Intent.PRIMARY} className="font-mono">{action.type}</Tag>
          <Tag minimal intent={statusIntent}>{row.status}</Tag>
          {row.parent_version_id && <Tag minimal icon="refresh">Refined</Tag>}
        </div>
        <p className="text-[11px] text-muted-foreground font-mono">{row.id}</p>
      </header>

      {/* Metric strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border shrink-0">
        <Metric label="Confidence" value={<ConfidenceBadge confidence={row.confidence} />} />
        <Metric label="Agent"      value={`${row.agent_name} @ ${row.agent_version}`} />
        <Metric label="Created"    value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} />
        <Metric label="Status"     value={row.status} />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-2 px-6 py-3 border-b shrink-0 flex-wrap">
        <TryInScenarioButton proposalId={row.id} action={action} agentName={row.agent_name} />
        {canEdit && hotelId && userId && row.status === 'pending' && (
          <Button
            variant="minimal"
            icon="edit"
            onClick={() => { setEditOpen(true) }}
          >
            Edit &amp; approve
          </Button>
        )}
        {row.status === 'pending' && (
          <>
            <Button
              intent={Intent.DANGER}
              variant="minimal"
              icon="cross"
              loading={rejectMutation.isPending}
              onClick={() => { rejectMutation.mutate() }}
            >
              Reject
            </Button>
            <Button
              intent={Intent.PRIMARY}
              icon="tick"
              loading={approveMutation.isPending}
              onClick={() => { approveMutation.mutate() }}
            >
              Approve
            </Button>
          </>
        )}
        {decided && (
          <span className="text-[11px] text-muted-foreground">
            {row.decided_at && `Decided ${formatDistanceToNow(new Date(row.decided_at), { addSuffix: true })}`}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex gap-4">
       <div className="flex-1 min-w-0 space-y-4">
        <CasesSection proposalId={row.id} proposalTitle={`${action.type} · ${row.agent_name}`} />

        <Section title="Reasoning" icon="lightbulb">
          <Card><p className="text-sm leading-relaxed">{row.reasoning}</p></Card>
        </Section>

        <Section title="Action payload" icon="cog">
          <Card>
            <pre className="text-[11px] font-mono whitespace-pre-wrap">{JSON.stringify(row.action_payload, null, 2)}</pre>
          </Card>
        </Section>

        {row.provenance.length > 0 && (
          <Section title="Provenance" icon="function">
            <Card>
              <ul className="space-y-1">
                {row.provenance.map((p, i) => (
                  <li key={`${p.ref}-${String(i)}`} className="flex items-baseline gap-2 text-xs">
                    <Icon icon={p.kind === 'tool' ? 'function' : 'document'} size={11} className="text-muted-foreground mt-0.5" />
                    {p.kind === 'document' && isUuid(p.ref) ? (
                      <Link to={`/documents/${p.ref}`} className="font-mono hover:underline">{p.ref}</Link>
                    ) : (
                      <span className="font-mono">{p.ref}</span>
                    )}
                    {p.detail && <span className="text-muted-foreground">— {p.detail}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          </Section>
        )}

        {row.refinement_note && (
          <Section title="Refinement note" icon="annotation">
            <Card><p className="text-sm leading-relaxed">{row.refinement_note}</p></Card>
          </Section>
        )}

        {children.length > 0 && (
          <Section title="Refinements" icon="git-branch" subtitle={`${String(children.length)} child proposal(s) supersede this one`}>
            <div className="space-y-1.5">
              {children.map((c) => (
                <Link key={c.id} to={`/proposals/${c.id}`}>
                  <Card interactive className="flex items-center gap-2 hover:bg-surface-2">
                    <Tag minimal intent={Intent.PRIMARY} className="font-mono text-[10px]">{c.action_type}</Tag>
                    <ConfidenceBadge confidence={c.confidence} />
                    <Tag minimal>{c.status}</Tag>
                    <span className="flex-1 text-xs text-muted-foreground truncate">{c.reasoning}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </Card>
                </Link>
              ))}
            </div>
          </Section>
        )}
       </div>
       <AuditRail nodeType="proposal" nodeId={row.id} />
      </div>

      {canEdit && hotelId && userId && (
        <ActionFormModal
          open={editOpen}
          onClose={() => { setEditOpen(false) }}
          actionType={action.type}
          context={action as unknown as Record<string, unknown>}
          initialValues={action as unknown as Record<string, unknown>}
          dispatchContext={{ hotelId, actorId: userId, triggeredBy: 'ai_proposal_accepted' }}
          titleOverride={`Edit &amp; approve · ${descriptor.title}`}
          onSuccess={() => {
            void decideProposal({ proposalId: row.id, status: 'approved', decidedByUserId: userId })
              .then(() => {
                toast.success('Edited proposal approved')
                void qc.invalidateQueries({ queryKey: ['proposal', proposalId] })
              })
          }}
        />
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-background px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

// ─── Try-in-chain button ────────────────────────────────────────────────────

function TryInScenarioButton({ proposalId, action, agentName }: { proposalId: string; action: BeaconAction; agentName: string }) {
  const navigate = useNavigate()
  const create   = useCreateActionChain()
  return (
    <Button
      variant="minimal"
      icon="link"
      loading={create.isPending}
      onClick={() => {
        create.mutate(
          {
            title:           `Chain · ${action.type} · ${agentName}`,
            description:     `Forked from proposal ${proposalId}. Tweak the action payload + add follow-up steps before committing the chain.`,
            baseProposalId:  proposalId,
            simulatedActions: [action],
          },
          { onSuccess: (sc) => { void navigate(`/action-chains/${sc.id}`) } },
        )
      }}
    >
      Try in chain
    </Button>
  )
}

function Section({ title, icon, subtitle, children }: { title: string; icon: 'lightbulb' | 'cog' | 'function' | 'annotation' | 'git-branch' | 'folder-open'; subtitle?: string; children: React.ReactNode }) {
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

// ─── Cases section ──────────────────────────────────────────────────────────
//
// Shows cases this proposal is already attached to + lets the operator open a
// fresh case or attach to an existing open one. Keeps the workflow-envelope
// affordance one click away from the proposal that triggered it.

function CasesSection({ proposalId, proposalTitle }: { proposalId: string; proposalTitle: string }) {
  const { data: attached = [] } = useCasesForProposal(proposalId)
  const { data: openCases = [] } = useCases('open')
  const createCase                 = useCreateCase()
  const attach                     = useAttachProposalToCase()
  const [picker, setPicker]        = useState(false)

  const openCaseCandidates = openCases.filter((c) => !c.proposal_ids.includes(proposalId))

  return (
    <Section title="Cases" icon="folder-open" subtitle="Workflow envelopes wrapping this proposal.">
      {attached.length === 0 ? (
        <Card className="text-xs italic text-muted-foreground">Not attached to any case yet.</Card>
      ) : (
        <div className="space-y-1.5">
          {attached.map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`}>
              <Card interactive className="flex items-center gap-2 hover:bg-surface-2">
                <Tag minimal intent={Intent.PRIMARY} icon="folder-open">{c.status.replace('_', ' ')}</Tag>
                <span className="flex-1 truncate text-sm">{c.title}</span>
                <span className="text-[10px] text-muted-foreground">{String(c.proposal_ids.length)} proposal(s)</span>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="minimal"
          icon="add"
          size="small"
          loading={createCase.isPending}
          onClick={() => {
            createCase.mutate({
              title:       `Triage · ${proposalTitle}`,
              proposalIds: [proposalId],
              inputRefs:   [{ kind: 'proposal', ref: proposalId }],
            })
          }}
        >
          Open new case
        </Button>
        {openCaseCandidates.length > 0 && (
          <Button
            variant="minimal"
            icon="link"
            size="small"
            onClick={() => { setPicker((v) => !v) }}
          >
            Attach to existing
          </Button>
        )}
      </div>

      {picker && openCaseCandidates.length > 0 && (
        <Card className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Open cases</h4>
          {openCaseCandidates.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={attach.isPending}
              onClick={() => {
                attach.mutate({ caseId: c.id, proposalId })
                setPicker(false)
              }}
              className="flex items-center gap-2 w-full text-left px-2 py-1 rounded hover:bg-surface-2 text-xs"
            >
              <Icon icon="folder-open" size={11} className="text-muted-foreground" />
              <span className="flex-1 truncate">{c.title}</span>
              <span className="text-[10px] text-muted-foreground">{String(c.proposal_ids.length)} proposal(s)</span>
            </button>
          ))}
        </Card>
      )}
    </Section>
  )
}

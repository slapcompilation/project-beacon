// The Proposals page — "analogous to a Pull Request in a version control
// system". The five tabs are the screenshot's: My proposals / Assigned to me /
// In review / Merged proposals / Closed proposals.

import { useMemo, useState } from 'react'
import { Button, Callout, Card, Icon, Intent, Tab, Tabs, Tag } from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { useOmaOntology } from '@/features/ontologyManager/resources'
import { useAuthStore } from '@/stores/auth.store'
import {
  useProposals, useProposalBlockers, useTaskStatus, useReview, useMergeProposal,
  type ProposalRow, type TaskRow,
} from '@/features/branching/api'

const KIND_LABEL: Record<string, string> = {
  object_type: 'Object type', link_type: 'Link type', shared_property: 'Shared property',
  interface: 'Interface', action_type: 'Action type', type_group: 'Type group',
}

const STATUS_INTENT = { open: Intent.SUCCESS, merged: Intent.NONE, closed: Intent.DANGER } as const

export default function ProposalsPage() {
  const { ontology, isLoading } = useOmaOntology()
  const userId = useAuthStore((s) => s.userId)
  const { data: proposals = [] } = useProposals(ontology?.id ?? null)
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState('mine')
  const selectedId = params.get('p')
  const selected = proposals.find((p) => p.id === selectedId) ?? null

  const rows = useMemo(() => {
    switch (tab) {
      case 'mine':     return proposals.filter((p) => p.created_by_user_id === userId)
      case 'assigned': return proposals.filter((p) =>
        p.proposal_tasks.some((t) => t.proposal_reviews.some((r) => r.user_id === userId)))
      case 'review':   return proposals.filter((p) => p.status === 'open')
      case 'merged':   return proposals.filter((p) => p.status === 'merged')
      default:         return proposals.filter((p) => p.status === 'closed')
    }
  }, [proposals, tab, userId])

  if (!ontology) {
    return <div className="oma-page max-w-2xl">{isLoading ? null : <NoOntologyCallout />}</div>
  }

  return (
    <div className="oma-page">
      <SectionHead title="Proposals" count={proposals.length} />
      <Tabs id="proposals" selectedTabId={tab} onChange={(t) => { setTab(String(t)); setParams({}) }}>
        <Tab id="mine" title="My proposals" />
        <Tab id="assigned" title="Assigned to me" />
        <Tab id="review" title="In review" />
        <Tab id="merged" title="Merged proposals" />
        <Tab id="closed" title="Closed proposals" />
      </Tabs>

      <div className="max-w-4xl space-y-2 mt-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing here. A proposal reviews and merges a branch's changes into Main.</p>
        )}
        {rows.map((p) => (
          <Card key={p.id} compact interactive className="!py-2"
            onClick={() => { setParams(p.id === selectedId ? {} : { p: p.id }) }}>
            <div className="flex items-center gap-2">
              <Icon icon="git-pull" size={13} className="text-violet-500" />
              <span className="text-sm font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                wants to merge into Main from {p.ontology_branches?.title ?? p.branch_id.slice(0, 8)}
              </span>
              <Tag minimal intent={STATUS_INTENT[p.status]} className="ml-auto">{p.status}</Tag>
              <Tag minimal>{p.proposal_tasks.length} task{p.proposal_tasks.length === 1 ? '' : 's'}</Tag>
            </div>
            {selected?.id === p.id && <ProposalDetail proposal={p} />}
          </Card>
        ))}
      </div>
    </div>
  )
}

function ProposalDetail({ proposal }: { proposal: ProposalRow }) {
  const { data: blockers = [] } = useProposalBlockers(proposal.id)
  const merge = useMergeProposal()
  const mergeable = proposal.status === 'open' && blockers.length === 0

  return (
    <div className="mt-2 pt-2 border-t space-y-2" onClick={(e) => { e.stopPropagation() }}>
      {proposal.description && <p className="text-xs text-muted-foreground">{proposal.description}</p>}

      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Review changes</span>
      {proposal.proposal_tasks.map((t) => <TaskRowView key={t.id} task={t} open={proposal.status === 'open'} />)}

      {proposal.status === 'open' && blockers.length > 0 && (
        <Callout intent={Intent.WARNING} icon="issue">
          {(blockers as { reason: string }[]).map((b, i) => <div key={i}>{b.reason}</div>)}
        </Callout>
      )}
      {proposal.status === 'open' && (
        <Button size="small" intent={Intent.SUCCESS} icon="git-merge" disabled={!mergeable}
          loading={merge.isPending}
          title={mergeable ? undefined : 'All checks must pass in order to merge'}
          onClick={() => { merge.mutate(proposal.id) }}>
          Merge proposal
        </Button>
      )}
    </div>
  )
}

function TaskRowView({ task, open }: { task: TaskRow; open: boolean }) {
  const { data: status } = useTaskStatus(task.id)
  const review = useReview()
  const label = status === 'auto_approved' ? 'Auto-approved'
    : status === 'approved' ? 'Approved'
    : status === 'rejected' ? 'Rejected'
    : 'Awaiting approval'
  const intent = status === 'rejected' ? Intent.DANGER
    : status === 'awaiting_approval' ? Intent.WARNING : Intent.SUCCESS

  return (
    <div className="flex items-center gap-2 text-xs">
      <Tag minimal>{KIND_LABEL[task.resource_kind] ?? task.resource_kind}</Tag>
      <code className="text-xs text-muted-foreground">{task.resource_id.slice(0, 8)}</code>
      <Tag minimal intent={intent}>{label}</Tag>
      {task.proposal_reviews.length > 0 && (
        <Tag minimal icon="person">{task.proposal_reviews.length}</Tag>
      )}
      {open && (
        <span className="ml-auto flex gap-1">
          <Button size="small" variant="minimal" intent={Intent.DANGER} icon="cross"
            loading={review.isPending}
            onClick={() => { review.mutate({ taskId: task.id, decision: 'rejected' }) }}>Reject</Button>
          <Button size="small" variant="minimal" intent={Intent.SUCCESS} icon="tick"
            loading={review.isPending}
            onClick={() => { review.mutate({ taskId: task.id, decision: 'approved' }) }}>Approve</Button>
        </span>
      )}
    </div>
  )
}

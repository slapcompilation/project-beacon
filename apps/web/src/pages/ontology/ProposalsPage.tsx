// The Proposals page — "analogous to a Pull Request in a version control
// system". The five tabs are the screenshot's: My proposals / Assigned to me /
// In review / Merged proposals / Closed proposals.

import { useMemo, useState } from 'react'
import {
  Button, Callout, Card, HTMLSelect, Icon, Intent, Popover, Tab, Tabs, Tag,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { useOmaOntology } from '@/features/ontologyManager/resources'
import { useAuthStore } from '@/stores/auth.store'
import { useOrgMembers } from '@/features/projects/api'
import {
  useProposals, useProposalBlockers, useTaskStatus, useReview, useMergeProposal,
  useCanApproveTask, useProposalReviewers, useInviteReviewer, useRemoveReviewer,
  useTaskPolicy, useEligibleTasks,
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
      // Assigned means INVITED — "the reviewers list to track who should
      // review". It read proposal_reviews (already reviewed) until 680.
      case 'assigned': return proposals.filter((p) =>
        p.proposal_reviewers.some((r) => r.user_id === userId))
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
  const open = proposal.status === 'open'

  return (
    <div className="mt-2 pt-2 border-t space-y-2" onClick={(e) => { e.stopPropagation() }}>
      {proposal.description && <p className="text-xs text-muted-foreground">{proposal.description}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Review changes</span>
        {open && <InviteReviewers proposal={proposal} />}
      </div>

      <TaskSections proposal={proposal} open={open} />

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

/** The capture splits the list: the tasks the viewer's approval counts for
 *  sit under their own heading, the rest below. Anyone may still review
 *  either — "Users without permissions may still review the task". */
function TaskSections({ proposal, open }: { proposal: ProposalRow; open: boolean }) {
  const ids = proposal.proposal_tasks.map((t) => t.id)
  const { data: eligible } = useEligibleTasks(proposal.id, ids)
  if (!eligible) {
    return <>{proposal.proposal_tasks.map((t) => <TaskRowView key={t.id} task={t} open={open} />)}</>
  }
  const mine = proposal.proposal_tasks.filter((t) => eligible.has(t.id))
  const others = proposal.proposal_tasks.filter((t) => !eligible.has(t.id))
  return (
    <>
      {mine.length > 0 && (
        <>
          <p className="text-[11px] text-muted-foreground">Tasks eligible for your approval</p>
          {mine.map((t) => <TaskRowView key={t.id} task={t} open={open} />)}
        </>
      )}
      {others.length > 0 && (
        <>
          <p className="text-[11px] text-muted-foreground">
            {mine.length > 0 ? 'Other tasks' : 'No task here needs your approval'}
            {' '}— you may still review to give an opinion, without changing the status.
          </p>
          {others.map((t) => <TaskRowView key={t.id} task={t} open={open} />)}
        </>
      )}
    </>
  )
}

/** "+ Invite reviewers" — the list tracks who SHOULD review; it grants
 *  nothing, which is why no eligibility check guards this picker. */
function InviteReviewers({ proposal }: { proposal: ProposalRow }) {
  const { data: reviewers = [] } = useProposalReviewers(proposal.id)
  const { data: people = [] } = useOrgMembers()
  const invite = useInviteReviewer(proposal.id)
  const remove = useRemoveReviewer(proposal.id)
  const [pick, setPick] = useState('')
  const uninvited = people.filter((p) => !reviewers.some((r) => r.userId === p.id))

  return (
    <Popover
      content={
        <div className="p-3 space-y-2 max-w-sm" onClick={(e) => { e.stopPropagation() }}>
          <p className="text-[11px] text-muted-foreground">
            Tracks who should review. Anyone with approval rights can approve whether or not they are listed.
          </p>
          {reviewers.length > 0 && (
            <ul className="divide-y divide-border/30">
              {reviewers.map((r) => (
                <li key={r.userId} className="flex items-center gap-2 py-1 text-xs">
                  <Icon icon="person" size={11} className="text-muted-foreground" />
                  <span className="flex-1 truncate">{r.label ?? r.userId.slice(0, 8)}</span>
                  <Button variant="minimal" size="small" icon="cross" title="Remove reviewer"
                    onClick={() => { remove.mutate(r.userId) }} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <HTMLSelect value={pick} onChange={(e) => { setPick(e.currentTarget.value) }}>
              <option value="">Pick someone…</option>
              {uninvited.map((p) => <option key={p.id} value={p.id}>{p.email}</option>)}
            </HTMLSelect>
            <Button size="small" icon="add" loading={invite.isPending} disabled={pick === ''}
              onClick={() => { invite.mutate(pick, { onSuccess: () => { setPick('') } }) }} />
          </div>
        </div>
      }>
      <Button size="small" variant="minimal" icon="add" endIcon="caret-down"
        text={reviewers.length > 0 ? `Reviewers (${String(reviewers.length)})` : 'Invite reviewers'} />
    </Popover>
  )
}

/** The View policies popover: the project's approval policy in the
 *  capture's own order — the project, the count and its eligible
 *  principals, then AND, then the contributor rule. */
function ViewPolicies({ task }: { task: TaskRow }) {
  const { data: policy } = useTaskPolicy(task.resource_kind, task.resource_id)
  return (
    <Popover
      content={
        <div className="p-3 space-y-2 max-w-sm" onClick={(e) => { e.stopPropagation() }}>
          <p className="text-xs font-semibold">Branch approval policy</p>
          {!policy || policy.projectId === null ? (
            <p className="text-[11px] text-muted-foreground">
              This resource is in no project, so no project policy applies.
            </p>
          ) : policy.approvalsRequired === null ? (
            <>
              <p className="text-xs">{policy.projectName}</p>
              <p className="text-[11px] text-muted-foreground">
                {policy.protectedResource
                  ? 'Approval required from at least one user with edit permissions to the file.'
                  : 'Not protected — a contributor with edit permissions may approve automatically.'}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs">{policy.projectName}</p>
              <p className="text-[11px]">
                Approval required from at least {policy.approvalsRequired} user
                {policy.approvalsRequired === 1 ? '' : 's'} in the following:
              </p>
              <ul className="text-[11px] text-muted-foreground">
                {policy.reviewerLabels.length === 0
                  ? <li>Anyone with edit permissions.</li>
                  : policy.reviewerLabels.map((l) => <li key={l}>{l}</li>)}
              </ul>
              {!policy.contributorApproval && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">And</p>
                  <p className="text-[11px]">
                    Reviewers cannot approve changes to files they have contributed to in the proposed branch.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      }>
      <Button size="small" variant="minimal" icon="shield" title="View policies" />
    </Popover>
  )
}

function TaskRowView({ task, open }: { task: TaskRow; open: boolean }) {
  const { data: status } = useTaskStatus(task.id)
  const { data: eligible } = useCanApproveTask(task.id)
  const review = useReview()
  // "approved resources change from In Progress to Approved" — the page's
  // own name for the waiting state, not an invented one.
  const label = status === 'auto_approved' ? 'Auto-approved'
    : status === 'approved' ? 'Approved'
    : status === 'rejected' ? 'Rejected'
    : 'In progress'
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
      <span className="ml-auto flex items-center gap-1">
        <ViewPolicies task={task} />
        {open && (
          <>
            <Button size="small" variant="minimal" intent={Intent.DANGER} icon="cross"
              loading={review.isPending}
              onClick={() => { review.mutate({ taskId: task.id, decision: 'rejected' }) }}>Reject</Button>
            <Button size="small" variant="minimal" intent={Intent.SUCCESS} icon="tick"
              loading={review.isPending}
              title={eligible === false ? 'Your review will not change the status of this task' : undefined}
              onClick={() => { review.mutate({ taskId: task.id, decision: 'approved' }) }}>Approve</Button>
          </>
        )}
      </span>
    </div>
  )
}

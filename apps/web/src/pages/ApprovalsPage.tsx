// The Approvals inbox and request page, to the captures' grammar: quick
// filters with counts, status sub-filters, and a request drawn as its header,
// the eligible/ineligible task split, the n/m footer, and the comment stream.
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Dialog, DialogBody, DialogFooter, Icon, InputGroup, Menu,
  MenuItem, NonIdealState, Popover, Spinner, Tag, TextArea, Intent,
} from '@blueprintjs/core'
import {
  useApprovals, useApprovalComments, useReviewTask, useCloseRequest,
  useRequestChanges, useEditRequest, useCommentOnRequest,
  REQUEST_OPEN, REQUEST_STATUS_LABEL, TASK_KIND_LABEL, TASK_FIELD_ROWS,
  type ApprovalRequest, type ApprovalTask,
} from '@/features/approvals/api'
import { cn } from '@/lib/utils'

type Quick = 'inbox' | 'mine' | 'all'
type Sub = 'open' | 'completed' | 'closed' | null

const STATUS_INTENT: Record<ApprovalRequest['status'], Intent> = {
  pending_approval: Intent.PRIMARY,
  changes_requested: Intent.WARNING,
  completed: Intent.SUCCESS,
  closed: Intent.NONE,
  rejected_and_closed: Intent.DANGER,
}

const isOpen = (r: ApprovalRequest) => REQUEST_OPEN.includes(r.status)
const awaitsMe = (r: ApprovalRequest) =>
  isOpen(r) && r.tasks.some((t) => t.can_review && t.status === 'review')

export default function ApprovalsPage() {
  const { id } = useParams()
  const { data: requests, isLoading } = useApprovals()
  if (id !== undefined) {
    return <RequestView id={id} requests={requests} isLoading={isLoading} />
  }
  return <Inbox requests={requests ?? []} isLoading={isLoading} />
}

function Inbox({ requests, isLoading }: { requests: ApprovalRequest[]; isLoading: boolean }) {
  const navigate = useNavigate()
  const [quick, setQuick] = useState<Quick>('inbox')
  const [sub, setSub] = useState<Sub>(null)

  const counts = useMemo(() => ({
    inbox: requests.filter(awaitsMe).length,
    mine: requests.filter((r) => r.mine).length,
    all: requests.length,
    open: requests.filter(isOpen).length,
    completed: requests.filter((r) => r.status === 'completed').length,
    closed: requests.filter((r) => r.status === 'closed' || r.status === 'rejected_and_closed').length,
  }), [requests])

  const shown = useMemo(() => requests
    .filter((r) => quick === 'inbox' ? awaitsMe(r) : quick === 'mine' ? r.mine : true)
    .filter((r) => sub === null ? true
      : sub === 'open' ? isOpen(r)
      : sub === 'completed' ? r.status === 'completed'
      : r.status === 'closed' || r.status === 'rejected_and_closed'),
    [requests, quick, sub])

  const filterRow = (key: Quick | Exclude<Sub, null>, label: string, n: number, isSub = false) => {
    const active = isSub ? sub === key : quick === key && sub === null
    return (
      <button type="button"
        className={cn('approvals-filter', isSub && 'is-sub', active && 'is-active')}
        onClick={() => {
          if (isSub) { setSub(sub === key ? null : key as Exclude<Sub, null>) }
          else { setQuick(key as Quick); setSub(null) }
        }}>
        <span>{label}</span>
        <Tag minimal round>{n}</Tag>
      </button>
    )
  }

  return (
    <div className="approvals-page">
      <h2 className="approvals-title">Approvals</h2>
      <div className="approvals-layout">
        <div className="approvals-filters">
          <div className="approvals-filter-group">
            {filterRow('inbox', 'Your inbox', counts.inbox)}
            {filterRow('mine', 'Created by you', counts.mine)}
            {filterRow('all', 'All requests', counts.all)}
          </div>
          <div className="approvals-filter-group">
            {filterRow('open', 'Open', counts.open, true)}
            {filterRow('completed', 'Completed', counts.completed, true)}
            {filterRow('closed', 'Closed', counts.closed, true)}
          </div>
        </div>
        <div className="approvals-list">
          {isLoading ? <Spinner /> : shown.length === 0
            ? <NonIdealState icon="inbox" title="No requests"
                description="Requests awaiting your review, and requests you created, appear here." />
            : shown.map((r) => (
              <button key={r.id} type="button" className="approvals-row"
                onClick={() => { void navigate(`/approvals/${r.id}`) }}>
                <Icon icon="form" />
                <span className="approvals-row-main">
                  <span className="approvals-row-title">{r.title}</span>
                  <span className="approvals-row-sub">
                    Created by {r.creator ?? 'unknown'} on {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </span>
                <Tag minimal intent={STATUS_INTENT[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Tag>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

function RequestView({ id, requests, isLoading }:
  { id: string; requests: ApprovalRequest[] | undefined; isLoading: boolean }) {
  const navigate = useNavigate()
  const request = requests?.find((r) => r.id === id)
  const { data: comments } = useApprovalComments(request?.id ?? null)
  const review = useReviewTask()
  const close = useCloseRequest()
  const changes = useRequestChanges()
  const edit = useEditRequest()
  const comment = useCommentOnRequest()
  const [editOpen, setEditOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [body, setBody] = useState('')

  if (isLoading) return <div className="approvals-page"><Spinner /></div>
  if (!request) {
    return <div className="approvals-page"><NonIdealState icon="inbox" title="Not visible"
      description="This request does not exist, or you are neither its requester nor an eligible reviewer." /></div>
  }

  const open = isOpen(request)
  const eligible = request.tasks.filter((t) => t.can_review)
  const ineligible = request.tasks.filter((t) => !t.can_review)
  const approved = request.tasks.filter((t) => t.status === 'approved').length
  const myPending = eligible.filter((t) => t.status !== 'approved')

  const taskCard = (t: ApprovalTask) => (
    <div key={t.id} className="approvals-task">
      <div className="approvals-task-head">
        <span className={cn('approvals-task-dot', `is-${t.status}`)} />
        <span className="approvals-task-kind">{TASK_KIND_LABEL[t.kind]}</span>
        {open && t.can_review && (
          <span className="approvals-task-review">
            <Button size="small" variant="minimal" intent="success" icon="tick" text="Approve"
              disabled={review.isPending || t.status === 'approved'}
              onClick={() => { review.mutate({ taskId: t.id, decision: 'approved' }) }} />
            <Button size="small" variant="minimal" intent="danger" icon="cross" text="Reject"
              disabled={review.isPending || t.status === 'rejected'}
              onClick={() => { review.mutate({ taskId: t.id, decision: 'rejected' }) }} />
          </span>
        )}
      </div>
      {TASK_FIELD_ROWS[t.kind].map(({ key, label }) => (
        <div key={key} className="approvals-task-row">
          <span className="approvals-task-label">{label}</span>
          <span>{t.labels[key] ?? t.payload[key] ?? '—'}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="approvals-page">
      <div className="approvals-crumbs">
        <Button variant="minimal" icon="arrow-left" onClick={() => { void navigate('/approvals') }} />
        <h2 className="approvals-title">{request.title}</h2>
        <Tag minimal intent={STATUS_INTENT[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Tag>
      </div>
      <div className="approvals-detail">
        <div className="approvals-main">
          <Card className="approvals-header-card">
            {request.justification !== '' && <p>{request.justification}</p>}
            <p className="approvals-row-sub">
              Created by {request.creator ?? 'unknown'} on {new Date(request.created_at).toLocaleDateString()}
            </p>
          </Card>
          <Card className="approvals-tasks-card">
            <h3>Reviewer tasks</h3>
            {eligible.length > 0 && <>
              <p className="approvals-section-label">Tasks eligible for your approval</p>
              {eligible.map(taskCard)}
            </>}
            {ineligible.length > 0 && <>
              <p className="approvals-section-label">Tasks ineligible for your approval</p>
              {ineligible.map(taskCard)}
            </>}
            <div className="approvals-footer">
              <span>
                <strong>{approved}/{request.tasks.length} tasks approved.</strong>{' '}
                All tasks must be approved before the request can be completed.
              </span>
              {open && (
                <span className="approvals-actions">
                  <Button icon="archive" text="Close"
                    onClick={() => { close.mutate({ requestId: request.id, rejected: false }) }} />
                  <Button icon="edit" text="Edit" onClick={() => {
                    setTitle(request.title); setWhy(request.justification); setEditOpen(true)
                  }} />
                  {eligible.length > 0 && (
                    <Popover content={
                      <Menu>
                        <MenuItem icon="refresh" text="Request changes"
                          label="the requester can edit and resubmit"
                          onClick={() => { changes.mutate({ requestId: request.id }) }} />
                        <MenuItem icon="archive" text="Reject and Close" intent="danger"
                          label="cannot be re-opened"
                          onClick={() => { close.mutate({ requestId: request.id, rejected: true }) }} />
                      </Menu>
                    }>
                      <Button intent="danger" icon="cross" text="Reject" endIcon="caret-down" />
                    </Popover>
                  )}
                  <Button intent="success" icon="tick" text="Approve"
                    disabled={myPending.length === 0 || review.isPending}
                    onClick={() => {
                      for (const t of myPending) review.mutate({ taskId: t.id, decision: 'approved' })
                    }} />
                </span>
              )}
            </div>
          </Card>
        </div>
        <Card className="approvals-comments">
          <h3>Comments</h3>
          <div className="approvals-comment-stream">
            {(comments ?? []).length === 0 && <p className="approvals-row-sub">No comments yet.</p>}
            {(comments ?? []).map((c) => (
              <div key={c.id} className={cn('approvals-comment', c.is_system && 'is-system')}>
                {c.is_system && <Icon icon="automatic-updates" size={12} />}
                {!c.is_system && c.author_email !== null && (
                  <span className="approvals-comment-author">{c.author_email}</span>
                )}
                <span>{c.body}</span>
                <span className="approvals-comment-when">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <div className="approvals-comment-add">
            <TextArea fill value={body} placeholder="Add comment"
              onChange={(e) => { setBody(e.target.value) }} />
            <Button intent="primary" text="Comment" disabled={body.trim() === ''}
              onClick={() => {
                comment.mutate({ requestId: request.id, taskId: null, body })
                setBody('')
              }} />
          </div>
        </Card>
      </div>

      <Dialog isOpen={editOpen} title="Edit request" onClose={() => { setEditOpen(false) }}>
        <DialogBody>
          <InputGroup value={title} placeholder="Title"
            onChange={(e) => { setTitle(e.target.value) }} />
          <TextArea fill className="approvals-edit-why" value={why}
            placeholder="Justification" onChange={(e) => { setWhy(e.target.value) }} />
        </DialogBody>
        <DialogFooter actions={
          <Button intent="primary" text="Save" disabled={title.trim() === ''}
            onClick={() => {
              edit.mutate({ requestId: request.id, title, justification: why })
              setEditOpen(false)
            }} />
        } />
      </Dialog>
    </div>
  )
}

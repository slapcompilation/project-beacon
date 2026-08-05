// AIP Review Queue — pending agent proposals triaged by confidence band.
//
// Layer: Mind → operator surface.
// Read: fetchPendingProposals (proposals table, status='pending').
// Write: dispatchAction on approve, decideProposal on approve/reject.
// Cycle: agents emit proposals continuously; this page is the operator inbox.
//
// Empty state explains what was scanned and when the next agent run is so the
// page is never a silent dead-end.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, HTMLSelect, Icon, InputGroup, Intent, Menu, MenuDivider, MenuItem,
  NonIdealState, Popover, SegmentedControl, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { ConfidenceBadge } from '@/features/agents/ConfidenceBadge'
import { actionDescriptors, type ActionDescriptor, type BeaconAction } from '@beacon/reality-graph'
import { ActionFormModal } from '@/features/actions/ActionFormModal'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import { decideProposal } from '@/features/agents/proposalsApi'
import { toast } from 'sonner'
import type { ProposalRow } from '@/features/agents/proposalsApi'
import { TeachRuleDialog, actionQuantity, type TeachRuleContext } from '@/features/agents/TeachRuleDialog'
import { useTeamMembers } from '@/features/team/hooks'
import {
  bandByConfidence,
  reviewQueueKeys,
  useAssignProposal,
  useReviewQueueLoad,
  usePendingProposals,
  useApproveProposalFromQueue,
  useRejectProposalFromQueue,
  useRejectManyFromQueue,
  useUniqueFilters,
} from '@/features/agents/useReviewQueue'
import { useRestockCycle } from '@/features/agents/useRestockCycle'

type Band = 'all' | 'red' | 'yellow' | 'green'
type SortKey = 'confidence-asc' | 'confidence-desc' | 'newest' | 'oldest'
type OwnerFilter = 'all' | 'mine' | 'unassigned'

/** Pending review per person, unassigned as its own column. The adoption band
 *  on the Flywheel says decisions are concentrated in one reviewer; this is
 *  where an operator can see that daily and move work off them. */
function QueueLoad({ rows }: { rows: { assignee: string | null; assignee_email: string; pending: number; oldest_days: number }[] }) {
  if (rows.length === 0) return null
  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b shrink-0 flex-wrap text-xs">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Load</span>
      {rows.map((r) => (
        <div key={r.assignee ?? 'unassigned'} className="flex items-center gap-1.5">
          <Icon icon={r.assignee ? 'user' : 'inbox'} size={11}
            className={r.assignee ? 'text-muted-foreground' : 'text-amber-600'} />
          <span className={cn('truncate max-w-[14rem]', !r.assignee && 'text-amber-700 dark:text-amber-500')}>
            {r.assignee_email}
          </span>
          <span className="tabular-nums font-semibold">{r.pending}</span>
          {r.oldest_days > 1 && (
            <Tag minimal intent={r.oldest_days > 7 ? Intent.DANGER : Intent.WARNING} className="!text-[10px]">
              oldest {r.oldest_days}d
            </Tag>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ReviewQueuePage() {
  const { data: rows = [], isLoading, isError, refetch, isFetching, dataUpdatedAt } = usePendingProposals()
  const approve    = useApproveProposalFromQueue()
  const reject     = useRejectProposalFromQueue()
  const rejectMany = useRejectManyFromQueue()

  // Run cycle moved here from the old Mind Overview: scan at-risk stock, run the
  // restock advisor on each, auto-execute confident proposals, queue the rest.
  const cycle = useRestockCycle()
  const runCycle = () => {
    cycle.mutate(undefined, {
      onSuccess: (r) => { toast.success(`Cycle: ${String(r.scanned)} scanned · ${String(r.autoExecuted)} auto-executed · ${String(r.queued)} queued`) },
      onError:   (e) => { toast.error(e.message) },
    })
  }

  const [band, setBand]               = useState<Band>('all')
  const [agentFilter, setAgentFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter]   = useState<string | null>(null)
  const [armBulk, setArmBulk]         = useState(false)
  // O2: a rejection is a teaching moment. The dialog lives at the page level so
  // it survives the row unmounting when the queue refreshes after the reject.
  const [teachCtx, setTeachCtx]       = useState<TeachRuleContext | null>(null)
  const [search, setSearch]           = useState('')
  const [sortBy, setSortBy]           = useState<SortKey>('confidence-asc')
  // Assignment (275): who owns reviewing this. Unassigned is a real state, not a
  // missing value, so it gets its own filter rather than being folded into "all".
  const [owner, setOwner]             = useState<OwnerFilter>('all')
  const userId  = useAuthStore((s) => s.userId)
  const load    = useReviewQueueLoad()
  const members = useTeamMembers()
  const assign  = useAssignProposal()
  // The "confirm" arming is set-specific — drop it whenever the visible set changes.
  useEffect(() => { setArmBulk(false) }, [band, agentFilter, typeFilter, search, owner])

  const handleReject = (row: ProposalRow) => {
    reject.mutate(row.id, { onSuccess: () => { setTeachCtx(teachCtxFor(row)) } })
  }

  const { agentNames, actionTypes } = useUniqueFilters(rows)
  const bands = useMemo(() => bandByConfidence(rows), [rows])

  const counts: Record<Band, number> = {
    all:    rows.length,
    red:    bands.red.length,
    yellow: bands.yellow.length,
    green:  bands.green.length,
  }

  const filtered = rows.filter((r) => {
    if (band === 'red'    && r.confidence >= 0.6)  return false
    if (band === 'yellow' && (r.confidence < 0.6 || r.confidence >= 0.85)) return false
    if (band === 'green'  && r.confidence < 0.85) return false
    if (agentFilter && r.agent_name !== agentFilter) return false
    if (typeFilter  && r.action_type !== typeFilter) return false
    if (owner === 'mine'       && r.assigned_to_user_id !== userId) return false
    if (owner === 'unassigned' && r.assigned_to_user_id !== null)   return false
    return true
  })

  // Free-text search + operator-chosen sort over the band/agent/type result.
  const q = search.trim().toLowerCase()
  const visible = [...(q
    ? filtered.filter((r) =>
        r.agent_name.toLowerCase().includes(q) ||
        r.action_type.toLowerCase().includes(q) ||
        r.reasoning.toLowerCase().includes(q))
    : filtered)].sort((a, b) => {
    switch (sortBy) {
      case 'confidence-desc': return b.confidence - a.confidence
      case 'newest':          return +new Date(b.created_at) - +new Date(a.created_at)
      case 'oldest':          return +new Date(a.created_at) - +new Date(b.created_at)
      default:                return a.confidence - b.confidence
    }
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
      </div>
    )
  }

  if (isError) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to load review queue"
        action={
          <Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>
        }
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            Review queue
            {rows.length > 0 && (
              <Tag minimal intent={counts.red > 0 ? Intent.DANGER : Intent.NONE}>
                {String(rows.length)} pending
              </Tag>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agent proposals awaiting your decision · search, filter and sort to triage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            icon="play"
            intent={Intent.PRIMARY}
            loading={cycle.isPending}
            onClick={runCycle}
            title="Scan at-risk stock, run the restock advisor on each, auto-execute confident proposals, queue the rest"
          >
            Run cycle
          </Button>
          <Button
            variant="minimal"
            size="small"
            icon="refresh"
            loading={isFetching}
            onClick={() => { void refetch() }}
          >
            Refresh
          </Button>
        </div>
      </header>

      {rows.length > 0 && <QueueLoad rows={load.data ?? []} />}

      {rows.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0 flex-wrap">
          <SegmentedControl
            size="small"
            value={owner}
            onValueChange={(v) => { setOwner(v as OwnerFilter) }}
            options={[
              { value: 'all',        label: 'Everyone' },
              { value: 'mine',       label: `Mine (${String(rows.filter((r) => r.assigned_to_user_id === userId).length)})` },
              { value: 'unassigned', label: `Unassigned (${String(rows.filter((r) => r.assigned_to_user_id === null).length)})` },
            ]}
          />
          <SegmentedControl
            size="small"
            value={band}
            onValueChange={(v) => { setBand(v as Band) }}
            options={[
              { value: 'all',    label: `All (${String(counts.all)})` },
              { value: 'red',    label: `🔴 ${String(counts.red)}` },
              { value: 'yellow', label: `🟡 ${String(counts.yellow)}` },
              { value: 'green',  label: `🟢 ${String(counts.green)}` },
            ]}
          />

          {agentNames.length > 1 && (
            <FilterChips
              label="Agent"
              options={agentNames}
              value={agentFilter}
              onChange={setAgentFilter}
            />
          )}
          {actionTypes.length > 1 && (
            <FilterChips
              label="Action"
              options={actionTypes}
              value={typeFilter}
              onChange={setTypeFilter}
            />
          )}

          <InputGroup
            size="small"
            leftIcon="search"
            placeholder="Search reasoning, agent, action…"
            value={search}
            onValueChange={setSearch}
            className="max-w-[220px]"
          />
          <HTMLSelect
            minimal
            value={sortBy}
            onChange={(e) => { setSortBy(e.currentTarget.value as SortKey) }}
            options={[
              { value: 'confidence-asc',  label: 'Lowest confidence' },
              { value: 'confidence-desc', label: 'Highest confidence' },
              { value: 'newest',          label: 'Newest' },
              { value: 'oldest',          label: 'Oldest' },
            ]}
          />

          {visible.length > 1 && (
            <Button
              size="small"
              variant="minimal"
              intent={Intent.DANGER}
              icon="trash"
              className="ml-auto"
              loading={rejectMany.isPending}
              onClick={() => {
                if (!armBulk) { setArmBulk(true); return }
                rejectMany.mutate(visible.map((r) => r.id), { onSettled: () => { setArmBulk(false) } })
              }}
            >
              {armBulk ? `Confirm — reject ${String(visible.length)}` : `Reject ${String(visible.length)} shown`}
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {rows.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="tick-circle" size={32} className="text-emerald-500/70" />}
            title="Queue is empty"
            description={`No pending proposals. Agents run on operator request (e.g. from a variant page) or on a schedule. Last checked ${formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}.`}
          />
        ) : visible.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">
            No proposals match these filters
          </div>
        ) : (
          visible.map((row) => (
            <QueueRow
              key={row.id}
              row={row}
              busy={approve.isPending || reject.isPending}
              onApprove={() => { approve.mutate(row) }}
              onReject={() => { handleReject(row) }}
              onTeach={() => { setTeachCtx(teachCtxFor(row)) }}
              members={members.data ?? []}
              assigning={assign.isPending}
              onAssign={(assignee) => { assign.mutate({ id: row.id, assignee }) }}
            />
          ))
        )}
      </div>

      {/* Page-level so it outlives the row that triggered it (O2). */}
      <TeachRuleDialog
        open={teachCtx !== null}
        onClose={() => { setTeachCtx(null) }}
        context={teachCtx ?? { actionType: '', agentName: '' }}
      />
    </div>
  )
}

function teachCtxFor(row: ProposalRow): TeachRuleContext {
  const action = row.action_payload as unknown as BeaconAction
  return {
    actionType: action.type,
    agentName:  row.agent_name,
    quantity:   actionQuantity(action as { quantityNeeded?: number; quantity?: number }),
  }
}

/** Assign this proposal to somebody, or clear it. Unassigned reads as an amber
 *  "Unassigned" rather than an empty control — a queue nobody owns is the state
 *  worth noticing, and 275's whole point is that nothing routes work today. */
function AssigneeControl({ row, members, currentUserId, busy, onAssign }: {
  row: ProposalRow
  members: { id: string; email: string }[]
  currentUserId: string | null
  busy: boolean
  onAssign: (assignee: string | null) => void
}) {
  const assigned = row.assigned_to_user_id
  const mine     = assigned !== null && assigned === currentUserId
  const email    = members.find((m) => m.id === assigned)?.email

  return (
    <Popover
      minimal
      placement="bottom-end"
      content={
        <Menu>
          {currentUserId && !mine && (
            <MenuItem icon="user" text="Assign to me" onClick={() => { onAssign(currentUserId) }} />
          )}
          {members
            .filter((m) => m.id !== currentUserId && m.id !== assigned)
            .map((m) => (
              <MenuItem key={m.id} icon="person" text={m.email} onClick={() => { onAssign(m.id) }} />
            ))}
          {assigned !== null && (
            <>
              <MenuDivider />
              <MenuItem icon="cross" text="Unassign" intent={Intent.WARNING} onClick={() => { onAssign(null) }} />
            </>
          )}
        </Menu>
      }
    >
      <Button
        variant="minimal"
        size="small"
        loading={busy}
        icon={assigned ? 'user' : 'inbox'}
        intent={assigned ? Intent.NONE : Intent.WARNING}
        title={assigned ? `Assigned to ${email ?? 'someone'}` : 'Nobody owns this yet'}
        className="!text-[11px]"
      >
        {mine ? 'Me' : assigned ? (email ?? 'Assigned') : 'Unassigned'}
      </Button>
    </Popover>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function QueueRow({
  row,
  busy,
  onApprove,
  onReject,
  onTeach,
  members,
  assigning,
  onAssign,
}: {
  row: ProposalRow
  busy: boolean
  onApprove: () => void
  onReject:  () => void
  onTeach:   () => void
  members:   { id: string; email: string }[]
  assigning: boolean
  onAssign:  (assignee: string | null) => void
}) {
  const navigate = useNavigate()
  const hotelId  = useActiveHotelId()
  const userId   = useAuthStore((s) => s.userId)
  const qc       = useQueryClient()
  const [editOpen, setEditOpen]   = useState(false)
  const action   = row.action_payload as unknown as BeaconAction
  const principles = row.provenance.filter((p) => p.kind === 'principle')
  const otherProvenance = row.provenance.filter((p) => p.kind !== 'principle')
  const supported = isApprovalSupported(action)
  const variantId = extractVariantId(action)
  const descriptor = actionDescriptors[action.type]
  const canEdit   = descriptor.invocationMode === 'open-form' && descriptor.fields.length > 0
  const borderClass =
    row.confidence >= 0.85 ? 'border-l-emerald-500' :
    row.confidence >= 0.6  ? 'border-l-amber-400'   :
    'border-l-red-500'

  return (
    <Card className={cn('flex flex-col gap-3 border-l-2', borderClass)}>
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={Intent.PRIMARY}>{action.type}</Tag>
          <ConfidenceBadge confidence={row.confidence} />
          <Tag minimal icon="predictive-analysis" className="text-xs">
            {row.agent_name} <span className="opacity-50">@ {row.agent_version}</span>
          </Tag>
          {row.parent_version_id && (
            <Tag minimal icon="refresh">Refined</Tag>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AssigneeControl
            row={row}
            members={members}
            currentUserId={userId}
            busy={assigning}
            onAssign={onAssign}
          />
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </span>
          <Button
            variant="minimal"
            size="small"
            icon="document-open"
            title="Open proposal detail"
            onClick={() => { void navigate(`/proposals/${row.id}`) }}
          />
        </div>
      </header>

      <p className="text-sm font-medium">{summarize(action)}</p>

      <section className="space-y-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Reasoning
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{row.reasoning}</p>
      </section>

      {/* O1 — make the operator feel the system learned from them. */}
      {principles.length > 0 && (
        <section className="rounded border border-violet-500/30 bg-violet-500/5 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-500">
            <Icon icon="learning" size={11} />
            Followed your {principles.length === 1 ? 'principle' : 'principles'}
          </div>
          {principles.map((p, i) => (
            <p key={`${p.ref}-${String(i)}`} className="text-xs text-foreground/90 mt-1 italic">
              “{p.detail ?? p.ref}”
            </p>
          ))}
        </section>
      )}

      {otherProvenance.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Provenance
          </h4>
          <ul className="space-y-0.5">
            {otherProvenance.map((p, i) => (
              <li key={`${p.ref}-${String(i)}`} className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
                <Icon icon={p.kind === 'tool' ? 'function' : 'document'} size={10} className="mt-0.5" />
                <span className="font-mono">{p.ref}</span>
                {p.detail && <span className="opacity-70">— {p.detail}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex items-center justify-end gap-2 flex-wrap">
        {!supported && (
          <span className="text-[10px] text-muted-foreground italic mr-auto">
            Direct {action.type} approval will land in a follow-up.
          </span>
        )}
        {canEdit && hotelId && userId && (
          <Button
            variant="minimal"
            icon="edit"
            disabled={busy}
            onClick={() => { setEditOpen(true) }}
          >
            Edit &amp; approve
          </Button>
        )}
        {variantId && (
          <Button
            variant="minimal"
            icon="annotation"
            disabled={busy}
            onClick={() => { void navigate(`/objects/variant/${variantId}?refine=${row.id}`) }}
          >
            Refine
          </Button>
        )}
        <Button
          variant="minimal"
          icon="learning"
          disabled={busy}
          title="Turn this into a Principle or Constraint the agents respect"
          onClick={onTeach}
        >
          Teach a rule
        </Button>
        <Button
          intent={Intent.DANGER}
          variant="minimal"
          icon="cross"
          disabled={busy}
          onClick={onReject}
        >
          Reject
        </Button>
        <Button
          intent={Intent.PRIMARY}
          icon="tick"
          disabled={busy || !supported}
          onClick={onApprove}
        >
          Approve
        </Button>
      </footer>

      {canEdit && hotelId && userId && (
        <ActionFormModal
          open={editOpen}
          onClose={() => { setEditOpen(false) }}
          actionType={action.type}
          context={action as unknown as Record<string, unknown>}
          initialValues={action as unknown as Record<string, unknown>}
          dispatchContext={{ hotelId, actorId: userId, triggeredBy: 'ai_proposal_accepted' }}
          titleOverride={`Edit &amp; approve · ${descriptor.title}`}
          onSuccess={(_result, editedAction) => {
            // Only count it as edited if a field actually changed — opening the
            // form and approving unchanged is still a clean approval (#6).
            const edited = actionFieldsChanged(action, editedAction, descriptor)
            void decideProposal({
              proposalId:      row.id,
              status:          'approved',
              decidedByUserId: userId,
              edited,
            }).then(() => {
              toast.success(edited ? 'Edited proposal approved' : 'Proposal approved')
              void qc.invalidateQueries({ queryKey: reviewQueueKeys.pending(hotelId) })
            })
          }}
        />
      )}
    </Card>
  )
}

// ─── Filter chips (typed string radio) ────────────────────────────────────────

function FilterChips<T extends string>({
  label, options, value, onChange,
}: {
  label: string
  options: T[]
  value: T | null
  onChange: (next: T | null) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}:</span>
      <Tag
        interactive
        minimal={value !== null}
        intent={value === null ? Intent.PRIMARY : Intent.NONE}
        onClick={() => { onChange(null) }}
      >
        All
      </Tag>
      {options.map((opt) => (
        <Tag
          key={opt}
          interactive
          minimal={value !== opt}
          intent={value === opt ? Intent.PRIMARY : Intent.NONE}
          onClick={() => { onChange(value === opt ? null : opt) }}
        >
          {opt}
        </Tag>
      ))}
    </div>
  )
}

// ─── Action helpers (shared shape with AdviceSlideOver, kept local) ──────────

function isApprovalSupported(action: BeaconAction): boolean {
  return action.type === 'REQUEST_RESTOCK' || action.type === 'TRANSFER_STOCK'
}

/** True when any of the descriptor's editable fields differs between the original
 *  proposal and the operator's edited action. Treats null/undefined/'' as equal. */
function actionFieldsChanged(original: BeaconAction, edited: BeaconAction, descriptor: ActionDescriptor): boolean {
  const o = original as unknown as Record<string, unknown>
  const e = edited as unknown as Record<string, unknown>
  const norm = (v: unknown): string => {
    if (v == null) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return JSON.stringify(v)
  }
  return descriptor.fields.some((f) => norm(o[f.name]) !== norm(e[f.name]))
}

function extractVariantId(action: BeaconAction): string | undefined {
  if ('variantId' in action && typeof action.variantId === 'string') return action.variantId
  return undefined
}

function summarize(action: BeaconAction): string {
  switch (action.type) {
    case 'REQUEST_RESTOCK':
      return `Request ${String(action.quantityNeeded)} units${
        action.supplier ? ` from ${action.supplier}` : ''
      }${action.urgency ? ` · ${action.urgency} urgency` : ''}`
    case 'TRANSFER_STOCK':
      return `Transfer ${String(action.quantity)} units from sister property`
    case 'ADJUST_STOCK':
      return `Adjust stock by ${action.delta > 0 ? '+' : ''}${String(action.delta)} (${action.reason})`
    case 'WRITE_OFF':
      return `Write off ${String(action.quantity)} units (${action.wasteReason})`
    default:
      return `${action.type} proposal`
  }
}


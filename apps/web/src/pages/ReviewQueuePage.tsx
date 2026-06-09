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
  Button, Card, Icon, Intent, NonIdealState,
  SegmentedControl, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { ConfidenceBadge } from '@/features/agents/ConfidenceBadge'
import { actionDescriptors, type BeaconAction } from '@beacon/reality-graph'
import { ActionFormModal } from '@/features/actions/ActionFormModal'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import { decideProposal } from '@/features/agents/proposalsApi'
import { toast } from 'sonner'
import type { ProposalRow } from '@/features/agents/proposalsApi'
import { TeachRuleDialog, actionQuantity } from '@/features/agents/TeachRuleDialog'
import {
  bandByConfidence,
  reviewQueueKeys,
  usePendingProposals,
  useApproveProposalFromQueue,
  useRejectProposalFromQueue,
  useRejectManyFromQueue,
  useUniqueFilters,
} from '@/features/agents/useReviewQueue'

type Band = 'all' | 'red' | 'yellow' | 'green'

export default function ReviewQueuePage() {
  const { data: rows = [], isLoading, isError, refetch, isFetching, dataUpdatedAt } = usePendingProposals()
  const approve    = useApproveProposalFromQueue()
  const reject     = useRejectProposalFromQueue()
  const rejectMany = useRejectManyFromQueue()

  const [band, setBand]               = useState<Band>('all')
  const [agentFilter, setAgentFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter]   = useState<string | null>(null)
  const [armBulk, setArmBulk]         = useState(false)
  // The "confirm" arming is set-specific — drop it whenever the filter changes.
  useEffect(() => { setArmBulk(false) }, [band, agentFilter, typeFilter])

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
    return true
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
            Agent proposals awaiting your decision · ordered by lowest confidence first
          </p>
        </div>
        <Button
          variant="minimal"
          size="small"
          icon="refresh"
          loading={isFetching}
          onClick={() => { void refetch() }}
        >
          Refresh
        </Button>
      </header>

      {rows.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0 flex-wrap">
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

          {filtered.length > 1 && (
            <Button
              size="small"
              variant="minimal"
              intent={Intent.DANGER}
              icon="trash"
              className="ml-auto"
              loading={rejectMany.isPending}
              onClick={() => {
                if (!armBulk) { setArmBulk(true); return }
                rejectMany.mutate(filtered.map((r) => r.id), { onSettled: () => { setArmBulk(false) } })
              }}
            >
              {armBulk ? `Confirm — reject ${String(filtered.length)}` : `Reject ${String(filtered.length)} filtered`}
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
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">
            No proposals match these filters
          </div>
        ) : (
          filtered.map((row) => (
            <QueueRow
              key={row.id}
              row={row}
              busy={approve.isPending || reject.isPending}
              onApprove={() => { approve.mutate(row) }}
              onReject={() => { reject.mutate(row.id) }}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function QueueRow({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: ProposalRow
  busy: boolean
  onApprove: () => void
  onReject:  () => void
}) {
  const navigate = useNavigate()
  const hotelId  = useActiveHotelId()
  const userId   = useAuthStore((s) => s.userId)
  const qc       = useQueryClient()
  const [editOpen, setEditOpen]   = useState(false)
  const [teachOpen, setTeachOpen] = useState(false)
  const action   = row.action_payload as unknown as BeaconAction
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

      {row.provenance.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Provenance
          </h4>
          <ul className="space-y-0.5">
            {row.provenance.map((p, i) => (
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
            onClick={() => { void navigate(`/variant/${variantId}?refine=${row.id}`) }}
          >
            Refine
          </Button>
        )}
        <Button
          variant="minimal"
          icon="learning"
          disabled={busy}
          title="Turn this into a Principle or Constraint the agents respect"
          onClick={() => { setTeachOpen(true) }}
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
          onSuccess={() => {
            void decideProposal({
              proposalId:      row.id,
              status:          'approved',
              decidedByUserId: userId,
            }).then(() => {
              toast.success('Edited proposal approved')
              void qc.invalidateQueries({ queryKey: reviewQueueKeys.pending(hotelId) })
            })
          }}
        />
      )}

      <TeachRuleDialog
        open={teachOpen}
        onClose={() => { setTeachOpen(false) }}
        context={{
          actionType: action.type,
          agentName:  row.agent_name,
          quantity:   actionQuantity(action as { quantityNeeded?: number; quantity?: number }),
        }}
      />
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


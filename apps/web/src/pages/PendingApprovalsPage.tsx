// Soft-constraint approval queue.
//
// Surfaces actions paused by the dispatcher when a soft constraint triggered.
// Each row shows the proposed BeaconAction, the violations that gated it, and
// who originated the request. Approve replays the action with the constraint
// check bypassed; reject closes the row with an optional reason.

import { Button, Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import {
  useApprovePending,
  usePendingApprovals,
  useRejectPending,
} from '@/features/pendingApprovals/hooks'
import type { PendingApprovalRow } from '@/features/pendingApprovals/api'

export default function PendingApprovalsPage() {
  const { data: rows = [], isLoading, isError, refetch, isFetching } = usePendingApprovals()
  const approve = useApprovePending()
  const reject  = useRejectPending()

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
        title="Failed to load pending approvals"
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            Pending approvals
            {rows.length > 0 && (
              <Tag minimal intent={Intent.WARNING}>{String(rows.length)} pending</Tag>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Actions paused after a soft constraint violation. A higher-tier approver reviews; approving replays the original action with the soft check bypassed.
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

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {rows.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="tick-circle" size={32} className="text-emerald-500/70" />}
            title="Queue is empty"
            description="No actions are waiting for soft-violation approval. Hard violations are rejected at submission; soft violations land here for org-level review."
          />
        ) : (
          rows.map((row) => (
            <ApprovalRow
              key={row.id}
              row={row}
              busy={approve.isPending || reject.isPending}
              onApprove={() => { approve.mutate(row) }}
              onReject={() => { reject.mutate({ id: row.id }) }}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ApprovalRow({
  row, busy, onApprove, onReject,
}: {
  row: PendingApprovalRow
  busy: boolean
  onApprove: () => void
  onReject:  () => void
}) {
  return (
    <Card className="flex flex-col gap-3 border-l-2 border-l-amber-500">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={Intent.PRIMARY} className="font-mono">{row.action_type}</Tag>
          <Tag minimal intent={Intent.WARNING} icon="warning-sign">soft violation</Tag>
          <Tag minimal>via {row.original_triggered_by}</Tag>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
        </span>
      </header>

      <section className="space-y-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Action payload
        </h4>
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {Object.entries(row.action_payload)
            .filter(([k]) => k !== 'type')
            .map(([k, v]) => (
              <div key={k} className="font-mono">
                <span className="text-foreground/80">{k}</span>
                <span className="opacity-60"> · </span>
                <span>{formatValue(v)}</span>
              </div>
            ))}
        </div>
      </section>

      <section className="space-y-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Soft violations
        </h4>
        <ul className="space-y-1">
          {row.violations.map((v, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              <Icon icon="warning-sign" size={11} className="text-amber-500 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">
                <span className="font-mono text-[10px] mr-1">{v.ruleType ?? 'rule'}</span>
                {v.message}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex items-center justify-end gap-2">
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
          loading={busy}
          onClick={onApprove}
        >
          Approve &amp; dispatch
        </Button>
      </footer>
    </Card>
  )
}

function formatValue(v: unknown): string {
  if (v == null) return 'null'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

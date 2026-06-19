// Layer: Flow × Eye — Shift Handover Report
// Sprint 22: Operational glue between shifts.
// The outgoing manager documents what happened and flags items needing attention.
// The incoming manager opens this tab to see the previous handover before acting.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo, useCallback } from 'react'
import { subHours, formatDistanceToNow, format } from 'date-fns'
import {
  Button,
  Card,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tag,
  TextArea,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useShiftActivity } from '@/features/inventory/hooks/reports'
import { useShiftHandovers, useCreateShiftHandover } from '@/features/flow/hooks'
import { useTeamMembers } from '@/features/team/hooks'
import type { AuditLogRow } from '@/features/inventory/api/reports'
import type { HandoverFlaggedItem } from '@/features/flow/api'

// ─── Window options ───────────────────────────────────────────────────────────

const WINDOWS = [
  { label: '4h',  hours: 4  },
  { label: '8h',  hours: 8  },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
] as const

// ─── Event helpers ────────────────────────────────────────────────────────────

type EventKind = 'receive' | 'consume' | 'writeoff' | 'revert'

function classifyLog(row: AuditLogRow): EventKind {
  if (row.is_revert)            return 'revert'
  if (row.quantity_change > 0)  return 'receive'
  if (row.category)     return 'writeoff'
  return 'consume'
}

interface KindMetaEntry {
  icon: IconName
  color: string
  label: string
  bg: string
  intent: Intent
}

const KIND_META: Record<EventKind, KindMetaEntry> = {
  receive:  { icon: 'arrow-up',     color: 'text-emerald-500', label: 'Received',  bg: 'bg-emerald-500/10', intent: Intent.SUCCESS },
  consume:  { icon: 'minus',        color: 'text-blue-500',    label: 'Consumed',  bg: 'bg-blue-500/10',    intent: Intent.PRIMARY },
  writeoff: { icon: 'warning-sign', color: 'text-red-500',     label: 'Write-off', bg: 'bg-red-500/10',     intent: Intent.DANGER  },
  revert:   { icon: 'undo',         color: 'text-amber-500',   label: 'Reverted',  bg: 'bg-amber-500/10',   intent: Intent.WARNING },
}

// ─── Activity digest ──────────────────────────────────────────────────────────

interface KindGroup {
  kind: EventKind
  count: number
  topItems: { name: string; qty: number }[]
}

function buildDigest(logs: AuditLogRow[]): KindGroup[] {
  const groups = new Map<EventKind, { count: number; byVariant: Map<string, { name: string; qty: number }> }>()
  for (const log of logs) {
    const kind = classifyLog(log)
    let g = groups.get(kind)
    if (!g) {
      g = { count: 0, byVariant: new Map() }
      groups.set(kind, g)
    }
    g.count++
    const vname = log.variant_name !== 'Standard' ? `${log.product_name} — ${log.variant_name}` : log.product_name
    const existing = g.byVariant.get(log.variant_id) ?? { name: vname, qty: 0 }
    existing.qty += Math.abs(log.quantity_change)
    g.byVariant.set(log.variant_id, existing)
  }
  return [...groups.entries()].map(([kind, { count, byVariant }]) => ({
    kind,
    count,
    topItems: [...byVariant.values()].sort((a, b) => b.qty - a.qty).slice(0, 3),
  }))
}

function DigestCard({ group, logs, onFlag }: {
  group: KindGroup
  logs: AuditLogRow[]
  onFlag: (item: HandoverFlaggedItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = KIND_META[group.kind]
  const kindLogs = logs.filter((l) => classifyLog(l) === group.kind)

  return (
    <Card compact className="!p-0">
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v) }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded"
      >
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0', meta.bg)}>
          <Icon icon={meta.icon} size={14} className={meta.color} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-sm font-medium">{meta.label}</span>
          <span className="ml-2 text-xs text-muted-foreground tabular-nums">{group.count} event{group.count !== 1 ? 's' : ''}</span>
        </span>
        <Icon icon={expanded ? 'chevron-up' : 'chevron-down'} size={14} className="text-muted-foreground" />
      </button>

      {expanded && (
        <div className="border-t divide-y">
          {kindLogs.map((log) => {
            const name = log.variant_name !== 'Standard'
              ? `${log.product_name} — ${log.variant_name}`
              : log.product_name
            return (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="tabular-nums font-semibold">{Math.abs(log.quantity_change)}</span> units
                    {log.reason && <span> · {log.reason}</span>}
                    {' · '}{format(new Date(log.timestamp), 'HH:mm')}
                  </p>
                </div>
                <Button
                  icon="flag"
                  variant="minimal"
                  size="small"
                  onClick={() => {
                    onFlag({
                      variant_id:   log.variant_id,
                      product_name: name,
                      note:         '',
                      priority:     group.kind === 'writeoff' ? 'urgent' : 'watch',
                    })
                  }}
                  aria-label="Flag for handover"
                >
                  Flag
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Flagged item editor ──────────────────────────────────────────────────────

const PRIORITY_INTENT: Record<HandoverFlaggedItem['priority'], Intent> = {
  urgent: Intent.DANGER,
  watch:  Intent.WARNING,
  info:   Intent.PRIMARY,
}

const PRIORITY_LABEL: Record<HandoverFlaggedItem['priority'], string> = {
  urgent: 'Urgent',
  watch:  'Watch',
  info:   'Info',
}

function FlaggedItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: HandoverFlaggedItem
  onChange: (updated: HandoverFlaggedItem) => void
  onRemove: () => void
}) {
  const priorities: HandoverFlaggedItem['priority'][] = ['urgent', 'watch', 'info']
  return (
    <Card compact className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{item.product_name}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {priorities.map((p) => (
            <Tag
              key={p}
              interactive
              minimal={item.priority !== p}
              intent={item.priority === p ? PRIORITY_INTENT[p] : Intent.NONE}
              onClick={() => { onChange({ ...item, priority: p }) }}
            >
              {PRIORITY_LABEL[p]}
            </Tag>
          ))}
          <Button
            icon="cross"
            variant="minimal"
            size="small"
            intent={Intent.DANGER}
            onClick={onRemove}
            aria-label="Remove flag"
          />
        </div>
      </div>
      <InputGroup
        type="text"
        placeholder="Add a note for the incoming team…"
        value={item.note}
        onChange={(e) => { onChange({ ...item, note: e.target.value }) }}
      />
    </Card>
  )
}

// ─── Previous handovers list ──────────────────────────────────────────────────

function PreviousHandovers() {
  const { data: handovers = [], isLoading } = useShiftHandovers(5)
  const { data: members = [] } = useTeamMembers()
  const emailMap = useMemo(() => new Map(members.map((m) => [m.id, m.email])), [members])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={SpinnerSize.SMALL} />
      </div>
    )
  }

  if (handovers.length === 0) {
    return (
      <NonIdealState
        icon="clipboard"
        title="No handovers recorded yet"
      />
    )
  }

  return (
    <div className="space-y-2">
      {handovers.map((h) => {
        const author = h.author_email ?? (h.created_by ? (emailMap.get(h.created_by) ?? h.created_by.slice(0, 8)) : 'Unknown')
        const isOpen = expandedId === h.id
        return (
          <Card key={h.id} compact className="!p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => { setExpandedId(isOpen ? null : h.id) }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <Icon icon="time" size={14} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  {h.window_hours}h shift · {format(new Date(h.created_at), 'dd MMM, HH:mm')}
                </p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Icon icon="user" size={10} />{author}
                  {h.flagged_items.length > 0 && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      · {h.flagged_items.length} flagged
                    </span>
                  )}
                </p>
              </div>
              <Icon icon={isOpen ? 'chevron-up' : 'chevron-down'} size={14} className="text-muted-foreground shrink-0" />
            </button>

            {isOpen && (
              <div className="border-t px-4 py-3 space-y-3">
                {h.notes && (
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{h.notes}</p>
                )}
                {h.flagged_items.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Flagged items</p>
                    {h.flagged_items.map((fi, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Tag intent={PRIORITY_INTENT[fi.priority]} minimal className="mt-0.5 shrink-0">
                          {PRIORITY_LABEL[fi.priority]}
                        </Tag>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{fi.product_name}</p>
                          {fi.note && <p className="text-[11px] text-muted-foreground">{fi.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!h.notes && h.flagged_items.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No notes or flags recorded</p>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShiftHandoverPage() {
  const [windowHours, setWindowHours] = useState<4 | 8 | 12 | 24>(8)
  const since = useMemo(() => subHours(new Date(), windowHours).toISOString(), [windowHours])

  const { data: logs = [], isLoading } = useShiftActivity(since)
  const createHandover = useCreateShiftHandover()

  const [notes, setNotes] = useState('')
  const [flaggedItems, setFlaggedItems] = useState<HandoverFlaggedItem[]>([])
  const [showPrevious, setShowPrevious] = useState(false)

  const digest = useMemo(() => buildDigest(logs), [logs])

  const handleFlag = useCallback((item: HandoverFlaggedItem) => {
    setFlaggedItems((prev) => {
      const exists = prev.findIndex((f) => f.variant_id === item.variant_id)
      if (exists >= 0) return prev
      return [...prev, item]
    })
  }, [])

  const handleSubmit = () => {
    createHandover.mutate({
      window_hours:  windowHours,
      started_at:    since,
      notes:         notes.trim() || null,
      flagged_items: flaggedItems,
    }, {
      onSuccess: () => {
        setNotes('')
        setFlaggedItems([])
        setShowPrevious(true)
      },
    })
  }

  const urgentCount = flaggedItems.filter((f) => f.priority === 'urgent').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold flex items-center gap-2">
            <Icon icon="clipboard" size={14} className="text-muted-foreground" />
            Shift Handover
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? 'Loading activity…'
              : `${logs.length} event${logs.length !== 1 ? 's' : ''} in the last ${windowHours}h`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl
            size="small"
            value={String(windowHours)}
            onValueChange={(v) => { setWindowHours(parseInt(v, 10) as 4 | 8 | 12 | 24) }}
            options={WINDOWS.map((w) => ({ value: String(w.hours), label: w.label }))}
          />
          <Button
            icon="time"
            size="small"
            onClick={() => { setShowPrevious((v) => !v) }}
          >
            {showPrevious ? 'Hide' : 'View'} previous
          </Button>
        </div>
      </div>

      {/* Previous handovers drawer */}
      {showPrevious && (
        <div className="border-b px-6 py-4 bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Recent handovers</p>
          <PreviousHandovers />
        </div>
      )}

      {/* Body — two column layout */}
      <div className="flex-1 overflow-hidden flex gap-0 divide-x">

        {/* Left: Activity digest */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-2 border-b flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Shift activity — last {windowHours}h
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(since), { addSuffix: true })} to now
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size={SpinnerSize.STANDARD} />
              </div>
            ) : digest.length === 0 ? (
              <NonIdealState
                icon="tick-circle"
                title="No activity in this window"
              />
            ) : (
              digest
                .sort((a, b) => {
                  const order: EventKind[] = ['writeoff', 'revert', 'receive', 'consume']
                  return order.indexOf(a.kind) - order.indexOf(b.kind)
                })
                .map((group) => (
                  <DigestCard
                    key={group.kind}
                    group={group}
                    logs={logs}
                    onFlag={handleFlag}
                  />
                ))
            )}
          </div>
        </div>

        {/* Right: Handover form */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-2 border-b flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Handover note
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Write context for the incoming team, then submit
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            <TextArea
              placeholder="What should the incoming team know? Any issues, pending decisions, context..."
              value={notes}
              onChange={(e) => { setNotes(e.target.value) }}
              fill
              rows={6}
            />

            {/* Flagged items */}
            {flaggedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Icon icon="flag" size={12} className="text-amber-500" />
                    Flagged for attention
                  </p>
                  {urgentCount > 0 && (
                    <Tag intent={Intent.DANGER} minimal icon="warning-sign">
                      {urgentCount} urgent
                    </Tag>
                  )}
                </div>
                {flaggedItems.map((item, i) => (
                  <FlaggedItemRow
                    key={`${item.variant_id}-${i}`}
                    item={item}
                    onChange={(updated) => {
                      setFlaggedItems((prev) => prev.map((f, fi) => fi === i ? updated : f))
                    }}
                    onRemove={() => {
                      setFlaggedItems((prev) => prev.filter((_, fi) => fi !== i))
                    }}
                  />
                ))}
              </div>
            )}

            {flaggedItems.length === 0 && !isLoading && logs.length > 0 && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Icon icon="flag" size={12} />
                Expand activity cards on the left and click &quot;Flag&quot; to add items
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex-shrink-0 border-t px-6 py-4">
            <Button
              icon="tick-circle"
              intent={Intent.PRIMARY}
              fill
              loading={createHandover.isPending}
              disabled={!notes.trim() && flaggedItems.length === 0}
              onClick={handleSubmit}
            >
              Submit handover
            </Button>
            {!notes.trim() && flaggedItems.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                Add notes or flag at least one item to submit
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

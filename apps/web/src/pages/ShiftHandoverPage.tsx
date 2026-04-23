// Layer: Flow × Eye — Shift Handover Report
// Sprint 22: Operational glue between shifts.
// The outgoing manager documents what happened and flags items needing attention.
// The incoming manager opens this tab to see the previous handover before acting.
//
// Palantir Principles:
//   #4  Decision support — incoming manager knows exactly what to act on
//   #5  Auditability    — every shift's context is preserved
//   #6  Cross-domain    — stock movements + alerts + restock approvals synthesised

import { useState, useMemo, useCallback } from 'react'
import { subHours, formatDistanceToNow, format } from 'date-fns'
import {
  ClipboardList, AlertTriangle, ArrowUpCircle, MinusCircle,
  RotateCcw, AlertCircle, X, CheckCircle2, Loader2,
  Clock, User, ChevronDown, ChevronUp, Flag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  if (row.removal_category)     return 'writeoff'
  return 'consume'
}

const KIND_META: Record<EventKind, { icon: React.ElementType; color: string; label: string; bg: string }> = {
  receive:  { icon: ArrowUpCircle, color: 'text-emerald-500', label: 'Received',   bg: 'bg-emerald-500/10' },
  consume:  { icon: MinusCircle,   color: 'text-blue-500',    label: 'Consumed',   bg: 'bg-blue-500/10'    },
  writeoff: { icon: AlertCircle,   color: 'text-red-500',     label: 'Write-off',  bg: 'bg-red-500/10'     },
  revert:   { icon: RotateCcw,     color: 'text-amber-500',   label: 'Reverted',   bg: 'bg-amber-500/10'   },
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
    if (!groups.has(kind)) groups.set(kind, { count: 0, byVariant: new Map() })
    const g = groups.get(kind)!
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
  const Icon = meta.icon
  const kindLogs = logs.filter((l) => classifyLog(l) === group.kind)

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v) }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
      >
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0', meta.bg)}>
          <Icon className={cn('h-3.5 w-3.5', meta.color)} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-sm font-medium">{meta.label}</span>
          <span className="ml-2 text-xs text-muted-foreground tabular-nums">{group.count} event{group.count !== 1 ? 's' : ''}</span>
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
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
                <button
                  type="button"
                  onClick={() => {
                    onFlag({
                      variant_id:   log.variant_id,
                      product_name: name,
                      note:         '',
                      priority:     group.kind === 'writeoff' ? 'urgent' : 'watch',
                    })
                  }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors shrink-0"
                  title="Flag for handover"
                >
                  <Flag className="h-3 w-3" />
                  Flag
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Flagged item editor ──────────────────────────────────────────────────────

const PRIORITY_CFG = {
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800' },
  watch:  { label: 'Watch',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  info:   { label: 'Info',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
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
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{item.product_name}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {priorities.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { onChange({ ...item, priority: p }) }}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors',
                item.priority === p ? PRIORITY_CFG[p].cls : 'border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              {PRIORITY_CFG[p].label}
            </button>
          ))}
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <input
        type="text"
        placeholder="Add a note for the incoming team…"
        value={item.note}
        onChange={(e) => { onChange({ ...item, note: e.target.value }) }}
        className="w-full rounded border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
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
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (handovers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <ClipboardList className="h-7 w-7 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">No handovers recorded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {handovers.map((h) => {
        const author = h.author_email ?? (h.created_by ? (emailMap.get(h.created_by) ?? h.created_by.slice(0, 8)) : 'Unknown')
        const isOpen = expandedId === h.id
        return (
          <div key={h.id} className="rounded-lg border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => { setExpandedId(isOpen ? null : h.id) }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  {h.window_hours}h shift · {format(new Date(h.created_at), 'dd MMM, HH:mm')}
                </p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <User className="h-2.5 w-2.5" />{author}
                  {h.flagged_items.length > 0 && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      · {h.flagged_items.length} flagged
                    </span>
                  )}
                </p>
              </div>
              {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
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
                        <span className={cn(
                          'mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border shrink-0',
                          PRIORITY_CFG[fi.priority]?.cls ?? PRIORITY_CFG.info.cls,
                        )}>
                          {PRIORITY_CFG[fi.priority]?.label ?? fi.priority}
                        </span>
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
          </div>
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
      // Prevent duplicates — replace if same variant
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
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Shift Handover
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? 'Loading activity…'
              : `${logs.length} event${logs.length !== 1 ? 's' : ''} in the last ${windowHours}h`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Window selector */}
          <div className="flex items-center gap-0.5 rounded-md border p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.hours}
                type="button"
                onClick={() => { setWindowHours(w.hours as 4 | 8 | 12 | 24) }}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  windowHours === w.hours
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowPrevious((v) => !v) }}
            className="gap-1.5 text-xs h-8"
          >
            <Clock className="h-3.5 w-3.5" />
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
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : digest.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CheckCircle2 className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No activity in this window</p>
              </div>
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

            {/* Notes textarea */}
            <Textarea
              placeholder="What should the incoming team know? Any issues, pending decisions, context..."
              value={notes}
              onChange={(e) => { setNotes(e.target.value) }}
              className="resize-none text-sm min-h-[120px]"
            />

            {/* Flagged items */}
            {flaggedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Flag className="h-3 w-3 text-amber-500" />
                    Flagged for attention
                  </p>
                  {urgentCount > 0 && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px] border-red-300 text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{urgentCount} urgent
                    </Badge>
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
                <Flag className="h-3 w-3" />
                Expand activity cards on the left and click "Flag" to add items
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex-shrink-0 border-t px-6 py-4">
            <Button
              className="w-full gap-2"
              onClick={handleSubmit}
              disabled={createHandover.isPending || (!notes.trim() && flaggedItems.length === 0)}
            >
              {createHandover.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />}
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

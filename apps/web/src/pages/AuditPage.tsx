// Layer: Flow — Immutable audit trail as a live event timeline
// Palantir principle: auditability is a first-class feature, not a debug tool.
// Operators must always be able to see why the world is the way it is.

import { useState, useMemo } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import {
  Download, FileText, Search, RotateCcw, PlusCircle, MinusCircle,
  Wifi, WifiOff, Camera, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { exportToCsv } from '@/lib/csv'
import { exportToPdf } from '@/lib/pdf'
import { useAuditLog } from '@/features/inventory/hooks/reports'
import { useUndoStock } from '@/features/inventory/hooks'
import { useTeamMembers } from '@/features/team/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission, REMOVAL_CATEGORIES } from '@beacon/types'
import type { AuditLogRow } from '@/features/inventory/api/reports'

// ─── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ rows }: { rows: AuditLogRow[] }) {
  const nonReverts = rows.filter((r) => !r.is_revert)
  const totalIn   = nonReverts.filter((r) => r.quantity_change > 0).reduce((s, r) => s + r.quantity_change, 0)
  const totalOut  = nonReverts.filter((r) => r.quantity_change < 0).reduce((s, r) => s + Math.abs(r.quantity_change), 0)
  const reverts   = rows.filter((r) => r.is_revert).length

  return (
    <div className="flex items-center gap-6 px-8 py-3 border-b bg-muted/30 text-sm">
      <span className="text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">{rows.length}</span> events
      </span>
      <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
        <PlusCircle className="h-3.5 w-3.5" />
        <span className="tabular-nums font-semibold">+{totalIn}</span>
        <span className="text-muted-foreground text-xs">units added</span>
      </span>
      <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
        <MinusCircle className="h-3.5 w-3.5" />
        <span className="tabular-nums font-semibold">{totalOut}</span>
        <span className="text-muted-foreground text-xs">units removed</span>
      </span>
      {reverts > 0 && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="tabular-nums font-semibold">{reverts}</span>
          <span className="text-xs">reverted</span>
        </span>
      )}
    </div>
  )
}

// ─── Date group label ──────────────────────────────────────────────────────────

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, MMM d, yyyy')
}

// ─── Event card ────────────────────────────────────────────────────────────────

function EventCard({
  row,
  canUndo,
  isReverted,
  emailMap,
  onUndo,
  undoPending,
}: {
  row: AuditLogRow
  canUndo: boolean
  isReverted: boolean
  emailMap: Map<string, string>
  onUndo: (id: string) => void
  undoPending: boolean
}) {
  const isAdd    = !row.is_revert && row.quantity_change > 0
  const isRemove = !row.is_revert && row.quantity_change < 0
  const isRevert = row.is_revert

  const dotColor = isAdd ? 'bg-green-500' : isRevert ? 'bg-muted-foreground/50' : 'bg-red-500'
  const changeColor = isAdd ? 'text-green-700 dark:text-green-400' : isRevert ? 'text-muted-foreground' : 'text-red-700 dark:text-red-400'
  const balanceBefore = row.balance_after - row.quantity_change

  const displayName = row.variant_name !== 'Standard'
    ? `${row.product_name} — ${row.variant_name}`
    : row.product_name

  const userLabel = row.user_id
    ? (emailMap.get(row.user_id) ?? row.user_id.slice(0, 8) + '…')
    : null

  return (
    <div className="relative flex gap-4">
      {/* Timeline spine dot */}
      <div className="flex flex-col items-center pt-1.5">
        <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-background', dotColor)} />
        {/* spine line rendered by parent */}
      </div>

      {/* Card */}
      <div className={cn(
        'mb-3 flex-1 rounded-lg border bg-card px-4 py-3 shadow-sm',
        isReverted && 'opacity-60',
        isRevert && 'border-dashed bg-muted/40',
      )}>
        <div className="flex items-start justify-between gap-3">
          {/* Left: product + change */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2 mb-1">
              <span className="text-sm font-semibold leading-tight">{displayName}</span>
              <span className={cn('tabular-nums text-sm font-bold', changeColor)}>
                {row.quantity_change > 0 ? '+' : ''}{row.quantity_change}
              </span>
              {/* Balance arrow */}
              <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                {balanceBefore}
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium text-foreground">{row.balance_after}</span>
              </span>
            </div>

            {/* Reason */}
            <p className="text-sm text-muted-foreground leading-snug mb-2">{row.reason}</p>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {isAdd && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                  Addition
                </Badge>
              )}
              {isRemove && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                  Removal
                </Badge>
              )}
              {isRevert && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                  <RotateCcw className="mr-1 h-2.5 w-2.5" />Undo
                </Badge>
              )}
              {isReverted && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground border-dashed">
                  Reverted
                </Badge>
              )}
              {row.removal_category && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {row.removal_category}
                </Badge>
              )}
              {userLabel && (
                <span className="text-[10px] text-muted-foreground">{userLabel}</span>
              )}
              {row.was_offline && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                  <WifiOff className="h-2.5 w-2.5" />offline
                </span>
              )}
              {!row.was_offline && row.photo_url && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Wifi className="h-2.5 w-2.5" />online
                </span>
              )}
            </div>
          </div>

          {/* Right: time + photo + undo */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className="text-xs tabular-nums text-muted-foreground">
              {format(new Date(row.timestamp), 'HH:mm')}
            </span>

            {row.photo_url && (
              <a href={row.photo_url} target="_blank" rel="noopener noreferrer">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <Camera className="h-3 w-3" />
                  <img
                    src={row.photo_url}
                    alt="evidence"
                    className="h-10 w-10 rounded border object-cover hover:opacity-80 transition-opacity"
                  />
                </div>
              </a>
            )}

            {canUndo && !row.is_revert && !isReverted && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => { onUndo(row.id) }}
                disabled={undoPending}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Undo
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Timeline view ─────────────────────────────────────────────────────────────

function Timeline({
  rows,
  canUndo,
  revertedIds,
  emailMap,
  onUndo,
  undoPending,
}: {
  rows: AuditLogRow[]
  canUndo: boolean
  revertedIds: Set<string>
  emailMap: Map<string, string>
  onUndo: (id: string) => void
  undoPending: boolean
}) {
  // Group rows by calendar date
  const groups = useMemo(() => {
    const map = new Map<string, AuditLogRow[]>()
    for (const row of rows) {
      const dayKey = format(new Date(row.timestamp), 'yyyy-MM-dd')
      const existing = map.get(dayKey) ?? []
      existing.push(row)
      map.set(dayKey, existing)
    }
    // Return sorted descending (most recent first, already sorted from API)
    return [...map.entries()].map(([key, events]) => ({ key, events }))
  }, [rows])

  return (
    <div className="space-y-8">
      {groups.map(({ key, events }) => (
        <div key={key}>
          {/* Date header */}
          <div className="sticky top-0 z-10 flex items-center gap-3 py-2 bg-background/95 backdrop-blur-sm mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
              {dateLabel(events[0].timestamp)}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Events for this day */}
          <div className="relative ml-4">
            {/* Vertical spine line */}
            <div className="absolute left-[4px] top-3 bottom-3 w-px bg-border" />

            {events.map((row) => (
              <EventCard
                key={row.id}
                row={row}
                canUndo={canUndo}
                isReverted={revertedIds.has(row.id)}
                emailMap={emailMap}
                onUndo={onUndo}
                undoPending={undoPending}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const today         = format(new Date(), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  const [dateFrom,        setDateFrom]        = useState(thirtyDaysAgo)
  const [dateTo,          setDateTo]          = useState(today)
  const [search,          setSearch]          = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [userFilter,      setUserFilter]      = useState('__all__')
  const [categoryFilter,  setCategoryFilter]  = useState('__all__')

  const handleSearchChange = (v: string) => {
    setSearch(v)
    clearTimeout((handleSearchChange as { _t?: ReturnType<typeof setTimeout> })._t)
    ;(handleSearchChange as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(
      () => { setDebouncedSearch(v) }, 350
    )
  }

  const role     = useAuthStore((s) => s.role)
  const canUndo  = !!role && hasPermission(role, 'can_undo_logs')
  const undoStock = useUndoStock()
  const { data: members = [] } = useTeamMembers()
  const emailMap  = useMemo(() => new Map(members.map((m) => [m.id, m.email])), [members])

  const { data: allRows = [], isLoading } = useAuditLog({
    dateFrom,
    dateTo,
    search: debouncedSearch || undefined,
  })

  const rows = useMemo(
    () => allRows.filter((r) => {
      if (userFilter !== '__all__' && r.user_id !== userFilter) return false
      if (categoryFilter !== '__all__') {
        if (categoryFilter === '__none__') return !r.removal_category
        if (r.removal_category !== categoryFilter) return false
      }
      return true
    }),
    [allRows, userFilter, categoryFilter]
  )

  const revertedIds = useMemo(
    () => new Set(rows.map((r) => r.revert_of).filter(Boolean) as string[]),
    [rows]
  )

  // ── Export ──
  const csvRows = rows.map((r) => ({
    date:         format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'),
    product:      r.product_name,
    variant:      r.variant_name,
    change:       r.quantity_change,
    balance_after:r.balance_after,
    reason:       r.reason,
    type:         r.is_revert ? 'Revert' : r.quantity_change > 0 ? 'Addition' : 'Removal',
    category:     r.removal_category ?? '',
    offline:      r.was_offline ? 'Yes' : 'No',
    photo:        r.photo_url ?? '',
  }))

  const handleCsv = () => { exportToCsv(`audit-log-${dateFrom}-to-${dateTo}`, csvRows) }
  const handlePdf = () => {
    exportToPdf(
      `Audit Log ${dateFrom} → ${dateTo}`,
      ['Date', 'Product', 'Variant', 'Change', 'Balance', 'Reason', 'Type'],
      rows.map((r) => [
        format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'),
        r.product_name,
        r.variant_name,
        r.quantity_change > 0 ? `+${String(r.quantity_change)}` : String(r.quantity_change),
        r.balance_after,
        r.reason,
        r.is_revert ? 'Revert' : r.quantity_change > 0 ? 'Add' : 'Remove',
      ])
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Flow · Audit Trail</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every stock movement, immutable and traceable. Corrections create compensating events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCsv} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdf} disabled={rows.length === 0}>
            <FileText className="mr-2 h-4 w-4" />PDF
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4 border-b px-8 py-4 flex-shrink-0">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value) }} className="w-36 h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value) }} className="w-36 h-8 text-sm" />
        </div>
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <Label className="text-xs">Search reason</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Filter by reason…" value={search}
              onChange={(e) => { handleSearchChange(e.target.value) }}
              className="pl-8 h-8 text-sm" />
          </div>
        </div>
        {members.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">User</Label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All users" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All users</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              <SelectItem value="__none__">— No category —</SelectItem>
              {REMOVAL_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary strip */}
      {rows.length > 0 && <SummaryStrip rows={rows} />}

      {/* Timeline */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <p className="text-sm">Loading timeline…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <RotateCcw className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No events found for this range.</p>
            <p className="text-xs text-muted-foreground">Try widening the date range or clearing filters.</p>
          </div>
        ) : (
          <Timeline
            rows={rows}
            canUndo={canUndo}
            revertedIds={revertedIds}
            emailMap={emailMap}
            onUndo={(id) => { undoStock.mutate(id) }}
            undoPending={undoStock.isPending}
          />
        )}
      </div>
    </div>
  )
}

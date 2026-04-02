// Layer: Eye — Date Reminder management
// Sortly-equivalent feature: DateReminder alert type.
// Every variant can have a reminder_date + reminder_label for arbitrary scheduled
// events: maintenance, warranty expiry, inspection, permit renewal, certification.
// Palantir principle: every number carries its context — cost exposure is shown
// alongside each overdue/upcoming item so the operator understands what's at stake.

import { useMemo, useState } from 'react'
import { Bell, CheckCircle2, Loader2, AlertTriangle, Search, Download } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { exportToCsv } from '@/lib/csv'
import { useUpcomingReminders } from '@/features/inventory/hooks'
import { formatCurrency } from '@/lib/currency'
import { daysUntil } from '@/lib/date'
import { useCurrency } from '@/hooks/useCurrency'
import { useDateFormat } from '@/features/user/hooks'
import type { ReminderVariant } from '@/features/inventory/api'

// ─── Helpers ───────────────────────────────────────────────────────────────────

type Band = 'overdue' | 'urgent' | 'soon' | 'upcoming'

function getBand(days: number): Band {
  if (days < 0)   return 'overdue'
  if (days <= 7)  return 'urgent'
  if (days <= 30) return 'soon'
  return 'upcoming'
}

const BAND_META: Record<Band, {
  label: string
  dotColor: string
  rowBg: string
  textColor: string
  badgeCls: string
}> = {
  overdue:  {
    label: 'Overdue',
    dotColor: 'bg-red-600',
    rowBg: 'bg-red-50/70 dark:bg-red-950/25',
    textColor: 'text-red-700 dark:text-red-400',
    badgeCls: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  },
  urgent: {
    label: '≤ 7 days',
    dotColor: 'bg-orange-500',
    rowBg: 'bg-orange-50/60 dark:bg-orange-950/20',
    textColor: 'text-orange-700 dark:text-orange-400',
    badgeCls: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  },
  soon: {
    label: '≤ 30 days',
    dotColor: 'bg-yellow-500',
    rowBg: 'bg-yellow-50/50 dark:bg-yellow-950/15',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    badgeCls: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
  },
  upcoming: {
    label: '≤ 90 days',
    dotColor: 'bg-muted-foreground/50',
    rowBg: '',
    textColor: 'text-muted-foreground',
    badgeCls: 'border-border text-muted-foreground',
  },
}

// ─── Window options ─────────────────────────────────────────────────────────────

const WINDOWS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

// ─── Summary strip ──────────────────────────────────────────────────────────────

function SummaryStrip({
  enriched,
  currency,
}: {
  enriched: (ReminderVariant & { days: number })[],
  currency: string,
}) {
  const overdue = enriched.filter((v) => v.days < 0)
  const urgent  = enriched.filter((v) => v.days >= 0 && v.days <= 7)
  const soon    = enriched.filter((v) => v.days > 7 && v.days <= 30)

  const totalStake = enriched.reduce((s, v) => s + v.current_stock * v.cost, 0)

  if (enriched.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-6 px-8 py-3 border-b bg-muted/30 text-sm">
      <span className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{enriched.length}</span> reminders due
        {totalStake > 0 && (
          <>{' · '}<span className="font-semibold text-foreground">{formatCurrency(totalStake, currency)}</span> inventory at stake</>
        )}
      </span>
      {overdue.length > 0 && (
        <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-semibold tabular-nums">{overdue.length}</span>
          <span className="text-xs text-muted-foreground">overdue</span>
        </span>
      )}
      {urgent.length > 0 && (
        <span className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
          <Bell className="h-3.5 w-3.5" />
          <span className="font-semibold tabular-nums">{urgent.length}</span>
          <span className="text-xs text-muted-foreground">within 7 days</span>
        </span>
      )}
      {soon.length > 0 && (
        <span className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400">
          <span className="font-semibold tabular-nums">{soon.length}</span>
          <span className="text-xs text-muted-foreground">within 30 days</span>
        </span>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(90)
  const { data: reminders = [], isLoading } = useUpcomingReminders(windowDays)
  const currency = useCurrency()
  const fmtDate = useDateFormat()

  const [search, setSearch]           = useState('')
  const [bandFilter, setBandFilter]   = useState<Band | '__all__'>('__all__')
  const [labelFilter, setLabelFilter] = useState<string>('__all__')

  const enriched = useMemo(() =>
    reminders
      .filter((v) => v.reminder_date)
      .map((v) => ({ ...v, days: daysUntil(v.reminder_date!) }))
      .sort((a, b) => a.days - b.days),
    [reminders],
  )

  // All unique reminder_label values for the label filter
  const allLabels = useMemo(() => {
    const set = new Set<string>()
    for (const v of enriched) {
      if (v.reminder_label) set.add(v.reminder_label)
    }
    return [...set].sort()
  }, [enriched])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter((v) => {
      if (bandFilter !== '__all__' && getBand(v.days) !== bandFilter) return false
      if (labelFilter !== '__all__' && v.reminder_label !== labelFilter) return false
      if (q) {
        const displayName = v.products?.name
          ? (v.name !== 'Standard' ? `${v.products.name} — ${v.name}` : v.products.name)
          : v.name
        if (
          !displayName.toLowerCase().includes(q) &&
          !v.sku.toLowerCase().includes(q) &&
          !(v.reminder_label?.toLowerCase().includes(q) ?? false)
        ) return false
      }
      return true
    })
  }, [enriched, bandFilter, labelFilter, search])

  const handleExport = () => {
    exportToCsv(`reminders-${format(new Date(), 'yyyy-MM-dd')}`, filtered.map((v) => ({
      product: v.products?.name ?? '—',
      variant: v.name,
      sku: v.sku,
      reminder_label: v.reminder_label ?? '',
      due_date: v.reminder_date ?? '',
      days_until: v.days,
      status: getBand(v.days),
      current_stock: v.current_stock,
      value_at_stake: (v.current_stock * v.cost).toFixed(2),
    })))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Eye · Reminders</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : enriched.length === 0
                ? `No reminders due within ${String(windowDays)} days`
                : `${String(enriched.length)} reminder${enriched.length !== 1 ? 's' : ''} due within ${String(windowDays)} days`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          {/* Window toggle */}
          <div className="flex gap-0.5 rounded-md border p-0.5">
            {WINDOWS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => { setWindowDays(opt.days) }}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  windowDays === opt.days
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {!isLoading && <SummaryStrip enriched={enriched} currency={currency} />}

      {/* Filter bar */}
      {enriched.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b px-8 py-3 flex-shrink-0 bg-muted/20">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product or SKU…"
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              className="pl-9 h-8 text-sm"
            />
          </div>

          {/* Urgency band filter */}
          <Select value={bandFilter} onValueChange={(v) => { setBandFilter(v as Band | '__all__') }}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="All urgencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All urgencies</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="urgent">≤ 7 days</SelectItem>
              <SelectItem value="soon">≤ 30 days</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
            </SelectContent>
          </Select>

          {/* Reminder label filter */}
          {allLabels.length > 1 && (
            <Select value={labelFilter} onValueChange={setLabelFilter}>
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                {allLabels.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(search || bandFilter !== '__all__' || labelFilter !== '__all__') && (
            <button
              type="button"
              onClick={() => { setSearch(''); setBandFilter('__all__'); setLabelFilter('__all__') }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…
          </div>
        ) : enriched.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500/60" />
            <p className="text-sm font-medium">No reminders due</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              No variants have reminder dates set within the next {String(windowDays)} days.
              Add reminder dates to variants (maintenance, warranty, inspection) to see them here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-sm text-muted-foreground">No reminders match the current filter.</p>
            <button
              type="button"
              onClick={() => { setSearch(''); setBandFilter('__all__'); setLabelFilter('__all__') }}
              className="text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Reminder type</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Value at stake</TableHead>
                  <TableHead className="text-right">Due date</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => {
                  const band  = getBand(v.days)
                  const meta  = BAND_META[band]
                  const displayName = v.products?.name
                    ? (v.name !== 'Standard' ? `${v.products.name} — ${v.name}` : v.products.name)
                    : v.name
                  const daysLabel =
                    v.days < 0
                      ? `Overdue ${String(Math.abs(v.days))}d`
                      : v.days === 0
                        ? 'Due today'
                        : `${String(v.days)}d`
                  const valueAtStake = v.current_stock * v.cost

                  return (
                    <TableRow key={v.id} className={meta.rowBg}>
                      <TableCell className="font-medium text-sm">{displayName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{v.sku}</TableCell>
                      <TableCell className="text-sm">
                        {v.reminder_label
                          ? <span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5 text-muted-foreground" />{v.reminder_label}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{v.current_stock}</TableCell>
                      <TableCell className={cn('text-right tabular-nums font-semibold text-sm', meta.textColor)}>
                        {valueAtStake > 0 ? formatCurrency(valueAtStake, currency) : <span className="text-muted-foreground font-normal">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {fmtDate(v.reminder_date!)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] h-5 px-1.5 font-semibold', meta.badgeCls)}
                        >
                          {daysLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

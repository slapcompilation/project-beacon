// Layer: Eye — Date Reminder management
// Sortly-equivalent feature: DateReminder alert type.
// Every variant can have a reminder_date + reminder_label for arbitrary scheduled
// events: maintenance, warranty expiry, inspection, permit renewal, certification.
// Palantir principle: every number carries its context — cost exposure is shown
// alongside each overdue/upcoming item so the operator understands what's at stake.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Button,
  HTMLSelect,
  HTMLTable,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
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
  rowBg: string
  textColor: string
  tagIntent: Intent
  tagMinimal: boolean
}> = {
  overdue:  {
    label: 'Overdue',
    rowBg: 'bg-red-50/70 dark:bg-red-950/25',
    textColor: 'text-red-700 dark:text-red-400',
    tagIntent: Intent.DANGER,
    tagMinimal: false,
  },
  urgent: {
    label: '≤ 7 days',
    rowBg: 'bg-orange-50/60 dark:bg-orange-950/20',
    textColor: 'text-orange-700 dark:text-orange-400',
    tagIntent: Intent.WARNING,
    tagMinimal: false,
  },
  soon: {
    label: '≤ 30 days',
    rowBg: 'bg-yellow-50/50 dark:bg-yellow-950/15',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    tagIntent: Intent.WARNING,
    tagMinimal: true,
  },
  upcoming: {
    label: '≤ 90 days',
    rowBg: '',
    textColor: 'text-muted-foreground',
    tagIntent: Intent.NONE,
    tagMinimal: true,
  },
}

// ─── Window options ─────────────────────────────────────────────────────────────

const WINDOWS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

// ─── Summary strip ──────────────────────────────────────────────────────────────

function SummaryStrip({
  enriched,
  currency,
}: {
  enriched: (ReminderVariant & { days: number })[]
  currency: string
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
          <Icon icon="warning-sign" size={14} />
          <span className="font-semibold tabular-nums">{overdue.length}</span>
          <span className="text-xs text-muted-foreground">overdue</span>
        </span>
      )}
      {urgent.length > 0 && (
        <span className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
          <Icon icon="notifications" size={14} />
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
      .map((v) => ({ ...v, days: daysUntil(v.reminder_date ?? '') }))
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
        <div className="flex items-center gap-3">
          <Button
            icon="download"
            size="small"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            CSV
          </Button>
          <SegmentedControl
            size="small"
            value={String(windowDays)}
            onValueChange={(v) => { setWindowDays(parseInt(v, 10) as 7 | 30 | 90) }}
            options={WINDOWS.map((w) => ({ value: String(w.days), label: w.label }))}
          />
        </div>
      </div>

      {/* Summary strip */}
      {!isLoading && <SummaryStrip enriched={enriched} currency={currency} />}

      {/* Filter bar */}
      {enriched.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b px-8 py-3 flex-shrink-0 bg-muted/20">
          <InputGroup
            leftIcon="search"
            className="flex-1 min-w-[180px] max-w-xs"
            placeholder="Search product or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
          />

          {/* Urgency band filter */}
          <HTMLSelect
            value={bandFilter}
            onChange={(e) => { setBandFilter(e.target.value as Band | '__all__') }}
            options={[
              { value: '__all__', label: 'All urgencies' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'urgent',  label: '≤ 7 days' },
              { value: 'soon',    label: '≤ 30 days' },
              { value: 'upcoming',label: 'Upcoming' },
            ]}
          />

          {/* Reminder label filter */}
          {allLabels.length > 1 && (
            <HTMLSelect
              value={labelFilter}
              onChange={(e) => { setLabelFilter(e.target.value) }}
              options={[
                { value: '__all__', label: 'All types' },
                ...allLabels.map((l) => ({ value: l, label: l })),
              ]}
            />
          )}

          {(search || bandFilter !== '__all__' || labelFilter !== '__all__') && (
            <Button
              variant="minimal"
              size="small"
              onClick={() => { setSearch(''); setBandFilter('__all__'); setLabelFilter('__all__') }}
              className="ml-auto"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </div>
        ) : enriched.length === 0 ? (
          <NonIdealState
            icon="tick-circle"
            title="No reminders due"
            description={`No variants have reminder dates set within the next ${String(windowDays)} days. Add reminder dates to variants (maintenance, warranty, inspection) to see them here.`}
          />
        ) : filtered.length === 0 ? (
          <NonIdealState
            icon="search"
            title="No matches"
            description="No reminders match the current filter."
            action={
              <Button
                variant="minimal"
                intent={Intent.PRIMARY}
                onClick={() => { setSearch(''); setBandFilter('__all__'); setLabelFilter('__all__') }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <HTMLTable compact striped interactive className="w-full">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Reminder type</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Value at stake</th>
                <th className="text-right">Due date</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
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
                  <tr key={v.id} className={meta.rowBg}>
                    <td className="font-medium text-sm">{displayName}</td>
                    <td className="font-mono text-xs text-muted-foreground">{v.sku}</td>
                    <td className="text-sm">
                      {v.reminder_label
                        ? <span className="flex items-center gap-1.5"><Icon icon="notifications" size={14} className="text-muted-foreground" />{v.reminder_label}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-right tabular-nums font-semibold">{v.current_stock}</td>
                    <td className={cn('text-right tabular-nums font-semibold text-sm', meta.textColor)}>
                      {valueAtStake > 0 ? formatCurrency(valueAtStake, currency) : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    <td className="text-right text-sm text-muted-foreground tabular-nums">
                      {fmtDate(v.reminder_date)}
                    </td>
                    <td className="text-right">
                      <Tag intent={meta.tagIntent} minimal={meta.tagMinimal}>{daysLabel}</Tag>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </HTMLTable>
        )}
      </div>
    </div>
  )
}

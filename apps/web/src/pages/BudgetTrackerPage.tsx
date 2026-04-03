// Layer: Mind — Financial Intelligence
// Palantir principle: decision support, not data display.
// Knowing you spent $4,200 last month is data.
// Knowing you're 18% over the F&B budget with 12 days remaining is a decision.

import { useState, useRef, useEffect } from 'react'
import { format, getDaysInMonth, getDate } from 'date-fns'
import {
  TrendingUp, Loader2, AlertTriangle,
  CheckCircle2, Target, Pencil, Trash2, Check, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import {
  useBudgetVsActual, useBudgetTrend,
  useUpsertBudgetAllocation, useDeleteBudgetAllocation,
} from '@/features/mind/hooks'
import type { BudgetVsActualRow, BudgetTrendRow } from '@beacon/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  over:       { cls: 'text-red-600 dark:text-red-400',     bar: 'bg-red-500',     badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',     label: 'Over budget'  },
  warning:    { cls: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', label: 'Near limit'   },
  on_track:   { cls: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', label: 'On track' },
  unbudgeted: { cls: 'text-muted-foreground', bar: 'bg-muted', badge: 'bg-muted text-muted-foreground', label: 'No budget' },
} as const

function fmt(n: number, currency: string): string { return formatCurrency(n, currency) }

/** Remaining days in the current month as a fraction for "days left" context */
function daysLeftInMonth(): number {
  const today = new Date()
  return getDaysInMonth(today) - getDate(today)
}

// ─── Inline budget editor ─────────────────────────────────────────────────────

function BudgetInput({
  current,
  currency,
  onSave,
  onClear,
}: {
  current: number | null
  currency: string
  onSave: (amount: number) => void
  onClear: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(current?.toString() ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setValue(current?.toString() ?? '')
      setTimeout(() => { inputRef.current?.focus() }, 0)
    }
  }, [editing, current])

  const handleSave = () => {
    const n = parseFloat(value)
    if (!isNaN(n) && n >= 0) {
      onSave(n)
      setEditing(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{currency}</span>
        <input
          ref={inputRef}
          type="number"
          min={0}
          step={10}
          value={value}
          onChange={(e) => { setValue(e.target.value) }}
          onKeyDown={handleKey}
          className="w-24 text-xs border rounded px-1.5 py-0.5 bg-background tabular-nums"
        />
        <button type="button" onClick={handleSave} className="text-emerald-600 hover:text-emerald-700 p-0.5">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => { setEditing(false) }} className="text-muted-foreground hover:text-foreground p-0.5">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      {current !== null ? (
        <>
          <span className="text-xs tabular-nums font-medium">{fmt(current, currency)}</span>
          <button type="button" onClick={() => { setEditing(true) }} className="text-muted-foreground hover:text-foreground p-0.5">
            <Pencil className="h-3 w-3" />
          </button>
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-red-500 p-0.5">
            <Trash2 className="h-3 w-3" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => { setEditing(true) }}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Set budget
        </button>
      )}
    </div>
  )
}

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryBudgetRow({
  row,
  currency,
  periodMonth,
  onSave,
  onClear,
}: {
  row: BudgetVsActualRow
  currency: string
  periodMonth: Date
  onSave: (categoryId: string | null, amount: number) => void
  onClear: (categoryId: string | null) => void
}) {
  const meta      = STATUS_META[row.status]
  const barWidth  = Math.min(row.spend_pct ?? 0, 120)  // allow bar to overflow for over-budget
  const daysLeft  = daysLeftInMonth()
  const isCurrentMonth = periodMonth.getMonth() === new Date().getMonth() &&
                         periodMonth.getFullYear() === new Date().getFullYear()

  // Projected spend = actual / days_elapsed * total_days_in_month
  const daysElapsed = getDate(new Date())
  const daysTotal   = getDaysInMonth(new Date())
  const projected   = isCurrentMonth && row.actual_spend > 0 && daysElapsed > 0
    ? Math.round((row.actual_spend / daysElapsed) * daysTotal)
    : null

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0', meta.badge)}>
            {meta.label}
          </span>
          <span className="text-xs font-semibold truncate">{row.category_name}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {/* Actual spend */}
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Actual</p>
            <p className="text-xs font-semibold tabular-nums">{fmt(row.actual_spend, currency)}</p>
          </div>
          {/* Budget setter */}
          <div className="text-right min-w-24">
            <p className="text-[10px] text-muted-foreground">Budget</p>
            <BudgetInput
              current={row.allocated_amount}
              currency={currency}
              onSave={(amount) => { onSave(row.category_id, amount) }}
              onClear={() => { onClear(row.category_id) }}
            />
          </div>
          {/* Variance */}
          {row.variance !== null && (
            <div className="text-right w-24">
              <p className="text-[10px] text-muted-foreground">Variance</p>
              <p className={cn('text-xs font-semibold tabular-nums', meta.cls)}>
                {row.variance >= 0 ? '+' : ''}{fmt(row.variance, currency)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {row.allocated_amount !== null && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', meta.bar)}
              style={{ width: `${Math.min(barWidth, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="tabular-nums">
              {row.spend_pct?.toFixed(0)}% of budget used
              {isCurrentMonth && daysLeft > 0 && ` · ${daysLeft} days left`}
            </span>
            {projected !== null && row.allocated_amount !== null && projected > row.allocated_amount && (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />
                Proj. {fmt(projected, currency)} at current rate
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Summary KPI Strip ────────────────────────────────────────────────────────

function BudgetKPIStrip({ rows, currency }: { rows: BudgetVsActualRow[]; currency: string }) {
  const budgeted      = rows.filter((r) => r.allocated_amount !== null)
  const totalBudget   = budgeted.reduce((s, r) => s + (r.allocated_amount ?? 0), 0)
  const totalActual   = rows.reduce((s, r) => s + r.actual_spend, 0)
  const overCount     = rows.filter((r) => r.status === 'over').length
  const coverageCount = budgeted.length
  const totalCats     = rows.length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Budget</p>
        {totalBudget > 0 ? (
          <>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalBudget, currency)}</p>
            <p className="text-[10px] text-muted-foreground">{coverageCount} of {totalCats} categories budgeted</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No budgets set</p>
        )}
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Actual</p>
        <p className="text-2xl font-bold tabular-nums">{fmt(totalActual, currency)}</p>
        {totalBudget > 0 && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {((totalActual / totalBudget) * 100).toFixed(1)}% of total budget
          </p>
        )}
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Over Budget</p>
        <p className={cn('text-2xl font-bold', overCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
          {overCount}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {overCount === 0 ? 'All categories within limit' : `categor${overCount === 1 ? 'y' : 'ies'} exceeded`}
        </p>
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Remaining</p>
        {totalBudget > 0 ? (
          <>
            <p className={cn('text-2xl font-bold tabular-nums', totalActual > totalBudget ? 'text-red-600 dark:text-red-400' : '')}>
              {fmt(Math.max(0, totalBudget - totalActual), currency)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {daysLeftInMonth()} days remaining this month
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>
    </div>
  )
}

// ─── Trend Table ──────────────────────────────────────────────────────────────

function BudgetTrendTable({ rows, currency }: { rows: BudgetTrendRow[]; currency: string }) {
  const sorted = [...rows].sort((a, b) => b.period_month.localeCompare(a.period_month))

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="px-4 py-2 bg-muted/30 flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Budget Adherence Trend
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/10">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Period</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Budget</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Actual</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Variance</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Used %</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Over Limit</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((row) => {
              const variance = row.total_budgeted !== null
                ? row.total_budgeted - row.total_actual
                : null
              return (
                <tr key={row.period_month} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{row.period_label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {row.total_budgeted !== null ? fmt(row.total_budgeted, currency) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    {fmt(row.total_actual, currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {variance !== null ? (
                      <span className={variance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {variance >= 0 ? '+' : ''}{fmt(variance, currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {row.spend_pct !== null ? (
                      <span className={row.spend_pct > 100 ? 'text-red-600 dark:text-red-400 font-semibold' : row.spend_pct > 85 ? 'text-amber-600 dark:text-amber-400' : ''}>
                        {row.spend_pct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {row.categories_over_budget > 0 ? (
                      <span className="text-red-600 dark:text-red-400 font-semibold">{row.categories_over_budget}</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.on_track === null ? (
                      <span className="text-muted-foreground text-[10px]">No budgets</span>
                    ) : row.on_track ? (
                      <span className="flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> On track
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-1 text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> Over
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Month Picker ─────────────────────────────────────────────────────────────

function MonthPicker({
  year, month,
  onChange,
}: {
  year: number
  month: number
  onChange: (y: number, m: number) => void
}) {
  const now    = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ y: d.getFullYear(), m: d.getMonth() + 1, label: format(d, 'MMM yyyy') })
  }

  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      {months.map((opt) => (
        <button
          key={`${opt.y}-${opt.m}`}
          type="button"
          onClick={() => { onChange(opt.y, opt.m) }}
          className={cn(
            'px-2.5 py-1 text-[10px] rounded transition-colors',
            year === opt.y && month === opt.m
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetTrackerPage() {
  const currency = useCurrency()
  const now      = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: budgetRows = [], isLoading: budgetLoading } = useBudgetVsActual(year, month)
  const { data: trendRows  = [], isLoading: trendLoading  } = useBudgetTrend(6)
  const upsert = useUpsertBudgetAllocation()
  const remove = useDeleteBudgetAllocation()

  const periodMonth = new Date(year, month - 1, 1)

  const handleSave = (categoryId: string | null, amount: number) => {
    upsert.mutate({ categoryId, periodMonth, amount })
  }

  const handleClear = (categoryId: string | null) => {
    remove.mutate({ categoryId, periodMonth })
  }

  const isLoading = budgetLoading || trendLoading

  const overRows   = budgetRows.filter((r) => r.status === 'over')
  const activeRows = [...budgetRows].sort((a, b) => {
    const order = { over: 0, warning: 1, on_track: 2, unbudgeted: 3 }
    return order[a.status] - order[b.status]
  })

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0 flex-wrap">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Budget vs Actual</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Set monthly spend targets per category · track actuals in real-time
          </p>
        </div>
        <MonthPicker
          year={year} month={month}
          onChange={(y, m) => { setYear(y); setMonth(m) }}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Over-budget alert banner */}
          {overRows.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 dark:text-red-300">
                <span className="font-semibold">{overRows.length} categor{overRows.length === 1 ? 'y has' : 'ies have'} exceeded budget: </span>
                {overRows.map((r) => r.category_name).join(', ')} — review spending or adjust budget targets.
              </p>
            </div>
          )}

          <BudgetKPIStrip rows={budgetRows} currency={currency} />

          {/* Category list */}
          {activeRows.length === 0 ? (
            <div className="rounded-lg border px-4 py-12 flex flex-col items-center gap-3 text-center">
              <Target className="h-8 w-8 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No spend activity for {format(periodMonth, 'MMMM yyyy')}</p>
                <p className="text-xs text-muted-foreground">Spend or write-offs logged in this month will appear here. Budget targets can be set per category.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              <div className="px-4 py-2 bg-muted/30">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Categories · {format(periodMonth, 'MMMM yyyy')}
                </p>
              </div>
              {activeRows.map((row) => (
                <CategoryBudgetRow
                  key={row.category_id ?? 'uncategorised'}
                  row={row}
                  currency={currency}
                  periodMonth={periodMonth}
                  onSave={handleSave}
                  onClear={handleClear}
                />
              ))}
              <div className="px-4 py-2 bg-muted/10">
                <p className="text-[10px] text-muted-foreground">
                  Click "Set budget" to enter a monthly target · budgets auto-save · over 85% = warning, over 100% = over budget
                </p>
              </div>
            </div>
          )}

          {/* Rolling trend */}
          {trendRows.length > 0 && (
            <BudgetTrendTable rows={trendRows} currency={currency} />
          )}
        </>
      )}
    </div>
  )
}

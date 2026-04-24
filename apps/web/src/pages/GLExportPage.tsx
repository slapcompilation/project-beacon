// Layer: Mind — GL-Ready Export (Sprint 11a)
// Scope: ONE-WAY only. No external API calls.
// Two panels:
//   Left  — Account Mapping: hotel staff bind product categories + write-off types to GL codes.
//   Right — Export: date range → preview → CSV / JSON download.
// Palantir principle: auditability as a first-class feature.
// "Posting garbage to Xero is significantly worse than not posting at all." — hence is_mapped flag.

import { useState, useCallback } from 'react'
import {
  Download, AlertTriangle, Loader2, Check, X, Pencil,
  BookOpen, FileText, Info, ChevronDown, ChevronRight,
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import {
  useGLAccountMappings, useUpsertGLMapping, useDeleteGLMapping,
  useGLExport, useGLExportSummary,
} from '@/features/mind/hooks'
import { useProducts } from '@/features/inventory/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import type { GLAccountMapping, GLExportRow } from '@beacon/types'

// ─── Write-off categories that appear in GL export ────────────────────────────

const WRITE_OFF_CATEGORIES = ['Breakage', 'Theft', 'Spoilage'] as const

// ─── Date range presets ───────────────────────────────────────────────────────

type Preset = 'this_month' | 'last_month' | 'last_30d' | 'last_90d'

function presetDates(preset: Preset): { from: string; to: string } {
  const today = new Date()
  switch (preset) {
    case 'this_month':  return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
    case 'last_month':  return { from: format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'), to: format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd') }
    case 'last_30d':    return { from: format(subDays(today, 30), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
    case 'last_90d':    return { from: format(subDays(today, 90), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
  }
}

// ─── Inline GL code editor ────────────────────────────────────────────────────

function MappingRow({
  label,
  mappingType,
  mappingKey,
  existing,
  onSave,
  onDelete,
}: {
  label:       string
  mappingType: string
  mappingKey:  string
  existing?:   GLAccountMapping
  onSave:      (type: string, key: string, code: string, name: string) => void
  onDelete:    (type: string, key: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [code,    setCode]    = useState(existing?.gl_account_code ?? '')
  const [name,    setName]    = useState(existing?.gl_account_name ?? '')

  const handleSave = () => {
    if (!code.trim()) return
    onSave(mappingType, mappingKey, code.trim(), name.trim() || code.trim())
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  handleSave()
    if (e.key === 'Escape') { setEditing(false); setCode(existing?.gl_account_code ?? ''); setName(existing?.gl_account_name ?? '') }
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded hover:bg-muted/20 group">
      <span className="text-sm flex-1 min-w-0 truncate">{label}</span>

      {editing ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            autoFocus
            value={code}
            onChange={(e) => { setCode(e.target.value) }}
            onKeyDown={handleKeyDown}
            placeholder="Code *"
            className="w-20 rounded border bg-background px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/40"
          />
          <input
            value={name}
            onChange={(e) => { setName(e.target.value) }}
            onKeyDown={handleKeyDown}
            placeholder="Account name"
            className="w-36 rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button type="button" onClick={handleSave} className="rounded p-1 text-primary hover:bg-primary/10">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => { setEditing(false) }} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : existing ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <code className="text-xs font-mono text-foreground bg-muted/60 px-1.5 py-0.5 rounded">{existing.gl_account_code}</code>
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{existing.gl_account_name}</span>
          <div className="hidden group-hover:flex items-center gap-1">
            <button type="button" onClick={() => { setCode(existing.gl_account_code); setName(existing.gl_account_name); setEditing(true) }} className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground">
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => { onDelete(mappingType, mappingKey) }} className="rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setEditing(true) }}
          className="text-xs text-muted-foreground hover:text-primary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          + add code
        </button>
      )}
    </div>
  )
}

// ─── Account mapping panel ────────────────────────────────────────────────────

function AccountMappingPanel({
  mappings,
  categories,
}: {
  mappings:   GLAccountMapping[]
  categories: { id: string; name: string }[]
}) {
  const upsert = useUpsertGLMapping()
  const remove = useDeleteGLMapping()
  const [showCategories,  setShowCategories]  = useState(true)
  const [showWriteOffs,   setShowWriteOffs]   = useState(true)
  const [showDefaults,    setShowDefaults]    = useState(true)

  const mappingMap = new Map(mappings.map((m) => [`${m.mapping_type}:${m.mapping_key}`, m]))

  const handleSave = useCallback((type: string, key: string, code: string, name: string) => {
    upsert.mutate({ mappingType: type, mappingKey: key, code, name })
  }, [upsert])

  const handleDelete = useCallback((type: string, key: string) => {
    remove.mutate({ mappingType: type, mappingKey: key })
  }, [remove])

  const sectionClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2 mt-3 first:mt-0 flex items-center justify-between cursor-pointer hover:text-foreground transition-colors'

  return (
    <div className="text-sm">
      {/* Category mappings */}
      <button type="button" className={sectionClass} onClick={() => { setShowCategories((v) => !v) }}>
        <span>Procurement Expenses · by Category</span>
        {showCategories ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {showCategories && (
        <div>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">No product categories found.</p>
          ) : (
            categories.map((cat) => (
              <MappingRow
                key={cat.id}
                label={cat.name}
                mappingType="category"
                mappingKey={cat.id}
                existing={mappingMap.get(`category:${cat.id}`)}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      )}

      {/* Write-off type mappings */}
      <button type="button" className={sectionClass} onClick={() => { setShowWriteOffs((v) => !v) }}>
        <span>Write-offs · by Removal Category</span>
        {showWriteOffs ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {showWriteOffs && (
        <div>
          {WRITE_OFF_CATEGORIES.map((cat) => (
            <MappingRow
              key={cat}
              label={cat}
              mappingType="write_off"
              mappingKey={cat}
              existing={mappingMap.get(`write_off:${cat}`)}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Default fallbacks */}
      <button type="button" className={sectionClass} onClick={() => { setShowDefaults((v) => !v) }}>
        <span>Default Fallbacks</span>
        {showDefaults ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {showDefaults && (
        <div>
          <MappingRow
            label="Default expense account (procurement)"
            mappingType="default"
            mappingKey="expense"
            existing={mappingMap.get('default:expense')}
            onSave={handleSave}
            onDelete={handleDelete}
          />
          <MappingRow
            label="Default write-off account"
            mappingType="default"
            mappingKey="write_off"
            existing={mappingMap.get('default:write_off')}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </div>
      )}

      <div className="px-3 py-3 mt-2 border-t">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Rows without a specific mapping fall back to the default account. Unmapped rows are flagged in the export preview. Finance can still export and manually assign codes.
        </p>
      </div>
    </div>
  )
}

// ─── CSV / JSON generation ────────────────────────────────────────────────────

function generateCSV(rows: GLExportRow[]): string {
  const header = ['Date', 'Type', 'Reference', 'Description', 'Category', 'GL Account Code', 'GL Account Name', 'Amount', 'Currency', 'Mapped']
  const escape = (v: string | number | boolean) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [
    header.join(','),
    ...rows.map((r) => [
      r.transaction_date,
      r.transaction_type,
      r.reference_label,
      r.description,
      r.category_name,
      r.gl_account_code,
      r.gl_account_name,
      r.amount,
      r.currency,
      r.is_mapped ? 'Yes' : 'No',
    ].map(escape).join(',')),
  ]
  return lines.join('\n')
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Export preview table ─────────────────────────────────────────────────────

function ExportPreview({ rows, currency }: { rows: GLExportRow[]; currency: string }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? rows : rows.slice(0, 30)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No transactions in this date range</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="py-2 px-3 text-left">Date</th>
            <th className="py-2 px-3 text-left">Type</th>
            <th className="py-2 px-3 text-left">Description</th>
            <th className="py-2 px-3 text-left">Category</th>
            <th className="py-2 px-3 text-left">GL Code</th>
            <th className="py-2 px-3 text-left">GL Account</th>
            <th className="py-2 px-3 text-right">Amount</th>
            <th className="py-2 px-3 text-center">Mapped</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((row, i) => (
            <tr
              key={`${row.reference_id}-${String(i)}`}
              className={cn(
                'border-b transition-colors',
                !row.is_mapped ? 'bg-yellow-50/40 dark:bg-yellow-950/10' : 'hover:bg-muted/20',
              )}
            >
              <td className="py-1.5 px-3 whitespace-nowrap text-muted-foreground">{row.transaction_date}</td>
              <td className="py-1.5 px-3 whitespace-nowrap">
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                  row.transaction_type === 'procurement_expense'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                    : 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400',
                )}>
                  {row.transaction_type === 'procurement_expense' ? 'Expense' : 'Write-off'}
                </span>
              </td>
              <td className="py-1.5 px-3 max-w-[200px] truncate" title={row.description}>{row.description}</td>
              <td className="py-1.5 px-3 text-muted-foreground">{row.category_name}</td>
              <td className="py-1.5 px-3">
                {row.gl_account_code
                  ? <code className="font-mono bg-muted/60 px-1 rounded text-[10px]">{row.gl_account_code}</code>
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="py-1.5 px-3 text-muted-foreground truncate max-w-[120px]">{row.gl_account_name || '—'}</td>
              <td className="py-1.5 px-3 text-right tabular-nums font-medium">{formatCurrency(row.amount, currency)}</td>
              <td className="py-1.5 px-3 text-center">
                {row.is_mapped
                  ? <Check className="h-3 w-3 text-green-500 mx-auto" />
                  : <AlertTriangle className="h-3 w-3 text-yellow-500 mx-auto" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 30 && (
        <div className="border-t px-3 py-2 bg-muted/20">
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setShowAll((v) => !v) }}>
            {showAll ? 'Show fewer' : `Show all ${String(rows.length)} rows`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GLExportPage() {
  const role     = useAuthStore((s) => s.role ?? 'limited_access')
  const currency = useCurrency()

  const [preset,            setPreset]            = useState<Preset>('last_month')
  const [customFrom,        setCustomFrom]        = useState('')
  const [customTo,          setCustomTo]          = useState('')
  const [includeWriteOffs,  setIncludeWriteOffs]  = useState(true)
  const [previewLoaded,     setPreviewLoaded]     = useState(false)

  const dates = presetDates(preset)

  const from = dates.from
  const to   = dates.to

  const { data: mappings    = [], isLoading: mappingsLoading } = useGLAccountMappings()
  const { data: summary }                                       = useGLExportSummary(from, to)
  const { data: exportRows  = [], isLoading: exportLoading }   = useGLExport(from, to, includeWriteOffs, previewLoaded)

  const { data: products = [] } = useProducts()
  const categories = [
    ...new Map(
      (products)
        .filter((p) => p.category_id)
        .map((p) => [p.category_id, { id: p.category_id ?? '', name: p.categories?.name ?? 'Unnamed' }])
    ).values(),
  ]

  if (!['admin', 'owner'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <BookOpen className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm font-medium">Admin access required</p>
      </div>
    )
  }

  const totalAmount   = exportRows.reduce((s, r) => s + r.amount, 0)
  const unmappedCount = exportRows.filter((r) => !r.is_mapped).length
  const filename      = `gl-export_${from}_${to}`

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Mind · GL Export</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Audit-ready CSV for manual import into Xero, QuickBooks, or any accounting system.
            No API integration — finance owns the import step.
          </p>
        </div>
      </div>

      {/* Methodology note */}
      <div className="flex items-center gap-2 px-8 py-2 border-b bg-muted/10 text-[11px] text-muted-foreground flex-shrink-0">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          Procurement expenses from <code className="font-mono">restock_receives</code> · Write-offs from <code className="font-mono">stock_logs</code> WHERE removal_category IN (Breakage, Theft, Spoilage) · POS auto-decrements and corrections excluded · is_mapped = false flags rows that need a GL code before posting
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — account mappings */}
        <div className="w-80 flex-shrink-0 border-r flex flex-col overflow-hidden">
          <div className="border-b px-4 py-3 flex-shrink-0">
            <p className="text-xs font-semibold">Account Mappings</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {mappings.length} mappings configured
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {mappingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <AccountMappingPanel mappings={mappings} categories={categories} />
            )}
          </div>
        </div>

        {/* Right — export */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Controls */}
          <div className="flex items-center gap-4 border-b px-6 py-3 flex-shrink-0 flex-wrap">
            {/* Date presets */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {([
                { key: 'this_month', label: 'This month' },
                { key: 'last_month', label: 'Last month' },
                { key: 'last_30d',   label: '30d' },
                { key: 'last_90d',   label: '90d' },
              ] as { key: Preset; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setPreset(key); setPreviewLoaded(false) }}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    preset === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPreset('' as Preset); setPreviewLoaded(false) }}
                className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/40"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPreset('' as Preset); setPreviewLoaded(false) }}
                className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            {/* Write-offs toggle */}
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none flex-shrink-0">
              <input
                type="checkbox"
                checked={includeWriteOffs}
                onChange={(e) => { setIncludeWriteOffs(e.target.checked); setPreviewLoaded(false) }}
                className="rounded"
              />
              Include write-offs
            </label>

            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {/* Load preview */}
              {!previewLoaded && (
                <button
                  onClick={() => { setPreviewLoaded(true) }}
                  disabled={!from || !to}
                  className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  Preview
                </button>
              )}

              {/* Export CSV */}
              {exportRows.length > 0 && (
                <>
                  <button
                    onClick={() => { downloadFile(generateCSV(exportRows), `${filename}.csv`, 'text/csv') }}
                    className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={() => { downloadFile(JSON.stringify(exportRows, null, 2), `${filename}.json`, 'application/json') }}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" />
                    JSON
                  </button>
                </>
              )}
            </div>
          </div>

          {/* KPI strip */}
          {summary && (
            <div className="flex items-stretch border-b flex-shrink-0">
              {[
                {
                  label: 'Procurement expenses',
                  value: String(summary.procurement_count),
                  sub:   formatCurrency(summary.procurement_total, currency),
                  color: 'text-foreground',
                },
                {
                  label: 'Write-offs',
                  value: String(summary.write_off_count),
                  sub:   formatCurrency(summary.write_off_total, currency),
                  color: summary.write_off_count > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
                },
                {
                  label: 'Total',
                  value: formatCurrency(totalAmount > 0 ? totalAmount : summary.procurement_total + summary.write_off_total, currency),
                  sub:   `${String(summary.procurement_count + summary.write_off_count)} transactions`,
                  color: 'text-foreground',
                },
                {
                  label: 'Unmapped rows',
                  value: String(previewLoaded ? unmappedCount : summary.unmapped_count),
                  sub:   unmappedCount > 0 ? 'need GL code before posting' : 'all rows mapped',
                  color: (previewLoaded ? unmappedCount : summary.unmapped_count) > 0
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-muted-foreground',
                },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="flex-1 px-5 py-3 border-r last:border-r-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className={cn('text-xl font-bold tabular-nums mt-0.5', color)}>{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!previewLoaded ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Select a date range and click Preview</p>
                {summary && (
                  <p className="text-xs text-muted-foreground/60">
                    {String(summary.procurement_count + summary.write_off_count)} transactions in this window ·{' '}
                    {formatCurrency(summary.procurement_total + summary.write_off_total, currency)} total
                  </p>
                )}
              </div>
            ) : exportLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <ExportPreview rows={exportRows} currency={currency} />
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

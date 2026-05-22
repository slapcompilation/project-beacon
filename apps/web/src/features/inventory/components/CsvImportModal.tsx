// Layer: Flow + Eye — Bulk import (CSV or AI-powered natural language)

import { useState, useRef } from 'react'
import {
  Button, Dialog, DialogBody, DialogFooter, Icon, Intent,
  Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useCreateProduct } from '../hooks'
import { useCategories } from '@/features/categories/hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { bulkUpdateBySku } from '../api'
import type { BulkUpdateItem } from '../api'
import { useQueryClient } from '@tanstack/react-query'
import { inventoryKeys } from '../hooks'
import { useSmartImport } from '../hooks/useSmartImport'

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim()); current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z_]/g, ''))
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const vals = parseCsvLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportMode = 'create' | 'update'
type InputMethod = 'csv' | 'smart'

interface CreateRow {
  name: string
  sku: string
  description: string
  cost: number
  category_id: string | null
  initial_stock: number
  tags: string[]
  errors: string[]
}

interface UpdateRow {
  sku: string
  current_stock?: number
  cost?: number
  description?: string
  /** For smart import update mode — the action type */
  action?: 'set' | 'add' | 'subtract'
  errors: string[]
}

// ─── Templates ────────────────────────────────────────────────────────────────

function downloadCreateTemplate() {
  const content = `name,sku,description,cost,category,initial_stock,tags\nSparkling Water,WATER-SPARK-500,500ml bottle,1.20,Beverages,48,"bar,premium"\nStill Water,WATER-STILL-500,500ml bottle,0.90,,24,`
  triggerDownload(content, 'import-create-template.csv')
}

function downloadUpdateTemplate() {
  const content = `sku,current_stock,cost,description\nWATER-SPARK-500,48,1.25,\nWATER-STILL-500,32,,500ml still water`
  triggerDownload(content, 'import-update-template.csv')
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Smart Import placeholder examples ────────────────────────────────────────

const SMART_CREATE_PLACEHOLDER = `Examples:
• Towel Large x50, sku TOW-LG, cost 3.50, tags housekeeping,linen
• 20 units of Sparkling Water 500ml, cost 1.20, category Beverages
• add the following with tags spell,random:
  Magic Wand x10, cost 5
  Potion Bottle x25, cost 2.50`

const SMART_UPDATE_PLACEHOLDER = `Examples:
• set TOW-LG to 50
• add 10 to WATER-SPARK-500
• remove 5 from SOAP-MINI
• received 100 of TOW-LG, 50 of SOAP-MINI`

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

type ImportState = 'idle' | 'preview' | 'importing' | 'done'

export function ImportModal({ open, onClose }: Props) {
  const createProduct = useCreateProduct()
  const { data: categories = [] } = useCategories()
  const hotelId = useActiveHotelId()
  const queryClient = useQueryClient()
  const smartImport = useSmartImport()

  const inputRef = useRef<HTMLInputElement>(null)
  const [inputMethod, setInputMethod] = useState<InputMethod>('csv')
  const [mode, setMode] = useState<ImportMode>('create')
  const [createRows, setCreateRows] = useState<CreateRow[]>([])
  const [updateRows, setUpdateRows] = useState<UpdateRow[]>([])
  const [state, setState] = useState<ImportState>('idle')
  const [results, setResults] = useState<{ created: number; updated: number; failed: number }>({ created: 0, updated: 0, failed: 0 })
  const [smartText, setSmartText] = useState('')
  const [aiMeta, setAiMeta] = useState<{ reasoning: string; confidence: string; warnings: string[] } | null>(null)
  const [aiTraceOpen, setAiTraceOpen] = useState(false)

  const categoryByName = Object.fromEntries(
    categories.map((c) => [c.name.toLowerCase(), c.id])
  )

  // ─── CSV file handler ────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const raw = parseCsv(text)

      if (mode === 'create') {
        const parsed: CreateRow[] = raw.map((r) => {
          const errors: string[] = []
          if (!r.name) errors.push('Name is required')
          if (!r.sku) errors.push('SKU is required')
          const cost = r.cost ? parseFloat(r.cost) : 0
          if (r.cost && isNaN(cost)) errors.push('Cost must be a number')
          const categoryId = r.category ? (categoryByName[r.category.toLowerCase()] ?? null) : null
          if (r.category && !categoryId) errors.push(`Category "${r.category}" not found`)
          const initialStock = r.initial_stock ? parseInt(r.initial_stock, 10) : 0
          if (r.initial_stock && (isNaN(initialStock) || initialStock < 0)) errors.push('initial_stock must be a non-negative integer')
          const tags = r.tags ? r.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
          return { name: r.name, sku: r.sku, description: r.description, cost: isNaN(cost) ? 0 : cost, category_id: categoryId, initial_stock: isNaN(initialStock) ? 0 : initialStock, tags, errors }
        })
        setCreateRows(parsed)
      } else {
        const parsed: UpdateRow[] = raw.map((r) => {
          const errors: string[] = []
          if (!r.sku) errors.push('SKU is required')
          const currentStock = r.current_stock !== '' ? parseInt(r.current_stock, 10) : undefined
          const cost = r.cost !== '' ? parseFloat(r.cost) : undefined
          if (currentStock !== undefined && isNaN(currentStock)) errors.push('current_stock must be an integer')
          if (cost !== undefined && isNaN(cost)) errors.push('cost must be a number')
          return { sku: r.sku, current_stock: currentStock, cost, description: r.description || undefined, errors }
        })
        setUpdateRows(parsed)
      }

      setState('preview')
    }
    reader.readAsText(file)
  }

  // ─── Smart Import handler ──────────────────────────────────────────────────

  const handleSmartParse = async () => {
    if (!smartText.trim()) return

    const categoryData = categories.map((c) => ({ id: c.id, name: c.name }))
    const result = await smartImport.parse(mode, smartText, categoryData)

    if (!result) return

    setAiMeta({
      reasoning: result.reasoning,
      confidence: result.confidence,
      warnings: result.warnings ?? [],
    })

    if (mode === 'create' && result.products) {
      const parsed: CreateRow[] = result.products.map((p) => {
        const errors: string[] = []
        if (!p.name) errors.push('Name is required')
        if (!p.sku) errors.push('SKU is required')
        const catId = p.category_id != null
          ? p.category_id
          : (p.category ? (categoryByName[p.category.toLowerCase()] ?? null) : null)
        return {
          name: p.name,
          sku: p.sku,
          description: p.description ?? '',
          cost: p.cost,
          category_id: catId,
          initial_stock: p.initial_stock ?? 0,
          tags: p.tags ?? [],
          errors,
        }
      })
      setCreateRows(parsed)
    } else if (mode === 'update' && result.updates) {
      const parsed: UpdateRow[] = result.updates.map((u) => {
        const errors: string[] = []
        if (!u.sku) errors.push('SKU is required')
        if (u.quantity < 0) errors.push('Quantity must be positive')
        return {
          sku: u.sku,
          current_stock: u.quantity,
          action: u.action,
          cost: u.cost != null ? u.cost : undefined,
          description: u.description != null ? u.description : undefined,
          errors,
        }
      })
      setUpdateRows(parsed)
    }

    setState('preview')
  }

  // ─── Derived counts ──────────────────────────────────────────────────────────

  const validCreateRows = createRows.filter((r) => r.errors.length === 0)
  const validUpdateRows = updateRows.filter((r) => r.errors.length === 0)
  const invalidCount = mode === 'create'
    ? createRows.filter((r) => r.errors.length > 0).length
    : updateRows.filter((r) => r.errors.length > 0).length

  // ─── Import execution ────────────────────────────────────────────────────────

  const handleImport = async () => {
    setState('importing')

    if (mode === 'create') {
      let created = 0; let failed = 0
      for (const row of validCreateRows) {
        try {
          await createProduct.mutateAsync({
            name: row.name,
            sku: row.sku,
            description: row.description || undefined,
            cost: row.cost,
            category_id: row.category_id,
            initial_stock: row.initial_stock || undefined,
            tags: row.tags.length > 0 ? row.tags : undefined,
          })
          created++
        } catch { failed++ }
      }
      setResults({ created, updated: 0, failed })
    } else {
      // Map all update rows to BulkUpdateItems — bulkUpdateBySku handles SKU → variant resolution
      const items: BulkUpdateItem[] = validUpdateRows.map((r) => {
        if (r.action === 'add') {
          return { sku: r.sku, stock_delta: r.current_stock ?? 0, cost: r.cost, description: r.description }
        }
        if (r.action === 'subtract') {
          return { sku: r.sku, stock_delta: -(r.current_stock ?? 0), cost: r.cost, description: r.description }
        }
        // "set" or CSV mode (no action)
        return { sku: r.sku, current_stock: r.current_stock, cost: r.cost, description: r.description }
      })

      const res = await bulkUpdateBySku(hotelId ?? '', items)
      const updated = res.filter((r) => r.status === 'updated').length
      const failed = res.filter((r) => r.status !== 'updated').length

      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['eye', hotelId] })
      setResults({ created: 0, updated, failed })
    }

    setState('done')
  }

  // ─── Reset / Close ────────────────────────────────────────────────────────────

  const handleClose = () => {
    setCreateRows([]); setUpdateRows([])
    setState('idle')
    setResults({ created: 0, updated: 0, failed: 0 })
    setSmartText('')
    setAiMeta(null)
    setAiTraceOpen(false)
    smartImport.reset()
    if (inputRef.current) inputRef.current.value = ''
    onClose()
  }

  const handleBack = () => {
    setCreateRows([]); setUpdateRows([])
    setAiMeta(null)
    setAiTraceOpen(false)
    setState('idle')
  }

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <Dialog isOpen={open} onClose={handleClose} title="Bulk Import" className="!w-[42rem]">
      <DialogBody>
        {state === 'idle' && (
          <div className="space-y-4 py-2">
            {/* Input method tabs */}
            <div className="flex rounded-md border overflow-hidden text-sm">
              <button
                onClick={() => { setInputMethod('csv') }}
                className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors',
                  inputMethod === 'csv' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}
              >
                <Icon icon="th" size={14} />
                CSV Upload
              </button>
              <button
                onClick={() => { setInputMethod('smart') }}
                className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors',
                  inputMethod === 'smart' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}
              >
                <Icon icon="predictive-analysis" size={14} />
                Smart Import
              </button>
            </div>

            {/* Create / Update mode toggle */}
            <div className="flex rounded-md border overflow-hidden text-sm">
              <button
                onClick={() => { setMode('create') }}
                className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 transition-colors',
                  mode === 'create' ? 'bg-muted font-medium' : 'hover:bg-muted/50 text-muted-foreground')}
              >
                <Icon icon="plus" size={12} />
                Create products
              </button>
              <button
                onClick={() => { setMode('update') }}
                className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 transition-colors',
                  mode === 'update' ? 'bg-muted font-medium' : 'hover:bg-muted/50 text-muted-foreground')}
              >
                <Icon icon="refresh" size={12} />
                Update stock
              </button>
            </div>

            {/* ─── CSV Input ─────────────────────────────────────────────── */}
            {inputMethod === 'csv' && (
              <>
                <p className="text-sm text-muted-foreground">
                  {mode === 'create'
                    ? <>Columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">name, sku, description, cost, category, initial_stock, tags</code> — only name &amp; sku are required</>
                    : <>Columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">sku, current_stock, cost, description</code> — only provided columns are updated</>
                  }
                </p>

                <div
                  className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault() }}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files.item(0); if (f) handleFile(f) }}
                >
                  <Icon icon="upload" size={32} className="text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outlined" size="small" icon="download" onClick={mode === 'create' ? downloadCreateTemplate : downloadUpdateTemplate}>
                    Download Template
                  </Button>
                  <Button variant="minimal" onClick={handleClose}>Cancel</Button>
                </div>
              </>
            )}

            {/* ─── Smart Import Input ────────────────────────────────────── */}
            {inputMethod === 'smart' && (
              <>
                <p className="text-sm text-muted-foreground">
                  Describe what you want to {mode === 'create' ? 'add' : 'update'} in plain language. AI will parse it into structured data for your review.
                </p>

                <textarea
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring min-h-[140px] resize-y"
                  placeholder={mode === 'create' ? SMART_CREATE_PLACEHOLDER : SMART_UPDATE_PLACEHOLDER}
                  value={smartText}
                  onChange={(e) => { setSmartText(e.target.value) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      void handleSmartParse()
                    }
                  }}
                />

                {smartImport.error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <Icon icon="error" size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{smartImport.error}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="minimal" onClick={handleClose}>Cancel</Button>
                  <Button
                    intent={Intent.PRIMARY}
                    icon={smartImport.isLoading ? undefined : 'predictive-analysis'}
                    loading={smartImport.isLoading}
                    onClick={() => { void handleSmartParse() }}
                    disabled={!smartText.trim() || smartImport.isLoading}
                  >
                    {smartImport.isLoading ? 'Parsing…' : 'Parse with AI'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Preview ──────────────────────────────────────────────────── */}
        {state === 'preview' && (
          <div className="space-y-4 py-2">
            {/* AI transparency panel */}
            {aiMeta && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Tag
                    minimal
                    icon="predictive-analysis"
                    intent={
                      aiMeta.confidence === 'high'   ? Intent.SUCCESS :
                      aiMeta.confidence === 'medium' ? Intent.WARNING :
                      aiMeta.confidence === 'low'    ? Intent.DANGER  :
                      Intent.NONE
                    }
                  >
                    AI confidence: {aiMeta.confidence}
                  </Tag>
                  <button
                    onClick={() => { setAiTraceOpen(!aiTraceOpen) }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon icon={aiTraceOpen ? 'chevron-down' : 'chevron-right'} size={12} />
                    AI reasoning
                  </button>
                </div>
                {aiTraceOpen && (
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <p>{aiMeta.reasoning}</p>
                  </div>
                )}
                {aiMeta.warnings.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-amber-700">
                    <Icon icon="error" size={14} className="mt-0.5 flex-shrink-0" />
                    <div>
                      {aiMeta.warnings.map((w, i) => <p key={i}>{w}</p>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <Tag minimal intent={Intent.SUCCESS} icon="tick-circle">
                {mode === 'create' ? validCreateRows.length : validUpdateRows.length} valid
              </Tag>
              {invalidCount > 0 && (
                <Tag minimal intent={Intent.DANGER} icon="cross-circle">
                  {invalidCount} with errors (will be skipped)
                </Tag>
              )}
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border text-sm">
              {mode === 'create' ? (
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-left">Tags</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {createRows.map((row, i) => (
                      <tr key={i} className={row.errors.length > 0 ? 'bg-red-50/50' : ''}>
                        <td className="px-3 py-2 font-medium">{row.name || <span className="text-destructive italic">missing</span>}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.sku || <span className="text-destructive italic">missing</span>}</td>
                        <td className="px-3 py-2 text-right">{row.cost.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.initial_stock || '—'}</td>
                        <td className="px-3 py-2">
                          {row.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.tags.map((t) => (
                                <span key={t} className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{t}</span>
                              ))}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.category_id ? categories.find((c) => c.id === row.category_id)?.name : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {row.errors.length === 0 ? (
                            <Icon icon="tick-circle" size={14} className="text-green-600" />
                          ) : (
                            <div className="flex items-center gap-1 text-destructive text-xs">
                              <Icon icon="error" size={14} className="flex-shrink-0" />
                              {row.errors[0]}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">SKU</th>
                      {updateRows.some((r) => r.action) && <th className="px-3 py-2 text-left">Action</th>}
                      <th className="px-3 py-2 text-right">{updateRows.some((r) => r.action) ? 'Quantity' : 'New Stock'}</th>
                      <th className="px-3 py-2 text-right">New Cost</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {updateRows.map((row, i) => (
                      <tr key={i} className={row.errors.length > 0 ? 'bg-red-50/50' : ''}>
                        <td className="px-3 py-2 font-mono text-xs font-medium">{row.sku || <span className="text-destructive italic">missing</span>}</td>
                        {updateRows.some((r) => r.action) && (
                          <td className="px-3 py-2">
                            {row.action ? (
                              <Tag
                                minimal
                                intent={
                                  row.action === 'set'      ? Intent.PRIMARY :
                                  row.action === 'add'      ? Intent.SUCCESS :
                                  row.action === 'subtract' ? Intent.DANGER  :
                                  Intent.NONE
                                }
                                className="!text-[10px]"
                              >
                                {row.action}
                              </Tag>
                            ) : 'set'}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right tabular-nums">{row.current_stock ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.cost != null ? row.cost.toFixed(2) : '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{row.description || '—'}</td>
                        <td className="px-3 py-2">
                          {row.errors.length === 0 ? (
                            <Icon icon="tick-circle" size={14} className="text-green-600" />
                          ) : (
                            <div className="flex items-center gap-1 text-destructive text-xs">
                              <Icon icon="error" size={14} className="flex-shrink-0" />
                              {row.errors[0]}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="minimal" onClick={handleBack}>Back</Button>
              <Button
                intent={Intent.PRIMARY}
                onClick={() => { void handleImport() }}
                disabled={mode === 'create' ? validCreateRows.length === 0 : validUpdateRows.length === 0}
              >
                {mode === 'create'
                  ? `Import ${String(validCreateRows.length)} product${validCreateRows.length !== 1 ? 's' : ''}`
                  : `Update ${String(validUpdateRows.length)} item${validUpdateRows.length !== 1 ? 's' : ''}`
                }
              </Button>
            </div>
          </div>
        )}

        {state === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
            <p className="text-sm text-muted-foreground">
              {mode === 'create' ? 'Importing products…' : 'Updating items…'}
            </p>
          </div>
        )}

        {state === 'done' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <Icon icon="tick-circle" size={40} className="text-green-600" />
              {mode === 'create' ? (
                <p className="font-semibold">{results.created} product{results.created !== 1 ? 's' : ''} imported</p>
              ) : (
                <p className="font-semibold">{results.updated} item{results.updated !== 1 ? 's' : ''} updated</p>
              )}
              {results.failed > 0 && (
                <p className="text-sm text-muted-foreground">
                  {results.failed} {mode === 'create' ? 'failed (SKU already exists or other error)' : 'not found or failed'}
                </p>
              )}
            </div>
            <DialogFooter actions={<Button intent={Intent.PRIMARY} onClick={handleClose}>Done</Button>} />
          </div>
        )}
      </DialogBody>
    </Dialog>
  )
}

/** @deprecated Use ImportModal instead */
export const CsvImportModal = ImportModal

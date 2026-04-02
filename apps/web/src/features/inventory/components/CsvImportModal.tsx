// Layer: Flow — CSV bulk import (create new products OR update existing by SKU)

import { useState, useRef } from 'react'
import { Upload, Download, Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useCreateProduct } from '../hooks'
import { useCategories } from '@/features/categories/hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { bulkUpdateBySku } from '../api'
import type { BulkUpdateItem } from '../api'
import { useQueryClient } from '@tanstack/react-query'
import { inventoryKeys } from '../hooks'

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

interface CreateRow {
  name: string
  sku: string
  description: string
  cost: number
  category_id: string | null
  errors: string[]
}

interface UpdateRow {
  sku: string
  current_stock?: number
  cost?: number
  description?: string
  errors: string[]
}

// ─── Templates ────────────────────────────────────────────────────────────────

function downloadCreateTemplate() {
  const content = `name,sku,description,cost,category\nSparkling Water,WATER-SPARK-500,500ml bottle,1.20,Beverages\nStill Water,WATER-STILL-500,500ml bottle,0.90,`
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

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

type ImportState = 'idle' | 'preview' | 'importing' | 'done'

export function CsvImportModal({ open, onClose }: Props) {
  const createProduct = useCreateProduct()
  const { data: categories = [] } = useCategories()
  const hotelId = useActiveHotelId()
  const queryClient = useQueryClient()

  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ImportMode>('create')
  const [createRows, setCreateRows] = useState<CreateRow[]>([])
  const [updateRows, setUpdateRows] = useState<UpdateRow[]>([])
  const [state, setState] = useState<ImportState>('idle')
  const [results, setResults] = useState<{ created: number; updated: number; failed: number }>({ created: 0, updated: 0, failed: 0 })

  const categoryByName = Object.fromEntries(
    categories.map((c) => [c.name.toLowerCase(), c.id])
  )

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
          return { name: r.name, sku: r.sku, description: r.description, cost: isNaN(cost) ? 0 : cost, category_id: categoryId, errors }
        })
        setCreateRows(parsed)
      } else {
        const parsed: UpdateRow[] = raw.map((r) => {
          const errors: string[] = []
          if (!r.sku) errors.push('SKU is required')
          const currentStock = r.current_stock !== '' && r.current_stock != null ? parseInt(r.current_stock, 10) : undefined
          const cost = r.cost !== '' && r.cost != null ? parseFloat(r.cost) : undefined
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

  const validCreateRows = createRows.filter((r) => r.errors.length === 0)
  const validUpdateRows = updateRows.filter((r) => r.errors.length === 0)
  const invalidCount = mode === 'create'
    ? createRows.filter((r) => r.errors.length > 0).length
    : updateRows.filter((r) => r.errors.length > 0).length

  const handleImport = async () => {
    setState('importing')

    if (mode === 'create') {
      let created = 0; let failed = 0
      for (const row of validCreateRows) {
        try {
          await createProduct.mutateAsync({ name: row.name, sku: row.sku, description: row.description || undefined, cost: row.cost, category_id: row.category_id })
          created++
        } catch { failed++ }
      }
      setResults({ created, updated: 0, failed })
    } else {
      const items: BulkUpdateItem[] = validUpdateRows.map((r) => ({
        sku: r.sku,
        current_stock: r.current_stock,
        cost: r.cost,
        description: r.description,
      }))
      const res = await bulkUpdateBySku(hotelId ?? '', items)
      const updated = res.filter((r) => r.status === 'updated').length
      const failed = res.filter((r) => r.status !== 'updated').length
      // Invalidate products cache so new stock values appear
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['eye', hotelId] })
      setResults({ created: 0, updated, failed })
    }

    setState('done')
  }

  const handleClose = () => {
    setCreateRows([]); setUpdateRows([])
    setState('idle')
    setResults({ created: 0, updated: 0, failed: 0 })
    if (inputRef.current) inputRef.current.value = ''
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { handleClose() } }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import via CSV</DialogTitle>
        </DialogHeader>

        {state === 'idle' && (
          <div className="space-y-4 py-2">
            {/* Mode tabs */}
            <div className="flex rounded-md border overflow-hidden text-sm">
              <button
                onClick={() => { setMode('create') }}
                className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors',
                  mode === 'create' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}
              >
                <Plus className="h-3.5 w-3.5" />
                Create new products
              </button>
              <button
                onClick={() => { setMode('update') }}
                className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors',
                  mode === 'update' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Update existing (by SKU)
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {mode === 'create'
                ? <>Columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">name, sku, description, cost, category</code></>
                : <>Columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">sku, current_stock, cost, description</code> — only provided columns are updated</>
              }
            </p>

            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            >
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={mode === 'create' ? downloadCreateTemplate : downloadUpdateTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </DialogFooter>
          </div>
        )}

        {state === 'preview' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                {mode === 'create' ? validCreateRows.length : validUpdateRows.length} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  {invalidCount} with errors (will be skipped)
                </Badge>
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
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.category_id ? categories.find((c) => c.id === row.category_id)?.name : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {row.errors.length === 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="flex items-center gap-1 text-destructive text-xs">
                              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
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
                      <th className="px-3 py-2 text-right">New Stock</th>
                      <th className="px-3 py-2 text-right">New Cost</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {updateRows.map((row, i) => (
                      <tr key={i} className={row.errors.length > 0 ? 'bg-red-50/50' : ''}>
                        <td className="px-3 py-2 font-mono text-xs font-medium">{row.sku || <span className="text-destructive italic">missing</span>}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.current_stock ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.cost != null ? row.cost.toFixed(2) : '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{row.description || '—'}</td>
                        <td className="px-3 py-2">
                          {row.errors.length === 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="flex items-center gap-1 text-destructive text-xs">
                              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
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

            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateRows([]); setUpdateRows([]); setState('idle') }}>
                Back
              </Button>
              <Button
                onClick={() => { void handleImport() }}
                disabled={mode === 'create' ? validCreateRows.length === 0 : validUpdateRows.length === 0}
              >
                {mode === 'create'
                  ? `Import ${validCreateRows.length} product${validCreateRows.length !== 1 ? 's' : ''}`
                  : `Update ${validUpdateRows.length} item${validUpdateRows.length !== 1 ? 's' : ''}`
                }
              </Button>
            </DialogFooter>
          </div>
        )}

        {state === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {mode === 'create' ? 'Importing products…' : 'Updating items…'}
            </p>
          </div>
        )}

        {state === 'done' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
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
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

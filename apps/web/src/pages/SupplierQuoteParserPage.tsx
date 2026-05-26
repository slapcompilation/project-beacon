// Layer: Mind — Supplier Quote Parser (Trip Planner / Renovation Planner pattern)
//
// Operators paste raw supplier quote text (email body, PDF copy-paste, WhatsApp message).
// A deterministic regex parser extracts line items → operator reviews → creates draft PO.
// No LLM required — pure pattern matching with fallback.
//
// Palantir Principle #4: decision support, not data display.
// Palantir Principle #1: every mutation flows through the action registry (CREATE_PO).
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Button,
  Callout,
  FormGroup,
  HTMLSelect,
  Icon,
  InputGroup,
  Intent,
  TextArea,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { dispatchAction } from '@/lib/actions/dispatch'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useProducts } from '@/features/inventory/hooks'

// ─── Quote parser ─────────────────────────────────────────────────────────────

export interface ParsedLine {
  rawText:     string
  description: string
  qty:         number
  unitPrice:   number
  variantId:   string | null   // null = unmatched
  confidence:  'high' | 'low'
}

// Patterns handled (in priority order):
//   "5 x Tomatoes @ $2.50"
//   "Tomatoes: qty 5 @ 2.50 each"
//   "10 cases Chicken Breast - $45.00/case"
//   "3\tOlive Oil\t$5.99"   (tab-separated like a spreadsheet paste)
//   "Olive Oil 10 @ 5.99"

const QTY_PRICE_RE = new RegExp(
  [
    /(?:(?<qtyA>\d+(?:\.\d+)?)\s*[x×]\s*(?<descA>[^@$\n\t]+?)\s*[@-]\s*\$?(?<priceA>\d+(?:\.\d{2})?))/,
    /(?:(?<descB>[^:,\n\t]+?)\s*:?\s*(?:qty|quantity)?\s*(?<qtyB>\d+)\s*[@-]\s*\$?(?<priceB>\d+(?:\.\d{2})?)\s*(?:each|\/\w+)?)/,
    /(?:(?<qtyC>\d+(?:\.\d+)?)\s+(?<descC>[^$@\n\t]+?)\s*[@-]\s*\$?(?<priceC>\d+(?:\.\d{2})?))/,
    /(?:(?<descD>[^\t\n]+?)\t(?<qtyD>\d+(?:\.\d+)?)\t\$?(?<priceD>\d+(?:\.\d{2})?))/,
    /(?:(?<descE>[^@$\n\t0-9][^@$\n\t]*?)\s+(?<qtyE>\d+(?:\.\d+)?)\s*[@]\s*\$?(?<priceE>\d+(?:\.\d{2})?))/,
  ].map((r) => r.source).join('|'),
  'i',
)

function parseLine(raw: string): Omit<ParsedLine, 'variantId'> | null {
  const m = QTY_PRICE_RE.exec(raw.trim())
  if (!m) return null
  // RegExpExecArray.groups defaults to `{ [k: string]: string }`, but alternative
  // branches really do leave their named groups undefined at runtime.
  const g    = (m.groups ?? {}) as Record<string, string | undefined>
  const desc   = (g['descA']  ?? g['descB']  ?? g['descC']  ?? g['descD']  ?? g['descE']  ?? '').trim()
  const qtyS   =  g['qtyA']   ?? g['qtyB']   ?? g['qtyC']   ?? g['qtyD']   ?? g['qtyE']   ?? ''
  const priceS =  g['priceA'] ?? g['priceB'] ?? g['priceC'] ?? g['priceD'] ?? g['priceE'] ?? ''
  const qty   = parseFloat(qtyS)
  const price = parseFloat(priceS)
  if (!desc || isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) return null
  return { rawText: raw.trim(), description: desc, qty, unitPrice: price, confidence: 'high' }
}

function parseQuote(text: string): Omit<ParsedLine, 'variantId'>[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3)
    .map(parseLine)
    .filter((l): l is Omit<ParsedLine, 'variantId'> => l !== null)
}

/** Fuzzy match a description against variant/product names */
function matchVariant(
  desc: string,
  products: Array<{ variants: Array<{ id: string; name: string }>; name: string }>,
): string | null {
  const lower = desc.toLowerCase()
  let best: { id: string; score: number } | null = null
  for (const p of products) {
    for (const v of p.variants) {
      const candidate = `${p.name} ${v.name}`.toLowerCase()
      const descWords  = lower.split(/\s+/)
      const candWords  = candidate.split(/\s+/)
      const overlap    = descWords.filter((w) => w.length > 2 && candWords.some((c) => c.includes(w) || w.includes(c))).length
      const score      = overlap / Math.max(descWords.length, 1)
      if (score > 0.4 && (!best || score > best.score)) {
        best = { id: v.id, score }
      }
    }
  }
  return best?.id ?? null
}

// ─── Editable line row ────────────────────────────────────────────────────────

interface EditableLineProps {
  line:     ParsedLine
  currency: string
  onChange: (updated: ParsedLine) => void
  onRemove: () => void
}

function EditableLine({ line, currency, onChange, onRemove }: EditableLineProps) {
  return (
    <div className={cn(
      'grid grid-cols-[1fr_80px_90px_80px_28px] gap-2 items-center px-3 py-2 rounded border',
      line.variantId ? 'border-border bg-card' : 'border-amber-500/30 bg-amber-500/5',
    )}>
      <div className="min-w-0">
        <InputGroup
          value={line.description}
          onChange={(e) => { onChange({ ...line, description: e.target.value }) }}
        />
        {!line.variantId && (
          <p className="mt-1 text-[10px] text-amber-500 flex items-center gap-1">
            <Icon icon="warning-sign" size={10} /> No variant match — will create as note only
          </p>
        )}
      </div>
      <InputGroup
        type="number"
        min={0.01}
        step={0.01}
        value={String(line.qty)}
        onChange={(e) => { onChange({ ...line, qty: parseFloat(e.target.value) || 0 }) }}
        className="tabular-nums"
      />
      <InputGroup
        type="number"
        min={0}
        step={0.01}
        value={String(line.unitPrice)}
        onChange={(e) => { onChange({ ...line, unitPrice: parseFloat(e.target.value) || 0 }) }}
        className="tabular-nums"
      />
      <span className="text-xs tabular-nums text-right text-muted-foreground">
        {formatCurrency(line.qty * line.unitPrice, currency)}
      </span>
      <Button icon="trash" variant="minimal" size="small" intent={Intent.DANGER} onClick={onRemove} aria-label="Remove line" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupplierQuoteParserPage() {
  const navigate  = useNavigate()
  const currency  = useCurrency()
  const hotelId   = useActiveHotelId()
  const userId    = useAuthStore((s) => s.session?.user.id ?? '')
  const { data: suppliers = [] } = useSuppliers()
  const { data: products  = [] } = useProducts()

  const [quoteText,   setQuoteText]   = useState('')
  const [lines,       setLines]       = useState<ParsedLine[]>([])
  const [supplierId,  setSupplierId]  = useState('')
  const [poNumber,    setPoNumber]    = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [parsed,      setParsed]      = useState(false)
  const [submitting,  setSubmitting]  = useState(false)

  const total = useMemo(() => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), [lines])

  function handleParse() {
    const raw = parseQuote(quoteText)
    const withMatches: ParsedLine[] = raw.map((l) => ({
      ...l,
      variantId: matchVariant(l.description, products.map((p) => ({ name: p.name, variants: p.product_variants.map((v) => ({ id: v.id, name: v.name })) }))),
    }))
    setLines(withMatches)
    setParsed(true)
  }

  function addBlankLine() {
    setLines((prev) => [...prev, { rawText: '', description: '', qty: 1, unitPrice: 0, variantId: null, confidence: 'low' }])
  }

  function updateLine(i: number, updated: ParsedLine) {
    setLines((prev) => prev.map((l, idx) => idx === i ? updated : l))
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function createPO() {
    if (!hotelId) return
    const matchedLines = lines.filter((l): l is ParsedLine & { variantId: string } =>
      l.variantId != null && l.qty > 0 && l.unitPrice > 0,
    )
    if (matchedLines.length === 0) { toast.error('At least one line must match a variant'); return }
    if (!poNumber.trim()) { toast.error('PO number is required'); return }

    const supplier = supplierId ? suppliers.find((s) => s.id === supplierId) : null

    setSubmitting(true)
    const result = await dispatchAction(
      {
        type:                 'CREATE_PO',
        hotelId,
        supplierId:           supplierId || null,
        supplierName:         supplier?.name ?? 'Unknown',
        poNumber:             poNumber.trim(),
        expectedDeliveryDate: deliveryDate || undefined,
        notes:                `Created from quote parser · ${lines.length - matchedLines.length} unmatched line${lines.length - matchedLines.length !== 1 ? 's' : ''} excluded`,
        lines: matchedLines.map((l) => ({
          variantId: l.variantId,
          requestId: undefined,
          orderedQty: Math.round(l.qty),
          unitCost:   l.unitPrice,
          notes:      l.description !== l.rawText ? `Parsed: "${l.rawText}"` : undefined,
        })),
      },
      { hotelId, actorId: userId, triggeredBy: 'user' },
    )
    setSubmitting(false)

    if (result.success) {
      const poId = (result.data as { poId: string }).poId
      toast.success(`PO created · ${result.edgesWritten} edges written`)
      void navigate(`/po/${poId}`)
    } else {
      toast.error('error' in result ? result.error.message : 'Failed to create PO')
    }
  }

  const unmatched = lines.filter((l) => !l.variantId).length
  const matchedCount = lines.filter((l) => l.variantId).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b shrink-0">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Icon icon="predictive-analysis" size={16} intent={Intent.PRIMARY} />
          Quote Parser
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Paste a supplier quote · auto-extract line items · create PO instantly
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Paste area */}
        {!parsed ? (
          <div className="space-y-3">
            <FormGroup label="Paste supplier quote text">
              <TextArea
                rows={10}
                fill
                value={quoteText}
                onChange={(e) => { setQuoteText(e.target.value) }}
                placeholder={`Examples:\n5 x Tomatoes @ $2.50\n10 Chicken Breast - $8.99\nOlive Oil: qty 6 @ 5.50 each\n3\tSalmon Fillet\t$18.00`}
                className="font-mono text-xs"
              />
            </FormGroup>
            <Button
              icon="predictive-analysis"
              intent={Intent.PRIMARY}
              disabled={!quoteText.trim()}
              onClick={handleParse}
            >
              Parse quote
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Parse results header */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {lines.length} line{lines.length !== 1 ? 's' : ''} extracted
                {unmatched > 0 && (
                  <span className="ml-2 text-amber-500">· {unmatched} unmatched</span>
                )}
              </div>
              <Button
                variant="minimal"
                size="small"
                intent={Intent.PRIMARY}
                onClick={() => { setParsed(false); setLines([]) }}
              >
                ← Re-parse
              </Button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_90px_80px_28px] gap-2 px-3 pb-1">
              {['Item', 'Qty', 'Unit Price', 'Total', ''].map((h) => (
                <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right first:text-left">{h}</span>
              ))}
            </div>

            {/* Lines */}
            <div className="space-y-2">
              {lines.map((line, i) => (
                <EditableLine key={i} line={line} currency={currency} onChange={(u) => { updateLine(i, u) }} onRemove={() => { removeLine(i) }} />
              ))}
              <Button
                icon="plus"
                variant="minimal"
                size="small"
                onClick={addBlankLine}
              >
                Add line
              </Button>
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Estimated total · </span>
                <span className="text-sm font-bold font-mono">{formatCurrency(total, currency)}</span>
              </div>
            </div>

            {/* PO metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
              <FormGroup label="Supplier" className="!mb-0">
                <HTMLSelect
                  fill
                  value={supplierId}
                  onChange={(e) => { setSupplierId(e.target.value) }}
                  options={[
                    { value: '', label: '— Select supplier' },
                    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </FormGroup>
              <FormGroup label="PO Number *" className="!mb-0">
                <InputGroup
                  value={poNumber}
                  onChange={(e) => { setPoNumber(e.target.value) }}
                  placeholder="PO-2026-042"
                />
              </FormGroup>
              <FormGroup label="Expected Delivery" className="!mb-0">
                <InputGroup
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => { setDeliveryDate(e.target.value) }}
                />
              </FormGroup>
            </div>

            {unmatched > 0 && (
              <Callout intent={Intent.WARNING} icon="warning-sign" compact>
                {unmatched} line{unmatched !== 1 ? 's' : ''} couldn&apos;t be matched to a variant and will be excluded from the PO.
                Edit the descriptions above or add the products to inventory first.
              </Callout>
            )}

            {/* Submit */}
            <div className="flex gap-3 items-center">
              <Button
                icon="document"
                endIcon="chevron-right"
                intent={Intent.PRIMARY}
                disabled={matchedCount === 0 || !poNumber.trim()}
                loading={submitting}
                onClick={() => { void createPO() }}
              >
                Create PO · {matchedCount} line{matchedCount !== 1 ? 's' : ''}
              </Button>
              <span className="text-xs text-muted-foreground">Routes through the action registry · edges written to graph</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

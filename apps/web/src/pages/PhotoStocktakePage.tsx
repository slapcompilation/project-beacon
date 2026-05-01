// Layer: Floor — Photo Stocktake (Meal Planning computer vision pattern)
//
// Photograph a shelf → GPT-4o Vision identifies items + estimates quantities
// → operator reviews → submits as stock adjustments via ADJUST_STOCK actions.
//
// Setup required: OPENAI_API_KEY set in Supabase Edge Function env vars.
// Edge function: supabase/functions/parse-shelf-photo/index.ts
//
// Palantir Principle #4: decision support — AI pre-fills the form, operator confirms.

import { useState, useRef } from 'react'
import { Camera, Upload, Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { dispatchAction } from '@/lib/actions/dispatch'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecognizedItem {
  productName:    string
  variantName:    string
  estimatedQty:   number
  confidence:     number   // 0-1
  variantId:      string | null
  delta:          number   // quantity to adjust (diff from current, or absolute)
  reason:         string
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PhotoStocktakePage() {
  const hotelId  = useActiveHotelId()
  const userId   = useAuthStore((s) => s.session?.user.id ?? '')
  const fileRef  = useRef<HTMLInputElement>(null)
  const [preview,    setPreview]    = useState<string | null>(null)
  const [scanning,   setScanning]   = useState(false)
  const [items,      setItems]      = useState<RecognizedItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState<Set<number>>(new Set())

  async function handleFile(file: File) {
    setScanning(true)
    setItems([])
    setSubmitted(new Set())

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => { setPreview(e.target?.result as string); }
    reader.readAsDataURL(file)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data: { session } } = await supabase.auth.getSession()
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-shelf-photo`
      const res = await fetch(fnUrl, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body:    fd,
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err.includes('not found') ? 'parse-shelf-photo edge function not deployed yet' : err)
      }
      const result = await res.json() as { items: RecognizedItem[] }
      setItems(result.items ?? [])
      if (result.items.length === 0) toast.info('No recognizable items found in photo')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Photo scan failed')
    } finally {
      setScanning(false)
    }
  }

  function updateItem(i: number, delta: Partial<RecognizedItem>) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, ...delta } : item))
  }

  async function applyAdjustment(i: number) {
    const item = items[i]
    if (!item.variantId || !hotelId) { toast.error('Variant not matched — edit manually'); return }
    if (item.delta === 0) { toast.info('Delta is 0 — no adjustment needed'); return }

    setSubmitting(true)
    const result = await dispatchAction(
      { type: 'ADJUST_STOCK', variantId: item.variantId, hotelId, userId, delta: item.delta, reason: item.reason },
      { hotelId, actorId: userId, triggeredBy: 'user' },
    )
    setSubmitting(false)

    if (result.success) {
      toast.success(`${item.productName} adjusted · ${result.edgesWritten} edges`)
      setSubmitted((prev) => new Set([...prev, i]))
    } else {
      toast.error(result.error.message)
    }
  }

  async function applyAll() {
    const pending = items.filter((item, i) => item.variantId && item.delta !== 0 && !submitted.has(i))
    if (pending.length === 0) { toast.info('Nothing to apply'); return }
    setSubmitting(true)
    let count = 0
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.variantId || item.delta === 0 || submitted.has(i) || !hotelId) continue
      const result = await dispatchAction(
        { type: 'ADJUST_STOCK', variantId: item.variantId, hotelId, userId, delta: item.delta, reason: item.reason },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (result.success) { setSubmitted((prev) => new Set([...prev, i])); count++ }
      else toast.error(`${item.productName}: ${result.error.message}`)
    }
    setSubmitting(false)
    if (count > 0) toast.success(`${count} adjustment${count !== 1 ? 's' : ''} applied`)
  }

  const pendingCount = items.filter((item, i) => item.variantId && item.delta !== 0 && !submitted.has(i)).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b shrink-0">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          Photo Stocktake
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Photograph a shelf · AI identifies items and quantities · review and apply adjustments
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Upload area */}
        <div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />

          {preview ? (
            <div className="relative rounded-lg overflow-hidden border border-border max-w-sm">
              <img src={preview} alt="Shelf scan" className="w-full object-cover max-h-48" />
              <button type="button"
                onClick={() => { setPreview(null); setItems([]); setSubmitted(new Set()) }}
                className="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-muted-foreground hover:text-foreground">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 w-full max-w-sm rounded-lg border-2 border-dashed border-border bg-card hover:border-foreground/30 hover:bg-muted/20 transition-colors py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Take or upload a shelf photo</p>
                <p className="text-xs text-muted-foreground mt-1">Tap to use camera or choose from gallery</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Upload className="w-3.5 h-3.5" />
                Or upload image file
              </div>
            </button>
          )}
        </div>

        {/* Scanning indicator */}
        {scanning && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Identifying items on shelf…
          </div>
        )}

        {/* Recognized items */}
        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {items.length} item{items.length !== 1 ? 's' : ''} recognized
              </p>
              {pendingCount > 0 && (
                <button type="button" disabled={submitting} onClick={() => { void applyAll() }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Apply all ({pendingCount})
                </button>
              )}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_70px_70px_80px_36px] gap-2 px-3 pb-1">
              {['Item', 'Scanned', 'Delta', 'Confidence', ''].map((h) => (
                <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right first:text-left">{h}</span>
              ))}
            </div>

            <div className="space-y-2">
              {items.map((item, i) => {
                const done = submitted.has(i)
                return (
                  <div key={i} className={cn(
                    'grid grid-cols-[1fr_70px_70px_80px_36px] gap-2 items-center px-3 py-2 rounded-lg border transition-colors',
                    done           ? 'border-emerald-500/30 bg-emerald-500/5 opacity-60' :
                    !item.variantId ? 'border-amber-500/30 bg-amber-500/5' :
                    'border-border bg-card',
                  )}>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{item.productName}</p>
                      {item.variantName !== 'Standard' && (
                        <p className="text-[10px] text-muted-foreground truncate">{item.variantName}</p>
                      )}
                      {!item.variantId && (
                        <p className="text-[10px] text-amber-500 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />unmatched
                        </p>
                      )}
                    </div>

                    <span className="text-xs tabular-nums text-right">{item.estimatedQty}</span>

                    <input type="number"
                      value={item.delta}
                      disabled={done}
                      onChange={(e) => { updateItem(i, { delta: parseInt(e.target.value, 10) || 0 }); }}
                      className="w-full rounded border border-input bg-background px-1.5 py-1 text-xs tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    />

                    <div className="text-right">
                      <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', item.confidence > 0.7 ? 'bg-emerald-500' : item.confidence > 0.4 ? 'bg-amber-500' : 'bg-red-500')}
                          style={{ width: `${item.confidence * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{Math.round(item.confidence * 100)}%</span>
                    </div>

                    <button type="button"
                      disabled={done || !item.variantId || item.delta === 0 || submitting}
                      onClick={() => { void applyAdjustment(i) }}
                      className={cn('flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                        done ? 'bg-emerald-500/10 text-emerald-500 cursor-not-allowed' :
                        'bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed'
                      )}>
                      {done
                        ? <CheckCircle2 className="w-3.5 h-3.5" />
                        : submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

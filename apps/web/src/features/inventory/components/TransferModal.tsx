// Layer: Flow — swap stock quantity between two variants in the same hotel
// Calls the swap_variant_stock() Supabase RPC. Creates two stock_logs + a causes edge.
// Renamed from transfer_stock() in migration 110 to free that name for multi-echelon
// inter-property transfers introduced in Phase R1.

import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { useProducts } from '../hooks'
import { inventoryKeys } from '../hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import type { ProductVariant } from '@beacon/types'

interface Props {
  open: boolean
  onClose: () => void
  /** Pre-selected source variant (from the current product context) */
  sourceVariant: ProductVariant
}

export function TransferModal({ open, onClose, sourceVariant }: Props) {
  const hotelId = useActiveHotelId()
  const queryClient = useQueryClient()
  const { data: products = [] } = useProducts()

  const [toVariantId, setToVariantId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [isPending, setIsPending] = useState(false)

  // Flatten all variants except the source
  const allVariants = products.flatMap((p) =>
    p.product_variants
      .filter((v) => v.id !== sourceVariant.id && v.enabled)
      .map((v) => ({ ...v, productName: p.name }))
  )

  const selectedTarget = allVariants.find((v) => v.id === toVariantId)

  const handleSubmit = async () => {
    const qty = parseInt(quantity, 10)
    if (!toVariantId || isNaN(qty) || qty <= 0) return

    setIsPending(true)
    try {
      const { error } = await supabase.rpc('swap_variant_stock', {
        p_from_variant_id: sourceVariant.id,
        p_to_variant_id: toVariantId,
        p_quantity: qty,
        p_note: note || null,
      })
      if (error) throw new Error(error.message)

      toast.success(`Transferred ${String(qty)} units`)
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      onClose()
      setToVariantId('')
      setQuantity('')
      setNote('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setIsPending(false)
    }
  }

  const qty = parseInt(quantity, 10)
  const canSubmit = !!toVariantId && !isNaN(qty) && qty > 0 && qty <= sourceVariant.current_stock

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* From */}
          <div className="rounded-lg border bg-muted/40 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">From</p>
            <p className="text-sm font-medium">{sourceVariant.name}</p>
            <p className="text-xs text-muted-foreground">
              Available: <span className="font-semibold text-foreground">{sourceVariant.current_stock}</span>
            </p>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* To */}
          <div className="space-y-1.5">
            <Label htmlFor="to-variant">To variant</Label>
            <Select value={toVariantId} onValueChange={setToVariantId}>
              <SelectTrigger id="to-variant">
                <SelectValue placeholder="Select destination variant…" />
              </SelectTrigger>
              <SelectContent>
                {allVariants.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.productName} — {v.name}
                    <span className="ml-2 text-muted-foreground text-xs">({v.current_stock} in stock)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity to transfer</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={sourceVariant.current_stock}
              placeholder="e.g. 5"
              value={quantity}
              onChange={(e) => { setQuantity(e.target.value) }}
            />
            {qty > sourceVariant.current_stock && (
              <p className="text-xs text-destructive">Exceeds available stock</p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              placeholder="e.g. Moving to kitchen for service"
              value={note}
              onChange={(e) => { setNote(e.target.value) }}
            />
          </div>

          {selectedTarget && qty > 0 && (
            <p className="text-xs text-muted-foreground">
              After transfer: {sourceVariant.name} → {String(sourceVariant.current_stock - qty)} units,{' '}
              {selectedTarget.name} → {String(selectedTarget.current_stock + qty)} units
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => { void handleSubmit() }} disabled={!canSubmit || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

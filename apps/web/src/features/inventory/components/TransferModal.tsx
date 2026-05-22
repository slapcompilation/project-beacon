// Swap stock between two variants in the same hotel via swap_variant_stock RPC.

import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Button, Dialog, DialogBody, DialogFooter, FormGroup,
  HTMLSelect, Icon, InputGroup, Intent,
} from '@blueprintjs/core'
import { supabase } from '@/lib/supabase/client'
import { useProducts, inventoryKeys } from '../hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import type { ProductVariant } from '@beacon/types'

interface Props {
  open: boolean
  onClose: () => void
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
    <Dialog isOpen={open} onClose={onClose} title="Transfer Stock" className="!w-[28rem]">
      <DialogBody>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">From</p>
            <p className="text-sm font-medium">{sourceVariant.name}</p>
            <p className="text-xs text-muted-foreground">
              Available: <span className="font-semibold text-foreground">{sourceVariant.current_stock}</span>
            </p>
          </div>

          <div className="flex items-center justify-center">
            <Icon icon="arrow-right" size={14} className="text-muted-foreground" />
          </div>

          <FormGroup label="To variant">
            <HTMLSelect
              value={toVariantId}
              onChange={(e) => { setToVariantId(e.target.value) }}
              options={[
                { value: '', label: 'Select destination variant…' },
                ...allVariants.map((v) => ({
                  value: v.id,
                  label: `${v.productName} — ${v.name} (${String(v.current_stock)} in stock)`,
                })),
              ]}
              fill
            />
          </FormGroup>

          <FormGroup
            label="Quantity to transfer"
            intent={qty > sourceVariant.current_stock ? Intent.DANGER : Intent.NONE}
            helperText={qty > sourceVariant.current_stock ? 'Exceeds available stock' : undefined}
          >
            <InputGroup
              type="number"
              min={1}
              max={sourceVariant.current_stock}
              placeholder="e.g. 5"
              value={quantity}
              onChange={(e) => { setQuantity(e.target.value) }}
            />
          </FormGroup>

          <FormGroup label="Note (optional)">
            <InputGroup
              placeholder="e.g. Moving to kitchen for service"
              value={note}
              onChange={(e) => { setNote(e.target.value) }}
            />
          </FormGroup>

          {selectedTarget && qty > 0 && (
            <p className="text-xs text-muted-foreground">
              After transfer: {sourceVariant.name} → {String(sourceVariant.current_stock - qty)} units,{' '}
              {selectedTarget.name} → {String(selectedTarget.current_stock + qty)} units
            </p>
          )}
        </div>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button variant="minimal" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button intent={Intent.PRIMARY} loading={isPending} disabled={!canSubmit || isPending} onClick={() => { void handleSubmit() }}>
              Transfer
            </Button>
          </>
        }
      />
    </Dialog>
  )
}

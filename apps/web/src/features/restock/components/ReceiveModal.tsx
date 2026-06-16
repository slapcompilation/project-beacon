import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button, Dialog, DialogBody, DialogFooter, FormGroup,
  Icon, InputGroup, Intent, Switch, TextArea,
} from '@blueprintjs/core'
import { useReceiveRestock, useReceives } from '../hooks'
import { useUpdateVariant } from '@/features/inventory/hooks'
import { format } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import type { RestockRequestRow } from '../api'
import { bpRegister } from '@/lib/forms'

const schema = z.object({
  quantity_received: z.number().int().min(1, 'Must receive at least 1'),
  lot_number: z.string().optional(),
  expiry_date: z.string().optional(),
  received_unit_cost: z.number().min(0).optional(),
  update_variant_cost: z.boolean().optional(),
  notes: z.string().optional(),
})
type Fields = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  request: RestockRequestRow
}

export function ReceiveModal({ open, onClose, request }: Props) {
  const receiveRestock = useReceiveRestock()
  const updateVariant = useUpdateVariant()
  const { data: history = [] } = useReceives(open ? request.id : null)
  const [updateCost, setUpdateCost] = useState(false)
  const fmtDate = useDateFormat()

  const productName = request.product_variants?.products?.name ?? 'Unknown'
  const variantName = request.product_variants?.name
  const totalAlreadyReceived = history.reduce((s, r) => s + r.quantity_received, 0)
  const remaining = request.quantity_needed - totalAlreadyReceived

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { quantity_received: Math.max(remaining, 1), update_variant_cost: false },
  })

  const qty = watch('quantity_received')
  const receivedCost = watch('received_unit_cost')
  const isPartial = typeof qty === 'number' && qty < remaining

  const handleClose = () => {
    reset()
    setUpdateCost(false)
    onClose()
  }

  const onSubmit = async (data: Fields) => {
    await receiveRestock.mutateAsync({
      requestId: request.id,
      quantityReceived: data.quantity_received,
      lotNumber: data.lot_number || null,
      notes: data.notes || null,
      unitCost: data.received_unit_cost || null,
      expiryDate: data.expiry_date || null,
    })

    // Patch variant lot/expiry for back-compat, plus cost if user opted in
    const variantPatch: Record<string, unknown> = {}
    if (data.lot_number) variantPatch.lot_number = data.lot_number
    if (data.expiry_date) variantPatch.expiry_date = data.expiry_date
    if (updateCost && data.received_unit_cost != null) variantPatch.cost = data.received_unit_cost

    if (Object.keys(variantPatch).length > 0) {
      await updateVariant.mutateAsync({
        id: request.variant_id,
        input: variantPatch,
      })
    }

    handleClose()
  }

  return (
    <Dialog
      isOpen={open}
      onClose={handleClose}
      title={<span className="flex items-center gap-2"><Icon icon="confirm" size={14} />Receive Stock</span>}
      className="!w-[28rem]"
    >
      <DialogBody>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted px-4 py-3 space-y-1">
            <p className="text-sm font-medium">
              {productName}
              {variantName && variantName !== 'Standard' && (
                <span className="text-muted-foreground font-normal"> — {variantName}</span>
              )}
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Ordered: <span className="text-foreground font-semibold">{request.quantity_needed}</span></span>
              {totalAlreadyReceived > 0 && (
                <span>Already received: <span className="text-foreground font-semibold">{totalAlreadyReceived}</span></span>
              )}
              <span>Remaining: <span className="text-foreground font-semibold">{remaining}</span></span>
            </div>
          </div>

          <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-3" id="receive-form">
            <FormGroup
              label="Quantity received"
              intent={errors.quantity_received ? Intent.DANGER : Intent.NONE}
              helperText={errors.quantity_received?.message ?? (isPartial ? 'Partial receive — request will remain approved until fully fulfilled.' : undefined)}
            >
              <InputGroup
                id="qty"
                type="number"
                min="1"
                step="1"
                {...bpRegister(register('quantity_received', { valueAsNumber: true }))}
              />
            </FormGroup>

            <div className="grid grid-cols-2 gap-3">
              <FormGroup label="Lot / Batch number">
                <InputGroup id="lot" placeholder="e.g. LOT-2024-001" {...bpRegister(register('lot_number'))} />
              </FormGroup>
              <FormGroup label="Expiry date">
                <InputGroup id="expiry" type="date" {...bpRegister(register('expiry_date'))} />
              </FormGroup>
            </div>

            <div className="rounded-md border p-3 space-y-2.5">
              <FormGroup
                label={<>Received unit cost <span className="ml-1 font-normal text-muted-foreground">(leave blank to ignore)</span></>}
              >
                <InputGroup
                  id="rcost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 4.50"
                  size="small"
                  {...bpRegister(register('received_unit_cost', { valueAsNumber: true }))}
                />
              </FormGroup>
              {receivedCost != null && !isNaN(receivedCost) && receivedCost > 0 && (
                <Switch
                  checked={updateCost}
                  onChange={(e) => { setUpdateCost(e.currentTarget.checked) }}
                  label="Update variant cost to this price"
                  className="!mb-0"
                />
              )}
            </div>

            <FormGroup label="Notes (optional)">
              <TextArea id="notes" rows={2} placeholder="Delivery condition, discrepancies…" fill {...bpRegister(register('notes'))} />
            </FormGroup>
          </form>

          {history.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Previous receives</p>
              <div className="rounded-md border divide-y text-xs">
                {history.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">{`${fmtDate(new Date(r.received_at))}, ${format(new Date(r.received_at), 'HH:mm')}`}</span>
                    <span className="font-semibold">+{r.quantity_received}</span>
                    {r.lot_number && <span className="text-muted-foreground">Lot: {r.lot_number}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button type="button" variant="minimal" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="receive-form" intent={Intent.PRIMARY} loading={isSubmitting}>
              Record Receive
            </Button>
          </>
        }
      />
    </Dialog>
  )
}

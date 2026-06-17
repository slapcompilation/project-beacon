import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button, Dialog, DialogBody, DialogFooter, FormGroup,
  HTMLSelect, Icon, InputGroup, Intent, TextArea,
} from '@blueprintjs/core'
import { VoiceAdjustButton } from '@/components/VoiceAdjustButton'
import { cn } from '@/lib/utils'
import { useAdjustStock } from '../hooks'
import { REMOVAL_CATEGORIES } from '@beacon/types'
import type { ProductWithVariants, ProductVariant } from '@beacon/types'
import { useCustomRemovalReasons } from '@/features/removal-reasons/hooks'
import { useActiveHotel } from '@/features/hotel/hooks'
import { bpRegister } from '@/lib/forms'

const schema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  reason: z.string().min(1, 'Reason is required'),
  removal_category: z.string().nullable().optional(),
})

type Fields = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  product: ProductWithVariants
  prefill?: { delta: number; reason: string }
}

export function StockAdjustModal({ open, onClose, product, prefill }: Props) {
  const adjustStock = useAdjustStock()
  const { data: customReasons = [] } = useCustomRemovalReasons()
  const activeHotel = useActiveHotel()
  const requireRemovalCategory = activeHotel?.config.require_removal_reason === true
  const [direction, setDirection] = useState<'add' | 'remove'>(
    prefill ? (prefill.delta >= 0 ? 'add' : 'remove') : 'remove'
  )
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.product_variants[0]
  )
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: prefill
      ? { quantity: Math.abs(prefill.delta), reason: prefill.reason }
      : undefined,
  })

  const handleClose = () => {
    reset()
    setDirection('add')
    onClose()
  }

  const handleVoiceCommand = useCallback((_productQuery: string, delta: number, reason: string) => {
    setDirection(delta >= 0 ? 'add' : 'remove')
    setValue('quantity', Math.abs(delta), { shouldValidate: true })
    setValue('reason', reason, { shouldValidate: true })
  }, [setValue])

  const onSubmit = async (data: Fields) => {
    if (direction === 'remove' && requireRemovalCategory && !data.removal_category) {
      toast.error('A move reason category is required for removals')
      return
    }

    const delta = direction === 'add' ? data.quantity : -data.quantity
    await adjustStock.mutateAsync({
      variantId: selectedVariant.id,
      delta,
      reason: data.reason,
      photoFile: null,
      category: direction === 'remove' ? (data.removal_category ?? null) : null,
    })
    handleClose()
  }

  const allRemovalCategories = [
    ...REMOVAL_CATEGORIES,
    ...customReasons.map((r) => r.name),
  ]

  const currentStock = selectedVariant.current_stock

  return (
    <Dialog
      isOpen={open}
      onClose={handleClose}
      title={
        <div className="flex items-start justify-between gap-3 w-full">
          <div>
            <span>Stock Adjustment — {product.name}</span>
            <p className="text-xs text-muted-foreground mt-0.5 font-normal">For corrections and removals. Use Restock Requests for inbound stock.</p>
          </div>
          <VoiceAdjustButton onCommand={handleVoiceCommand} className="shrink-0 pt-0.5" />
        </div>
      }
      className="!w-[28rem]"
    >
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
        <DialogBody>
          <div className="space-y-4">
            {product.product_variants.length > 1 && (
              <FormGroup label="Variant">
                <div className="flex flex-wrap gap-2">
                  {product.product_variants.map((v) => (
                    <Button
                      key={v.id}
                      type="button"
                      size="small"
                      intent={selectedVariant.id === v.id ? Intent.PRIMARY : Intent.NONE}
                      variant={selectedVariant.id === v.id ? undefined : 'outlined'}
                      onClick={() => { setSelectedVariant(v) }}
                    >
                      {v.name}
                    </Button>
                  ))}
                </div>
              </FormGroup>
            )}

            <div className="rounded-lg bg-muted px-4 py-3">
              <p className="text-sm text-muted-foreground">Current stock</p>
              <p className="text-2xl font-bold">{currentStock}</p>
            </div>

            <FormGroup label="Type">
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setDirection('add') }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors',
                    direction === 'add'
                      ? 'bg-blue-600 text-white'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon icon="plus" size={14} /> Correction (+)
                </button>
                <button
                  type="button"
                  onClick={() => { setDirection('remove') }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors',
                    direction === 'remove'
                      ? 'bg-red-600 text-white'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon icon="minus" size={14} /> Removal (−)
                </button>
              </div>
            </FormGroup>

            <FormGroup label="Quantity" intent={errors.quantity ? Intent.DANGER : Intent.NONE} helperText={errors.quantity?.message}>
              <InputGroup
                id="quantity"
                type="number"
                min="1"
                step="1"
                placeholder="0"
                {...bpRegister(register('quantity', { valueAsNumber: true }))}
              />
            </FormGroup>

            <FormGroup label="Reason" intent={errors.reason ? Intent.DANGER : Intent.NONE} helperText={errors.reason?.message}>
              <TextArea
                id="reason"
                rows={2}
                placeholder="e.g. Morning delivery, consumed at event…"
                fill
                {...bpRegister(register('reason'))}
              />
            </FormGroup>

            {direction === 'remove' && (
              <FormGroup
                label={
                  <>
                    Category
                    {requireRemovalCategory
                      ? <span className="ml-0.5 text-destructive">*</span>
                      : <span className="ml-1 text-xs text-muted-foreground font-normal">(optional)</span>}
                  </>
                }
              >
                <Controller
                  name="removal_category"
                  control={control}
                  render={({ field }) => (
                    <HTMLSelect
                      value={field.value ?? '__none__'}
                      onChange={(e) => { field.onChange(e.target.value === '__none__' ? null : e.target.value) }}
                      options={[
                        ...(!requireRemovalCategory ? [{ value: '__none__', label: '— None —' }] : []),
                        ...allRemovalCategories.map((cat) => ({ value: cat, label: cat })),
                      ]}
                      fill
                    />
                  )}
                />
              </FormGroup>
            )}
          </div>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button type="button" variant="minimal" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                intent={direction === 'remove' ? Intent.DANGER : Intent.PRIMARY}
                loading={isSubmitting}
              >
                {direction === 'add' ? 'Apply Correction' : 'Remove Stock'}
              </Button>
            </>
          }
        />
      </form>
    </Dialog>
  )
}

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, Minus } from 'lucide-react'
import { VoiceAdjustButton } from '@/components/VoiceAdjustButton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAdjustStock } from '../hooks'
import { REMOVAL_CATEGORIES } from '@beacon/types'
import type { ProductWithVariants, ProductVariant } from '@beacon/types'
import { useCustomRemovalReasons } from '@/features/removal-reasons/hooks'
import { useActiveHotel } from '@/features/hotel/hooks'

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

  // Voice pre-fill: productQuery is ignored (product already selected); delta + reason fill the form.
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
      removalCategory: direction === 'remove' ? (data.removal_category ?? null) : null,
    })
    handleClose()
  }

  // Build combined reason list: built-in categories first, then custom hotel-defined ones
  const allRemovalCategories = [
    ...REMOVAL_CATEGORIES,
    ...customReasons.map((r) => r.name),
  ]

  const currentStock = selectedVariant.current_stock

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { handleClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Stock Adjustment — {product.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">For corrections and removals. Use Restock Requests for inbound stock.</p>
            </div>
            <VoiceAdjustButton
              onCommand={handleVoiceCommand}
              className="shrink-0 pt-0.5"
            />
          </div>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4 py-2">
          {/* Variant selector — only shown if multiple variants */}
          {product.product_variants.length > 1 && (
            <div className="space-y-1.5">
              <Label>Variant</Label>
              <div className="flex flex-wrap gap-2">
                {product.product_variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setSelectedVariant(v); }}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition-colors',
                      selectedVariant.id === v.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current stock display */}
          <div className="rounded-lg bg-muted px-4 py-3">
            <p className="text-sm text-muted-foreground">Current stock</p>
            <p className="text-2xl font-bold">{currentStock}</p>
          </div>

          {/* Correction / Removal toggle */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => { setDirection('add'); }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors',
                  direction === 'add'
                    ? 'bg-blue-600 text-white'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                <Plus className="h-4 w-4" /> Correction (+)
              </button>
              <button
                type="button"
                onClick={() => { setDirection('remove'); }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors',
                  direction === 'remove'
                    ? 'bg-red-600 text-white'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                <Minus className="h-4 w-4" /> Removal (−)
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              step="1"
              placeholder="0"
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              rows={2}
              placeholder="e.g. Morning delivery, consumed at event…"
              {...register('reason')}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          {/* Removal category — only for removals */}
          {direction === 'remove' && (
            <div className="space-y-1.5">
              <Label>
                Category
                {requireRemovalCategory
                  ? <span className="ml-0.5 text-destructive">*</span>
                  : <span className="ml-1 text-xs text-muted-foreground font-normal">(optional)</span>}
              </Label>
              <Controller
                name="removal_category"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(v) => { field.onChange(v === '__none__' ? null : v); }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason category…" />
                    </SelectTrigger>
                    <SelectContent>
                      {!requireRemovalCategory && <SelectItem value="__none__">— None —</SelectItem>}
                      {allRemovalCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={direction === 'remove' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {direction === 'add' ? 'Apply Correction' : 'Remove Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

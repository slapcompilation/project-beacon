import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
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
import { useProducts } from '@/features/inventory/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useCreateRestockRequest } from '../hooks'

const schema = z.object({
  variantId: z.string().min(1, 'Select a product'),
  quantityNeeded: z.number().int().min(1, 'Quantity must be at least 1'),
  supplier: z.string().optional(),
  notes: z.string().optional(),
})

type Fields = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
}

export function RestockRequestModal({ open, onClose }: Props) {
  const { data: products = [] } = useProducts()
  const { data: suppliers = [] } = useSuppliers()
  const createRequest = useCreateRestockRequest()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { quantityNeeded: 1 },
  })

  const variantOptions = products.flatMap((p) =>
    p.product_variants.map((v) => ({
      id: v.id,
      label: p.product_variants.length > 1 ? `${p.name} — ${v.name}` : p.name,
    }))
  )

  const onSubmit = async (data: Fields) => {
    await createRequest.mutateAsync({
      variantId: data.variantId,
      quantityNeeded: data.quantityNeeded,
      supplier: data.supplier || null,
      notes: data.notes || null,
    })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Restock Request</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Product / Variant</Label>
            <Controller
              name="variantId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {variantOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.variantId && (
              <p className="text-sm text-destructive">{errors.variantId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity Needed</Label>
            <Input
              id="qty"
              type="number"
              min="1"
              {...register('quantityNeeded', { valueAsNumber: true })}
            />
            {errors.quantityNeeded && (
              <p className="text-sm text-destructive">{errors.quantityNeeded.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Controller
              name="supplier"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} placeholder="Optional" {...register('notes')} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onClose() }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

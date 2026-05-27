import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button, Dialog, DialogBody, DialogFooter, FormGroup,
  HTMLSelect, InputGroup, Intent, TextArea,
} from '@blueprintjs/core'
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

  const handleClose = () => { reset(); onClose() }

  return (
    <Dialog isOpen={open} onClose={handleClose} title="New Restock Request" className="!w-[28rem]">
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
        <DialogBody>
          <FormGroup label="Product / Variant" intent={errors.variantId ? Intent.DANGER : Intent.NONE} helperText={errors.variantId?.message}>
            <Controller
              name="variantId"
              control={control}
              render={({ field }) => (
                <HTMLSelect
                  value={field.value || ''}
                  onChange={(e) => { field.onChange(e.target.value) }}
                  options={[
                    { value: '', label: 'Select a product…' },
                    ...variantOptions.map((opt) => ({ value: opt.id, label: opt.label })),
                  ]}
                  fill
                />
              )}
            />
          </FormGroup>

          <FormGroup label="Quantity Needed" intent={errors.quantityNeeded ? Intent.DANGER : Intent.NONE} helperText={errors.quantityNeeded?.message}>
            <InputGroup
              id="qty"
              type="number"
              min="1"
              {...register('quantityNeeded', { valueAsNumber: true })}
            />
          </FormGroup>

          <FormGroup label="Supplier">
            <Controller
              name="supplier"
              control={control}
              render={({ field }) => (
                <HTMLSelect
                  value={field.value ?? ''}
                  onChange={(e) => { field.onChange(e.target.value) }}
                  options={[
                    { value: '', label: 'Select supplier (optional)' },
                    ...suppliers.map((s) => ({ value: s.name, label: s.name })),
                  ]}
                  fill
                />
              )}
            />
          </FormGroup>

          <FormGroup label="Notes">
            <TextArea id="notes" rows={2} placeholder="Optional" fill {...register('notes')} />
          </FormGroup>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button type="button" variant="minimal" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" intent={Intent.PRIMARY} loading={isSubmitting}>
                Submit Request
              </Button>
            </>
          }
        />
      </form>
    </Dialog>
  )
}

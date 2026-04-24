// Eye Layer synthesis: EntityContextPanel wired per variant so any variant
// inspected here surfaces velocity, runway, PO status and waste signals.
import { useState, useCallback } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, X, Package, MapPin, Bell, PowerOff, Activity } from 'lucide-react'
import { EntityContextPanel } from '@/features/eye/components/EntityContextPanel'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useCreateVariant, useUpdateVariant, useDeleteVariant, useToggleVariantActive } from '../hooks'
import { useDateFormat } from '@/features/user/hooks'
import { useLocations } from '@/features/locations/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useCustomFieldDefs, useUpdateVariantCustomValues } from '@/features/custom-fields/hooks'
import type { ProductWithVariants, ProductVariant, CustomFieldDef, VariantStatus } from '@beacon/types'
import { VARIANT_STATUS_LABELS } from '@beacon/types'

// ─── Variant form ─────────────────────────────────────────────────────────────

const variantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().nullable().optional(),
  cost: z.number().min(0, 'Cost must be 0 or more'),
  unit_of_measure: z.string().optional(),
  low_stock_threshold: z.number().int().min(0),
  location_id: z.string().nullable().optional(),
  default_supplier_id: z.string().nullable().optional(),
  status: z.string().optional(),
  reminder_date: z.string().nullable().optional(),
  reminder_label: z.string().nullable().optional(),
})
type VariantFields = z.infer<typeof variantSchema>

function renderCustomInput(
  def: CustomFieldDef,
  value: unknown,
  onChange: (v: unknown) => void
) {
  switch (def.field_type) {
    case 'text':
      return (
        <Input
          className="h-8 text-sm"
          value={value as string}
          onChange={(e) => { onChange(e.target.value || null); }}
        />
      )
    case 'number':
      return (
        <Input
          className="h-8 text-sm"
          type="number"
          value={value == null ? '' : String(value as number)}
          onChange={(e) => { onChange(e.target.value === '' ? null : Number(e.target.value)); }}
        />
      )
    case 'date':
      return (
        <Input
          className="h-8 text-sm"
          type="date"
          value={value as string}
          onChange={(e) => { onChange(e.target.value || null); }}
        />
      )
    case 'boolean':
      return (
        <Select
          value={value == null ? '__none__' : String(value as boolean)}
          onValueChange={(v) => { onChange(v === '__none__' ? null : v === 'true'); }}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      )
  }
}

function VariantForm({
  productId,
  editing,
  onDone,
}: {
  productId: string
  editing: ProductVariant | null
  onDone: () => void
}) {
  const createVariant = useCreateVariant(productId)
  const updateVariant = useUpdateVariant()
  const updateCustomValues = useUpdateVariantCustomValues()
  const { data: locations = [] } = useLocations()
  const { data: suppliers = [] } = useSuppliers()
  const { data: fieldDefs = [] } = useCustomFieldDefs()

  const [customValues, setCustomValues] = useState<Record<string, unknown>>(
    () => editing?.custom_values ?? {}
  )

  const handleCustomChange = useCallback((id: string, val: unknown) => {
    setCustomValues((prev) => ({ ...prev, [id]: val }))
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<VariantFields>({
    resolver: zodResolver(variantSchema),
    values: editing
      ? {
          name: editing.name,
          sku: editing.sku,
          barcode: editing.barcode ?? '',
          cost: editing.cost,
          unit_of_measure: editing.unit_of_measure,
          low_stock_threshold: editing.low_stock_threshold,
          location_id: editing.location_id ?? null,
          default_supplier_id: editing.default_supplier_id ?? null,
          status: editing.status,
          reminder_date: editing.reminder_date ?? null,
          reminder_label: editing.reminder_label ?? null,
        }
      : { name: '', sku: '', barcode: '', cost: 0, unit_of_measure: '', low_stock_threshold: 0, location_id: null, default_supplier_id: null, status: 'available', reminder_date: null, reminder_label: null },
  })

  const onSubmit = async (data: VariantFields) => {
    // Validate required custom fields before submit
    const missing = fieldDefs.filter(
      (d) => d.required && (customValues[d.id] == null || customValues[d.id] === '')
    )
    if (missing.length > 0) {
      toast.error(`Required fields missing: ${missing.map((d) => d.name).join(', ')}`)
      return
    }

    const payload = {
      ...data,
      barcode: data.barcode || null,
      location_id: data.location_id || null,
      default_supplier_id: data.default_supplier_id || null,
      status: (data.status || 'available') as VariantStatus,
    }
    let variantId = editing?.id
    if (editing) {
      await updateVariant.mutateAsync({ id: editing.id, input: payload })
    } else {
      const created = await createVariant.mutateAsync(payload)
      variantId = created.id
    }
    if (fieldDefs.length > 0 && variantId) {
      await updateCustomValues.mutateAsync({ variantId, values: customValues })
    }
    reset()
    onDone()
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{editing ? 'Edit Variant' : 'New Variant'}</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDone}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input className="h-8 text-sm" placeholder="e.g. 500ml" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">SKU</Label>
            <Input className="h-8 text-sm" placeholder="e.g. WATER-500" {...register('sku')} />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Barcode (EAN / UPC)</Label>
            <Input className="h-8 text-sm font-mono" placeholder="Leave blank to use SKU" {...register('barcode')} />
            <p className="text-[10px] text-muted-foreground">Leave blank to use SKU as barcode</p>
          </div>
          {locations.length > 0 && (
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Storage Location</Label>
              <Controller
                name="location_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(v) => { field.onChange(v === '__none__' ? null : v); }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="— No location —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— No location —</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
          {suppliers.length > 0 && (
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Default Supplier</Label>
              <Controller
                name="default_supplier_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(v) => { field.onChange(v === '__none__' ? null : v); }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="— No supplier —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— No supplier —</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.lead_time_days != null ? ` · ${String(s.lead_time_days)}d lead` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-[10px] text-muted-foreground">
                Used for lead-time gap analysis in inventory rows.
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Unit Cost</Label>
            <Input
              className="h-8 text-sm"
              type="number"
              step="0.01"
              min="0"
              {...register('cost', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unit of Measure</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g. bottles, kg, cases"
              {...register('unit_of_measure')}
            />
            <p className="text-[10px] text-muted-foreground">Shown next to stock counts — "47 bottles"</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Low Stock Threshold</Label>
            <Input
              className="h-8 text-sm"
              type="number"
              min="0"
              step="1"
              {...register('low_stock_threshold', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? 'available'}
                  onValueChange={(v) => { field.onChange(v); }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(VARIANT_STATUS_LABELS) as [VariantStatus, string][]).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Date Reminder (optional)</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm w-40"
                type="date"
                {...register('reminder_date')}
              />
              <Input
                className="h-8 text-sm flex-1"
                placeholder="Label, e.g. Boiler service due"
                {...register('reminder_label')}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Set a date to be reminded — maintenance, warranty, inspection, permit renewal…</p>
          </div>
        </div>

        {fieldDefs.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Fields</p>
            <div className="grid grid-cols-2 gap-3">
              {fieldDefs.map((def) => {
                const isMissing = def.required && (customValues[def.id] == null || customValues[def.id] === '')
                return (
                  <div key={def.id} className="space-y-1">
                    <Label className={cn('text-xs', isMissing && 'text-destructive')}>
                      {def.name}
                      {def.required && <span className="ml-0.5 text-destructive">*</span>}
                    </Label>
                    {renderCustomInput(def, customValues[def.id], (val) => { handleCustomChange(def.id, val); })}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {editing ? 'Save' : 'Add Variant'}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Variant row ──────────────────────────────────────────────────────────────

function VariantRow({
  variant,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleActive,
  isDeleting,
}: {
  variant: ProductVariant
  expanded: boolean
  onToggleExpand: (id: string) => void
  onEdit: (v: ProductVariant) => void
  onDelete: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
  isDeleting: boolean
}) {
  const fmtDate = useDateFormat()
  const isInactive = !variant.active
  const isLow =
    variant.low_stock_threshold > 0 &&
    variant.current_stock <= variant.low_stock_threshold &&
    variant.current_stock > 0
  const isOut = variant.current_stock === 0

  return (
    <div className={cn(isInactive && 'opacity-50')}>
      <div className="flex items-start gap-3 py-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted">
          <Package className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn('text-sm font-medium', isInactive && 'line-through text-muted-foreground')}>{variant.name}</p>
            {isInactive && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 border-slate-300 bg-slate-50 text-slate-500">
                Inactive
              </Badge>
            )}
            {!isInactive && isOut && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 border-red-200 bg-red-50 text-red-700">
                Out
              </Badge>
            )}
            {!isInactive && isLow && !isOut && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-200 bg-yellow-50 text-yellow-700">
                Low
              </Badge>
            )}
            {variant.status !== 'available' && (
              <Badge variant="outline" className={cn('text-[10px] px-1 py-0',
                variant.status === 'in_use'      && 'border-blue-200 bg-blue-50 text-blue-700',
                variant.status === 'maintenance' && 'border-orange-200 bg-orange-50 text-orange-700',
                variant.status === 'retired'     && 'border-slate-200 bg-slate-50 text-slate-600',
                variant.status === 'ordered'     && 'border-purple-200 bg-purple-50 text-purple-700',
              )}>
                {VARIANT_STATUS_LABELS[variant.status]}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">{variant.sku}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              Stock:{' '}
              <span className={cn('font-medium', isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-foreground')}>
                {variant.current_stock}{variant.unit_of_measure ? ` ${variant.unit_of_measure}` : ''}
              </span>
            </span>
            {variant.cost > 0 && <span>Cost: {variant.cost.toFixed(2)}</span>}
            {variant.low_stock_threshold > 0 && <span>Alert at: {variant.low_stock_threshold}</span>}
            {variant.barcode && <span>Barcode: {variant.barcode}</span>}
            {variant.location_id && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />Location set</span>}
            {variant.reminder_date && (
              <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                <Bell className="h-3 w-3" />
                {variant.reminder_label ?? 'Reminder'}: {fmtDate(variant.reminder_date)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', expanded ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'text-muted-foreground hover:text-foreground')}
            title={expanded ? 'Hide intelligence' : 'Show velocity & runway'}
            onClick={() => { onToggleExpand(variant.id); }}
          >
            <Activity className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', isInactive ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground hover:text-foreground')}
            title={isInactive ? 'Mark active' : 'Mark inactive'}
            onClick={() => { onToggleActive(variant.id, !isInactive); }}
          >
            <PowerOff className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onEdit(variant); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => { onDelete(variant.id); }}
            disabled={isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="pb-3">
          <EntityContextPanel variantId={variant.id} />
        </div>
      )}
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  product: ProductWithVariants
}

export function VariantManagerDrawer({ open, onClose, product }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null)
  const deleteVariant = useDeleteVariant()
  const toggleActive = useToggleVariantActive()

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedVariantId((prev) => prev === id ? null : id)
  }, [])

  const openAdd = () => {
    setEditingVariant(null)
    setShowForm(true)
  }

  const openEdit = (v: ProductVariant) => {
    setEditingVariant(v)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingVariant(null)
  }

  const handleDelete = (id: string) => {
    const variant = product.product_variants.find((v) => v.id === id)
    if (variant && variant.current_stock > 0) {
      // Soft guard — prompt via ConfirmDialog before archiving variants with remaining stock
      setDeleteConfirm(id)
      return
    }
    deleteVariant.mutate(id)
  }

  const confirmingVariant = deleteConfirm
    ? product.product_variants.find((v) => v.id === deleteConfirm)
    : null

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { onClose() } }}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
          <div>
            <SheetTitle className="text-base">Variants — {product.name}</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {product.product_variants.length} variant{product.product_variants.length !== 1 ? 's' : ''}
            </p>
          </div>
          {!showForm && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-4 space-y-2">
            {showForm && (
              <VariantForm
                productId={product.id}
                editing={editingVariant}
                onDone={closeForm}
              />
            )}

            {product.product_variants.length === 0 && !showForm ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Package className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No variants yet.</p>
                <Button variant="outline" size="sm" onClick={openAdd}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add first variant
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {product.product_variants.map((v, i) => (
                  <div key={v.id}>
                    <VariantRow
                      variant={v}
                      expanded={expandedVariantId === v.id}
                      onToggleExpand={handleToggleExpand}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onToggleActive={(id, active) => { toggleActive.mutate({ id, active }); }}
                      isDeleting={deleteVariant.isPending}
                    />
                    {i < product.product_variants.length - 1 && <Separator className="my-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Archive variant with remaining stock?"
        description={
          confirmingVariant
            ? `"${confirmingVariant.name}" still has ${String(confirmingVariant.current_stock)} unit${confirmingVariant.current_stock !== 1 ? 's' : ''} in stock. Remove all stock first, or confirm to archive it anyway.`
            : ''
        }
        confirmLabel="Archive anyway"
        destructive
        onConfirm={() => {
          if (deleteConfirm) deleteVariant.mutate(deleteConfirm)
          setDeleteConfirm(null)
        }}
        onCancel={() => { setDeleteConfirm(null) }}
      />
    </Sheet>
  )
}

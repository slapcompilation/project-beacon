// EntityContextPanel per-variant so any inspection surfaces velocity, runway, PO status, waste.

import { useState, useCallback } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Button, Divider, Drawer, FormGroup, HTMLSelect,
  Icon, InputGroup, Intent, Tag,
} from '@blueprintjs/core'
import { EntityContextPanel } from '@/features/eye/components/EntityContextPanel'
import { cn } from '@/lib/utils'
import { useCreateVariant, useUpdateVariant, useDeleteVariant, useToggleVariantActive } from '../hooks'
import { useDateFormat } from '@/features/user/hooks'
import { useLocations } from '@/features/locations/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useCustomFieldDefs, useUpdateVariantCustomValues } from '@/features/custom-fields/hooks'
import type { ProductWithVariants, ProductVariant, CustomFieldDef, VariantStatus } from '@beacon/types'
import { VARIANT_STATUS_LABELS } from '@beacon/types'
import { bpRegister } from '@/lib/forms'

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
        <InputGroup
          size="small"
          value={value as string}
          onChange={(e) => { onChange(e.target.value || null) }}
        />
      )
    case 'number':
      return (
        <InputGroup
          size="small"
          type="number"
          value={value == null ? '' : String(value as number)}
          onChange={(e) => { onChange(e.target.value === '' ? null : Number(e.target.value)) }}
        />
      )
    case 'date':
      return (
        <InputGroup
          size="small"
          type="date"
          value={value as string}
          onChange={(e) => { onChange(e.target.value || null) }}
        />
      )
    case 'boolean':
      return (
        <HTMLSelect
          value={value == null ? '__none__' : String(value as boolean)}
          onChange={(e) => { onChange(e.target.value === '__none__' ? null : e.target.value === 'true') }}
          options={[
            { value: '__none__', label: '—' },
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          fill
        />
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
        <Button variant="minimal" size="small" icon="cross" onClick={onDone} aria-label="Close" />
      </div>

      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Name" intent={errors.name ? Intent.DANGER : Intent.NONE} helperText={errors.name?.message}>
            <InputGroup size="small" placeholder="e.g. 500ml" {...bpRegister(register('name'))} />
          </FormGroup>
          <FormGroup label="SKU" intent={errors.sku ? Intent.DANGER : Intent.NONE} helperText={errors.sku?.message}>
            <InputGroup size="small" placeholder="e.g. WATER-500" {...bpRegister(register('sku'))} />
          </FormGroup>
          <FormGroup label="Barcode (EAN / UPC)" helperText="Leave blank to use SKU">
            <InputGroup size="small" className="!font-mono" placeholder="Leave blank to use SKU" {...bpRegister(register('barcode'))} />
          </FormGroup>
          {locations.length > 0 && (
            <FormGroup label="Storage Location" className="col-span-2">
              <Controller
                name="location_id"
                control={control}
                render={({ field }) => (
                  <HTMLSelect
                    value={field.value ?? '__none__'}
                    onChange={(e) => { field.onChange(e.target.value === '__none__' ? null : e.target.value) }}
                    options={[
                      { value: '__none__', label: '— No location —' },
                      ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
                    ]}
                    fill
                  />
                )}
              />
            </FormGroup>
          )}
          {suppliers.length > 0 && (
            <FormGroup label="Default Supplier" className="col-span-2" helperText="Used for lead-time gap analysis in inventory rows.">
              <Controller
                name="default_supplier_id"
                control={control}
                render={({ field }) => (
                  <HTMLSelect
                    value={field.value ?? '__none__'}
                    onChange={(e) => { field.onChange(e.target.value === '__none__' ? null : e.target.value) }}
                    options={[
                      { value: '__none__', label: '— No supplier —' },
                      ...suppliers.map((s) => ({
                        value: s.id,
                        label: `${s.name}${s.lead_time_days != null ? ` · ${String(s.lead_time_days)}d lead` : ''}`,
                      })),
                    ]}
                    fill
                  />
                )}
              />
            </FormGroup>
          )}
          <FormGroup label="Unit Cost">
            <InputGroup
              size="small"
              type="number"
              step="0.01"
              min="0"
              {...bpRegister(register('cost', { valueAsNumber: true }))}
            />
          </FormGroup>
          <FormGroup label="Unit of Measure" helperText='Shown next to stock counts — "47 bottles"'>
            <InputGroup size="small" placeholder="e.g. bottles, kg, cases" {...bpRegister(register('unit_of_measure'))} />
          </FormGroup>
          <FormGroup label="Low Stock Threshold">
            <InputGroup
              size="small"
              type="number"
              min="0"
              step="1"
              {...bpRegister(register('low_stock_threshold', { valueAsNumber: true }))}
            />
          </FormGroup>
          <FormGroup label="Status">
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <HTMLSelect
                  value={field.value ?? 'available'}
                  onChange={(e) => { field.onChange(e.target.value) }}
                  options={(Object.entries(VARIANT_STATUS_LABELS) as [VariantStatus, string][]).map(([val, label]) => ({
                    value: val,
                    label,
                  }))}
                  fill
                />
              )}
            />
          </FormGroup>
          <FormGroup
            label="Date Reminder (optional)"
            className="col-span-2"
            helperText="Set a date to be reminded — maintenance, warranty, inspection, permit renewal…"
          >
            <div className="flex gap-2">
              <div className="w-40">
                <InputGroup size="small" type="date" {...bpRegister(register('reminder_date'))} />
              </div>
              <div className="flex-1">
                <InputGroup size="small" placeholder="Label, e.g. Boiler service due" {...bpRegister(register('reminder_label'))} />
              </div>
            </div>
          </FormGroup>
        </div>

        {fieldDefs.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Fields</p>
            <div className="grid grid-cols-2 gap-3">
              {fieldDefs.map((def) => {
                const isMissing = def.required && (customValues[def.id] == null || customValues[def.id] === '')
                return (
                  <FormGroup
                    key={def.id}
                    label={<>{def.name}{def.required && <span className="ml-0.5 text-destructive">*</span>}</>}
                    intent={isMissing ? Intent.DANGER : Intent.NONE}
                  >
                    {renderCustomInput(def, customValues[def.id], (val) => { handleCustomChange(def.id, val) })}
                  </FormGroup>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="minimal" size="small" onClick={onDone} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="small" intent={Intent.PRIMARY} loading={isSubmitting}>
            {editing ? 'Save' : 'Add Variant'}
          </Button>
        </div>
      </form>
    </div>
  )
}

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
          <Icon icon="box" size={14} className="text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn('text-sm font-medium', isInactive && 'line-through text-muted-foreground')}>{variant.name}</p>
            {isInactive && (
              <Tag minimal className="!text-[10px] !px-1 !py-0">Inactive</Tag>
            )}
            {!isInactive && isOut && (
              <Tag minimal intent={Intent.DANGER} className="!text-[10px] !px-1 !py-0">Out</Tag>
            )}
            {!isInactive && isLow && !isOut && (
              <Tag minimal intent={Intent.WARNING} className="!text-[10px] !px-1 !py-0">Low</Tag>
            )}
            {variant.status !== 'available' && (
              <Tag
                minimal
                intent={
                  variant.status === 'in_use'      ? Intent.PRIMARY :
                  variant.status === 'maintenance' ? Intent.WARNING :
                  variant.status === 'retired'     ? Intent.NONE :
                  Intent.PRIMARY  // 'ordered'
                }
                className="!text-[10px] !px-1 !py-0"
              >
                {VARIANT_STATUS_LABELS[variant.status]}
              </Tag>
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
            {variant.location_id && <span className="flex items-center gap-0.5"><Icon icon="map-marker" size={12} />Location set</span>}
            {variant.reminder_date && (
              <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                <Icon icon="notifications" size={12} />
                {variant.reminder_label ?? 'Reminder'}: {fmtDate(variant.reminder_date)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="minimal"
            size="small"
            icon="pulse"
            title={expanded ? 'Hide intelligence' : 'Show velocity & runway'}
            onClick={() => { onToggleExpand(variant.id) }}
            aria-label="Toggle intelligence"
            className={expanded ? '!text-blue-600 !bg-blue-50 dark:!bg-blue-950/30' : ''}
          />
          <Button
            variant="minimal"
            size="small"
            icon="power"
            title={isInactive ? 'Mark active' : 'Mark inactive'}
            onClick={() => { onToggleActive(variant.id, !isInactive) }}
            aria-label="Toggle active"
            className={isInactive ? '!text-green-600 hover:!text-green-700' : ''}
          />
          <Button variant="minimal" size="small" icon="edit" onClick={() => { onEdit(variant) }} aria-label="Edit" />
          <Button
            variant="minimal"
            size="small"
            icon="trash"
            intent={Intent.DANGER}
            onClick={() => { onDelete(variant.id) }}
            disabled={isDeleting}
            aria-label="Delete"
          />
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
      // Soft guard — prompt before archiving with remaining stock
      setDeleteConfirm(id)
      return
    }
    deleteVariant.mutate(id)
  }

  const confirmingVariant = deleteConfirm
    ? product.product_variants.find((v) => v.id === deleteConfirm)
    : null

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      position="right"
      size="28rem"
      title={
        <div className="flex items-center justify-between w-full">
          <div>
            <span>Variants — {product.name}</span>
            <p className="text-sm text-muted-foreground font-normal">
              {product.product_variants.length} variant{product.product_variants.length !== 1 ? 's' : ''}
            </p>
          </div>
          {!showForm && (
            <Button size="small" intent={Intent.PRIMARY} icon="plus" onClick={openAdd}>
              Add
            </Button>
          )}
        </div>
      }
      className="!p-0"
    >
      <div className="flex-1 overflow-y-auto px-6">
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
              <Icon icon="box" size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No variants yet.</p>
              <Button variant="outlined" size="small" icon="plus" onClick={openAdd}>
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
                    onToggleActive={(id, active) => { toggleActive.mutate({ id, active }) }}
                    isDeleting={deleteVariant.isPending}
                  />
                  {i < product.product_variants.length - 1 && <Divider className="!my-0" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
    </Drawer>
  )
}

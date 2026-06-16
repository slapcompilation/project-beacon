// Inventory: category hierarchy with drag-to-nest.

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button, Card, Dialog, DialogBody, DialogFooter, FormGroup, HTMLSelect,
  Icon, InputGroup, Intent, Spinner, SpinnerSize,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
} from '@/features/categories/hooks'
import type { Category } from '@beacon/types'
import { SectionHeader } from './_shared'
import { bpRegister } from '@/lib/forms'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  parentId: z.string().nullable().optional(),
  requirePhotoOver: z.number().int().min(0).nullable().optional(),
})
type CategoryFields = z.infer<typeof categorySchema>

function CategoryModal({
  open, onClose, editing, categories,
}: {
  open: boolean
  onClose: () => void
  editing?: Category | null
  categories: Category[]
}) {
  const create = useCreateCategory()
  const update = useUpdateCategory()

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<CategoryFields>({
    resolver: zodResolver(categorySchema),
    values: editing
      ? { name: editing.name, parentId: editing.parent_id, requirePhotoOver: editing.require_photo_for_removal_over }
      : { name: '', parentId: null, requirePhotoOver: null },
  })

  const onSubmit = async (data: CategoryFields) => {
    const parentId = data.parentId ?? null
    const requirePhotoOver = data.requirePhotoOver ?? null
    if (editing) {
      await update.mutateAsync({ id: editing.id, name: data.name, parentId, requirePhotoOver })
    } else {
      await create.mutateAsync({ name: data.name, parentId })
    }
    reset()
    onClose()
  }

  const parentOptions = categories.filter((c) => !c.parent_id && c.id !== editing?.id)

  return (
    <Dialog
      isOpen={open}
      onClose={onClose}
      title={editing ? 'Edit Category' : 'Add Category'}
      icon="folder-open"
    >
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
        <DialogBody>
          <FormGroup
            label="Name"
            labelFor="cat-name"
            intent={errors.name ? Intent.DANGER : Intent.NONE}
            helperText={errors.name?.message}
          >
            <InputGroup
              id="cat-name"
              placeholder="e.g. Beverages"
              intent={errors.name ? Intent.DANGER : Intent.NONE}
              {...bpRegister(register('name'))}
            />
          </FormGroup>
          <FormGroup label="Parent category" labelFor="cat-parent">
            <Controller
              name="parentId"
              control={control}
              render={({ field }) => (
                <HTMLSelect
                  id="cat-parent"
                  fill
                  value={field.value ?? '__none__'}
                  onChange={(e) => { field.onChange(e.target.value === '__none__' ? null : e.target.value) }}
                  options={[
                    { value: '__none__', label: 'None (top-level)' },
                    ...parentOptions.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
            />
          </FormGroup>
          {editing && (
            <FormGroup
              label="Require photo for removals over (units)"
              labelFor="cat-photo"
              helperText="Staff must attach a photo when removing more than this quantity."
            >
              <InputGroup
                id="cat-photo"
                type="number"
                min={0}
                step={1}
                placeholder="Leave blank to disable"
                {...bpRegister(register('requirePhotoOver', { valueAsNumber: true }))}
              />
            </FormGroup>
          )}
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" intent={Intent.PRIMARY} loading={isSubmitting}>
                {editing ? 'Save Changes' : 'Add Category'}
              </Button>
            </>
          }
        />
      </form>
    </Dialog>
  )
}

export function CategoriesSection() {
  const { data: categories = [], isLoading } = useCategories()
  const deleteCategory = useDeleteCategory()
  const updateCategory = useUpdateCategory()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const topLevel = categories.filter((c) => !c.parent_id)
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId)

  const handleDrop = (targetCat: Category) => {
    if (!dragId || dragId === targetCat.id) return
    const dragged = categories.find((c) => c.id === dragId)
    if (!dragged) return
    const newParentId = targetCat.parent_id === null ? targetCat.id : null
    if (dragged.parent_id === newParentId) return
    updateCategory.mutate({
      id: dragged.id,
      name: dragged.name,
      parentId: newParentId,
      requirePhotoOver: dragged.require_photo_for_removal_over,
    })
    setDragId(null); setDropTargetId(null)
  }

  const renderCatRow = (cat: Category, indent = false) => (
    <div
      key={cat.id}
      draggable
      onDragStart={(e) => { e.stopPropagation(); setDragId(cat.id) }}
      onDragOver={(e) => { e.preventDefault(); setDropTargetId(cat.id) }}
      onDragLeave={() => { setDropTargetId(null) }}
      onDrop={(e) => { e.preventDefault(); handleDrop(cat) }}
      onDragEnd={() => { setDragId(null); setDropTargetId(null) }}
      className={cn(
        'flex items-center justify-between px-4 py-2.5 transition-colors',
        indent && 'pl-10 bg-muted/30',
        dropTargetId === cat.id && dragId !== cat.id && 'bg-primary/10 ring-1 ring-inset ring-primary/30'
      )}
    >
      <div className="flex items-center gap-2">
        <Icon icon="drag-handle-vertical" size={14} className="text-muted-foreground/40 cursor-grab flex-shrink-0" />
        <div>
          <span className={cn('text-sm', indent ? 'text-muted-foreground' : 'font-medium')}>{cat.name}</span>
          {cat.require_photo_for_removal_over != null && (
            <span className="ml-2 text-xs text-muted-foreground">photo &gt;{cat.require_photo_for_removal_over}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          icon="edit"
          variant="minimal"
          size="small"
          aria-label="Edit category"
          onClick={() => { setEditing(cat); setModalOpen(true) }}
        />
        <Button
          icon="trash"
          variant="minimal"
          size="small"
          intent={Intent.DANGER}
          aria-label="Delete category"
          onClick={() => { deleteCategory.mutate(cat.id) }}
        />
      </div>
    </div>
  )

  return (
    <div>
      <SectionHeader title="Categories" description="Organise products into categories and sub-categories. Drag a category onto another to nest it." />
      <div className="flex justify-end mb-3">
        <Button icon="plus" intent={Intent.PRIMARY} onClick={() => { setEditing(null); setModalOpen(true) }}>
          Add Category
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Spinner size={SpinnerSize.SMALL} />Loading…
        </div>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No categories yet.</p>
      ) : (
        <Card compact className="!p-0 divide-y">
          {topLevel.map((cat) => (
            <div key={cat.id}>
              {renderCatRow(cat)}
              {childrenOf(cat.id).map((child) => renderCatRow(child, true))}
            </div>
          ))}
        </Card>
      )}
      <CategoryModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        editing={editing}
        categories={categories}
      />
    </div>
  )
}

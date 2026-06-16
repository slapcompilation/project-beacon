import { useEffect, useRef, useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Button, Dialog, DialogBody, DialogFooter, FormGroup,
  HTMLSelect, Icon, InputGroup, Intent, TextArea,
} from '@blueprintjs/core'
import { useCreateProduct, useUpdateProduct } from '../hooks'
import { useCategories } from '@/features/categories/hooks'
import { uploadProductImage } from '../api'
import type { ProductWithVariants } from '@beacon/types'
import { bpRegister } from '@/lib/forms'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().optional(),
  cost: z.number().min(0, 'Cost must be 0 or more'),
  category_id: z.string().nullable().optional(),
  initial_stock: z.number().int().min(0).optional(),
})

type Fields = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  product?: ProductWithVariants | null
}

export function ProductFormModal({ open, onClose, product }: Props) {
  const isEdit = !!product
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const { data: categories = [] } = useCategories()

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const addTag = useCallback((raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '')
    if (!tag || tags.includes(tag)) return
    setTags((prev) => [...prev, tag])
    setTagInput('')
  }, [tags])

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { cost: 0, category_id: null },
  })

  useEffect(() => {
    if (open) {
      reset(
        product
          ? {
              name: product.name,
              sku: product.sku,
              description: product.description ?? '',
              cost: product.cost,
              category_id: product.category_id,
            }
          : { name: '', sku: '', description: '', cost: 0, category_id: null, initial_stock: 0 }
      )
      setImageFile(null)
      setImagePreview(product?.image_url ?? null)
      setTags(product?.tags ?? [])
      setTagInput('')
    }
  }, [open, product, reset])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Resize to max 512×512, letterbox, output as jpeg @ 0.85
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 512
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = MAX; canvas.height = MAX
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, MAX, MAX)
      ctx.drawImage(img, (MAX - w) / 2, (MAX - h) / 2, w, h)
      canvas.toBlob((blob) => {
        if (!blob) return
        const resized = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
        if (imagePreview && !product?.image_url) URL.revokeObjectURL(imagePreview)
        setImageFile(resized)
        setImagePreview(URL.createObjectURL(resized))
      }, 'image/jpeg', 0.85)
    }
    img.src = objectUrl
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const onSubmit = async (data: Fields) => {
    // uploadProductImage throws on failure (migration 125 / Bug A2 — silent null returns hid RLS regressions)
    let imageUrl = product?.image_url ?? null
    if (imageFile) {
      try {
        imageUrl = await uploadProductImage(imageFile)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Image upload failed')
        return
      }
    } else if (!imagePreview) {
      imageUrl = null
    }

    const { initial_stock, ...rest } = data
    const payload = { ...rest, image_url: imageUrl, tags }

    if (isEdit) {
      await updateProduct.mutateAsync({ id: product.id, input: payload })
    } else {
      await createProduct.mutateAsync({ ...payload, initial_stock: initial_stock ?? 0 })
    }
    onClose()
  }

  return (
    <Dialog isOpen={open} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add Product'} className="!w-[28rem]">
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
        <DialogBody>
          <div className="space-y-4">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            {imagePreview ? (
              <div className="flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="h-16 w-16 rounded-lg object-cover border"
                />
                <Button type="button" variant="outlined" size="small" icon="cross" onClick={clearImage}>
                  Remove
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outlined"
                size="small"
                icon="camera"
                onClick={() => imageInputRef.current?.click()}
              >
                Upload Image
              </Button>
            )}

            <FormGroup label="Name" intent={errors.name ? Intent.DANGER : Intent.NONE} helperText={errors.name?.message}>
              <InputGroup id="name" placeholder="e.g. Sparkling Water" {...bpRegister(register('name'))} />
            </FormGroup>

            <FormGroup label="SKU" intent={errors.sku ? Intent.DANGER : Intent.NONE} helperText={errors.sku?.message}>
              <InputGroup id="sku" placeholder="e.g. WATER-SPARK-500" {...bpRegister(register('sku'))} />
            </FormGroup>

            <FormGroup label="Description">
              <TextArea id="description" rows={2} placeholder="Optional" fill {...bpRegister(register('description'))} />
            </FormGroup>

            <div className="grid grid-cols-2 gap-3">
              <FormGroup label="Unit Cost" intent={errors.cost ? Intent.DANGER : Intent.NONE} helperText={errors.cost?.message}>
                <InputGroup id="cost" type="number" step="0.01" min="0" {...bpRegister(register('cost', { valueAsNumber: true }))} />
              </FormGroup>
              {!isEdit && (
                <FormGroup
                  label={<>Initial Quantity <span className="ml-1 text-[10px] font-normal text-muted-foreground">(on hand now)</span></>}
                  intent={errors.initial_stock ? Intent.DANGER : Intent.NONE}
                  helperText={errors.initial_stock?.message}
                >
                  <InputGroup
                    id="initial_stock"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    {...bpRegister(register('initial_stock', { valueAsNumber: true }))}
                  />
                </FormGroup>
              )}
            </div>

            <FormGroup label="Category">
              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <HTMLSelect
                    value={field.value ?? '__none__'}
                    onChange={(e) => { field.onChange(e.target.value === '__none__' ? null : e.target.value) }}
                    options={[
                      { value: '__none__', label: 'No category' },
                      ...categories.map((cat) => ({
                        value: cat.id,
                        label: cat.parent_id ? `  ${cat.name}` : cat.name,
                      })),
                    ]}
                    fill
                  />
                )}
              />
            </FormGroup>

            <FormGroup label={<span className="flex items-center gap-1.5"><Icon icon="tag" size={14} />Tags</span>}>
              <div className="flex flex-wrap gap-1.5 min-h-8 rounded-md border px-2 py-1.5 bg-background focus-within:ring-1 focus-within:ring-ring">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">
                    {tag}
                    <button
                      type="button"
                      onClick={() => { removeTag(tag) }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon icon="cross" size={12} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  className="flex-1 min-w-20 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder={tags.length === 0 ? 'Add tags (press Enter or comma)…' : ''}
                  value={tagInput}
                  onChange={(e) => { setTagInput(e.target.value) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addTag(tagInput)
                    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                      removeTag(tags[tags.length - 1])
                    }
                  }}
                  onBlur={() => { if (tagInput) addTag(tagInput) }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">e.g. "bar", "premium", "seasonal" — type and press Enter or comma</p>
            </FormGroup>
          </div>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button type="button" variant="minimal" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" intent={Intent.PRIMARY} loading={isSubmitting}>
                {isEdit ? 'Save Changes' : 'Add Product'}
              </Button>
            </>
          }
        />
      </form>
    </Dialog>
  )
}

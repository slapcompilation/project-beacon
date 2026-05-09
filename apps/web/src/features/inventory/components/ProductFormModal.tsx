import { useEffect, useRef, useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Camera, X, Tag } from 'lucide-react'
import { toast } from 'sonner'
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
import { useCreateProduct, useUpdateProduct } from '../hooks'
import { useCategories } from '@/features/categories/hooks'
import { uploadProductImage } from '../api'
import type { ProductWithVariants } from '@beacon/types'

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
    // Resize to max 512×512, letterbox (contain), output as jpeg at 0.85 quality
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
    // Upload new image if selected. The helper throws on failure now (see
    // migration 125 / Bug A2 — silent null-returns hid bucket RLS regressions).
    let imageUrl = product?.image_url ?? null
    if (imageFile) {
      try {
        imageUrl = await uploadProductImage(imageFile)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Image upload failed')
        return  // abort save — operator can retry or remove the image and try again
      }
    } else if (!imagePreview) {
      // User cleared the existing image
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4 py-2">
          {/* Product image */}
          <div>
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
                <Button type="button" variant="outline" size="sm" onClick={clearImage}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                Upload Image
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Sparkling Water" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" placeholder="e.g. WATER-SPARK-500" {...register('sku')} />
            {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} placeholder="Optional" {...register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cost">Unit Cost</Label>
              <Input id="cost" type="number" step="0.01" min="0" {...register('cost', { valueAsNumber: true })} />
              {errors.cost && <p className="text-sm text-destructive">{errors.cost.message}</p>}
            </div>
            {!isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="initial_stock">
                  Initial Quantity
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">(on hand now)</span>
                </Label>
                <Input
                  id="initial_stock"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  {...register('initial_stock', { valueAsNumber: true })}
                />
                {errors.initial_stock && <p className="text-sm text-destructive">{errors.initial_stock.message}</p>}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? '__none__'}
                  onValueChange={(v) => { field.onChange(v === '__none__' ? null : v); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.parent_id ? `  ${cat.name}` : cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Tags</Label>
            <div className="flex flex-wrap gap-1.5 min-h-8 rounded-md border px-2 py-1.5 bg-background focus-within:ring-1 focus-within:ring-ring">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">
                  {tag}
                  <button
                    type="button"
                    onClick={() => { removeTag(tag) }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
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
            <p className="text-[10px] text-muted-foreground">e.g. "bar", "premium", "seasonal" — type and press Enter or comma</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

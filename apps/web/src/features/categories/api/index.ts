import { supabase } from '@/lib/supabase/client'
import type { Category } from '@beacon/types'

export async function fetchCategories(hotelId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('order')
    .order('name')

  if (error) throw new Error(error.message)
  return data as Category[]
}

export async function createCategory(
  hotelId: string,
  name: string,
  parentId?: string | null
): Promise<Category> {
  const result = await supabase
    .from('categories')
    .insert({ hotel_id: hotelId, name, parent_id: parentId ?? null })
    .select()
    .single()
  const { error } = result
  const data = result.data as Category

  if (error) throw new Error(error.message)
  return data
}

export async function updateCategory(
  id: string,
  name: string,
  parentId?: string | null,
  requirePhotoOver?: number | null
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({
      name,
      parent_id: parentId ?? null,
      require_photo_for_removal_over: requirePhotoOver ?? null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) {
    if (error.code === '23503')
      throw new Error('Remove this category from all products before deleting it.')
    throw new Error(error.message)
  }
}

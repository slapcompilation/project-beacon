// Layer: Flow — custom move reason categories (hotel-scoped)
import { supabase } from '@/lib/supabase/client'
import type { CustomRemovalReason } from '@beacon/types'

export async function fetchCustomRemovalReasons(hotelId: string): Promise<CustomRemovalReason[]> {
  const { data, error } = (await supabase
    .from('custom_removal_reasons')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('sort_order')
    .order('name')) as unknown as { data: CustomRemovalReason[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createCustomRemovalReason(
  hotelId: string,
  name: string,
  sortOrder = 0
): Promise<CustomRemovalReason> {
  const { data, error } = (await supabase
    .from('custom_removal_reasons')
    .insert({ hotel_id: hotelId, name, sort_order: sortOrder })
    .select('*')
    .single()) as unknown as { data: CustomRemovalReason | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return data as CustomRemovalReason
}

export async function updateCustomRemovalReason(
  id: string,
  patch: { name?: string; sort_order?: number }
): Promise<void> {
  const { error } = await supabase.from('custom_removal_reasons').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteCustomRemovalReason(id: string): Promise<void> {
  const { error } = await supabase.from('custom_removal_reasons').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

import { supabase } from '@/lib/supabase/client'
import type { CustomFieldDef, CustomFieldType } from '@beacon/types'

export async function fetchCustomFieldDefs(hotelId: string): Promise<CustomFieldDef[]> {
  const { data, error } = await supabase
    .from('product_custom_field_defs')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('sort_order')
    .order('name')

  if (error) throw new Error(error.message)
  return data as CustomFieldDef[]
}

export async function createCustomFieldDef(
  hotelId: string,
  input: { name: string; field_type: CustomFieldType }
): Promise<CustomFieldDef> {
  const result = await supabase
    .from('product_custom_field_defs')
    .insert({ hotel_id: hotelId, name: input.name, field_type: input.field_type })
    .select('*')
    .single()
  const { error } = result
  const data = result.data as CustomFieldDef

  if (error) throw new Error(error.message)
  return data
}

export async function updateCustomFieldDef(
  id: string,
  input: { name?: string; field_type?: CustomFieldType; required?: boolean; sort_order?: number }
): Promise<void> {
  const { error } = await supabase
    .from('product_custom_field_defs')
    .update(input)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function deleteCustomFieldDef(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_custom_field_defs')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function updateVariantCustomValues(
  variantId: string,
  values: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('product_variants')
    .update({ custom_values: values })
    .eq('id', variantId)

  if (error) throw new Error(error.message)
}

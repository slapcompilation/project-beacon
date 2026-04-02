// Layer: Flow — Pick List data access
import { supabase } from '@/lib/supabase/client'
import type { PickList, PickListItem, PickListItemWithVariant } from '@beacon/types'

// ─── Pick Lists ───────────────────────────────────────────────────────────────

export async function fetchPickLists(): Promise<PickList[]> {
  const { data, error } = await supabase
    .from('pick_lists')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PickList[]
}

export async function createPickList(input: {
  name: string
  notes?: string
  due_date?: string | null
  assigned_to?: string | null
}): Promise<PickList> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) throw new Error('Not authenticated')

  const { data: hotel } = await supabase
    .from('profiles')
    .select('hotel_id')
    .eq('id', userId)
    .single()
  if (!hotel) throw new Error('Hotel not found')

  const { data, error } = await supabase
    .from('pick_lists')
    .insert({
      name: input.name,
      notes: input.notes ?? null,
      due_date: input.due_date ?? null,
      assigned_to: input.assigned_to ?? null,
      hotel_id: hotel.hotel_id,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PickList
}

export async function updatePickList(
  id: string,
  input: Partial<Pick<PickList, 'name' | 'notes' | 'status' | 'due_date' | 'assigned_to'>>,
): Promise<void> {
  const { error } = await supabase.from('pick_lists').update(input).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePickList(id: string): Promise<void> {
  const { error } = await supabase.from('pick_lists').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Pick List Items ──────────────────────────────────────────────────────────

export async function fetchPickListItems(
  pickListId: string,
): Promise<PickListItemWithVariant[]> {
  const { data, error } = await supabase
    .from('pick_list_items')
    .select(`
      *,
      product_variants (
        id, name, sku, barcode, current_stock, unit_of_measure, cost,
        products ( id, name )
      )
    `)
    .eq('pick_list_id', pickListId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PickListItemWithVariant[]
}

export async function addPickListItem(input: {
  pick_list_id: string
  variant_id: string
  quantity_planned: number
  notes?: string
}): Promise<PickListItem> {
  const { data, error } = await supabase
    .from('pick_list_items')
    .insert(input)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PickListItem
}

export async function updatePickListItem(
  id: string,
  input: { quantity_picked?: number; quantity_planned?: number; notes?: string | null },
): Promise<void> {
  const payload: Record<string, unknown> = { ...input }
  if ('quantity_picked' in input) {
    payload.picked_at = (input.quantity_picked ?? 0) > 0 ? new Date().toISOString() : null
  }
  const { error } = await supabase.from('pick_list_items').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function removePickListItem(id: string): Promise<void> {
  const { error } = await supabase.from('pick_list_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function commitPickList(id: string): Promise<void> {
  const { error } = await supabase.rpc('commit_pick_list', { p_pick_list_id: id })
  if (error) throw new Error(error.message)
}

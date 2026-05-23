// principles table — CRUD for operator NL feedback that becomes soft guidance
// in agent prompts.

import { supabase } from '@/lib/supabase/client'
import type { PrincipleCategory } from '@beacon/reality-graph'

export interface PrincipleRow {
  id: string
  hotel_id: string
  organization_id: string | null
  body: string
  category: PrincipleCategory
  applies_to_node_ids: string[]
  active: boolean
  authored_by_user_id: string
  created_at: string
  deactivated_at: string | null
}

export async function fetchActivePrinciples(hotelId: string): Promise<PrincipleRow[]> {
  const { data, error } = await supabase
    .from('principles')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as PrincipleRow[]
}

export async function fetchAllPrinciples(hotelId: string): Promise<PrincipleRow[]> {
  const { data, error } = await supabase
    .from('principles')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as PrincipleRow[]
}

export interface CreatePrincipleInput {
  hotelId: string
  body: string
  category: PrincipleCategory
  appliesToNodeIds?: string[]
  authoredByUserId: string
}

export async function createPrinciple(input: CreatePrincipleInput): Promise<PrincipleRow> {
  const { data, error } = await supabase
    .from('principles')
    .insert({
      hotel_id:            input.hotelId,
      body:                input.body,
      category:            input.category,
      applies_to_node_ids: input.appliesToNodeIds ?? [],
      authored_by_user_id: input.authoredByUserId,
    })
    .select('*')
    .single<PrincipleRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function setPrincipleActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('principles')
    .update({
      active,
      deactivated_at: active ? null : new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

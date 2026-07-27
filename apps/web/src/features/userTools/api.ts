// Authored Logic Tools — CRUD over user_tools. The definition is data; the
// answer is computed by evaluateUserTool in reality-graph, never here.

import { supabase } from '@/lib/supabase/client'
import type { AggregationFn, ToolFilter } from '@beacon/reality-graph'

export interface UserToolRow {
  id: string
  organization_id: string
  hotel_id: string | null
  name: string
  api_name: string
  description: string
  subject_type_id: string
  filters: ToolFilter[]
  aggregation: { fn: AggregationFn; property?: string }
  enabled: boolean
  created_at: string
}

export async function fetchUserTools(): Promise<UserToolRow[]> {
  const { data, error } = await supabase
    .from('user_tools').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as UserToolRow[]
}

export interface CreateUserToolInput {
  name: string
  apiName: string
  description: string
  subjectTypeId: string
  filters: ToolFilter[]
  aggregation: { fn: AggregationFn; property?: string }
}

/** org + author land from column DEFAULTs, so the client sends only the tool. */
export async function createUserTool(i: CreateUserToolInput): Promise<UserToolRow> {
  const { data, error } = await supabase.from('user_tools')
    .insert({
      name: i.name, api_name: i.apiName, description: i.description,
      subject_type_id: i.subjectTypeId, filters: i.filters, aggregation: i.aggregation,
    })
    .select('*').single<UserToolRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteUserTool(id: string): Promise<void> {
  const { error } = await supabase.from('user_tools').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

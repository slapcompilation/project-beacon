// Checkpoints — the data layer (664/665). Reads ride RLS and the column
// grant: the base SELECT never carries a configuration's reviewer-only name
// and description, which arrive separately through the admin listing
// function. Records are immutable; the gate alone consumes them.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { checkpointTypes, submitCheckpoint } from '@beacon/platform'

export type JustificationType = 'acknowledgment' | 'response' | 'dropdown'
export type ConditionKind = 'location' | 'user_submitting' | 'selected_principal' | 'marking'

export interface DropdownOption {
  label: string
  free_response?: 'disabled' | 'optional' | 'mandatory'
}

export interface CheckpointConfig {
  id: string
  rid: string
  organization_id: string | null
  space_id: string | null
  title: string
  prompt: string
  checkpoint_description: string
  justification_type: JustificationType
  justification_config: {
    checkbox_text?: string
    regex?: string
    placeholder?: string
    display_recent?: boolean
    options?: DropdownOption[]
    multiple?: boolean
  }
  checkpoint_types: string[]
  created_at: string
}

// the base grant's columns — never name or description
const CONFIG_SELECT = 'id, rid, organization_id, space_id, title, prompt, '
  + 'checkpoint_description, justification_type, justification_config, checkpoint_types, created_at'

export interface CheckpointCondition {
  id: string
  config_id: string
  kind: ConditionKind
  negated: boolean
  user_id: string | null
  group_id: string | null
  include_member_groups: boolean
  marking_id: string | null
  project_id: string | null
  space_id: string | null
}

export interface CheckpointItem {
  kind: string
  ref_id: string
  name: string
}

export interface JustificationValue {
  kind: JustificationType
  acknowledged?: boolean
  response?: string
  selections?: { option: string; additional_response?: string }[]
}

export interface CheckpointRecord {
  id: string
  rid: string
  config_id: string | null
  config_rid: string
  checkpoint_type: string
  title: string
  prompt: string
  description: string
  justification: JustificationValue
  interaction_ref: string | null
  consumed_at: string | null
  created_at: string
  userEmail: string
  items: CheckpointItem[]
}

export function checkpointTypeLabel(t: string): string {
  const s = t.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The set the gate intercepts, asked of the database. */
export function useCheckpointTypes() {
  return useQuery({
    queryKey: ['checkpoints', 'types'],
    queryFn: async () =>
      await client(checkpointTypes).executeFunction({}) as unknown as string[],
  })
}

export function useCheckpointConfig(id: string | null) {
  return useQuery({
    queryKey: ['checkpoints', 'config', id],
    enabled: id !== null,
    queryFn: async (): Promise<CheckpointConfig | null> => {
      const { data, error } = await supabase.from('checkpoint_configurations')
        .select(CONFIG_SELECT).eq('id', id ?? '').maybeSingle()
      if (error) throw new Error(error.message)
      return data as CheckpointConfig | null
    },
  })
}

export function useCheckpointConfigs() {
  return useQuery({
    queryKey: ['checkpoints', 'configs'],
    queryFn: async (): Promise<CheckpointConfig[]> => {
      const { data, error } = await supabase.from('checkpoint_configurations')
        .select(CONFIG_SELECT).order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as unknown as CheckpointConfig[]
    },
  })
}

/** The reviewer-only pair, empty for non-admins by the function's own predicate. */
export function useConfigAdminNames() {
  return useQuery({
    queryKey: ['checkpoints', 'admin-names'],
    queryFn: async (): Promise<Map<string, { name: string; description: string }>> => {
      const res = await supabase.rpc('checkpoint_configuration_admin_listing') as {
        data: { id: string; name: string; description: string }[] | null
        error: { message: string } | null
      }
      if (res.error) throw new Error(res.error.message)
      return new Map((res.data ?? []).map((r) => [r.id, { name: r.name, description: r.description }]))
    },
  })
}

export function useCheckpointConditions(configId: string | null) {
  return useQuery({
    queryKey: ['checkpoints', 'conditions', configId],
    enabled: configId !== null,
    queryFn: async (): Promise<CheckpointCondition[]> => {
      const { data, error } = await supabase.from('checkpoint_conditions')
        .select('*').eq('config_id', configId ?? '')
      if (error) throw new Error(error.message)
      return data as CheckpointCondition[]
    },
  })
}

export interface RecordFilters {
  checkpointType?: string
  userId?: string
  from?: string
  to?: string
}

export function useCheckpointRecords(filters: RecordFilters) {
  return useQuery({
    queryKey: ['checkpoints', 'records', filters],
    queryFn: async (): Promise<CheckpointRecord[]> => {
      let q = supabase.from('checkpoint_records')
        .select('id, rid, config_id, config_rid, checkpoint_type, title, prompt, description, '
          + 'justification, interaction_ref, consumed_at, created_at, '
          + 'users(email), checkpoint_record_items(kind, ref_id, name)')
        .order('created_at', { ascending: false }).limit(200)
      if (filters.checkpointType !== undefined && filters.checkpointType !== '')
        q = q.eq('checkpoint_type', filters.checkpointType)
      if (filters.userId !== undefined && filters.userId !== '')
        q = q.eq('user_id', filters.userId)
      if (filters.from !== undefined && filters.from !== '') q = q.gte('created_at', filters.from)
      if (filters.to !== undefined && filters.to !== '') q = q.lte('created_at', filters.to)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      const rows = data as unknown as (Omit<CheckpointRecord, 'userEmail' | 'items'> & {
        users: { email: string } | { email: string }[] | null
        checkpoint_record_items: CheckpointItem[]
      })[]
      return rows.map(({ users, checkpoint_record_items, ...r }) => ({
        ...r,
        userEmail: (Array.isArray(users) ? users[0]?.email : users?.email) ?? '—',
        items: checkpoint_record_items,
      }))
    },
  })
}

/** "selecting one of their 5 most recently submitted justifications from the
 *  past month for this checkpoint configuration" — a query, not a table. */
export function useRecentJustifications(configId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['checkpoints', 'recent', configId],
    enabled: enabled && configId !== null,
    queryFn: async (): Promise<{ response: string; at: string }[]> => {
      const { data, error } = await supabase.from('checkpoint_records')
        .select('justification, created_at')
        .eq('config_id', configId ?? '')
        .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
        .order('created_at', { ascending: false }).limit(5)
      if (error) throw new Error(error.message)
      return (data as { justification: JustificationValue; created_at: string }[])
        .filter((r) => typeof r.justification.response === 'string')
        .map((r) => ({ response: r.justification.response ?? '', at: r.created_at }))
    },
  })
}

export async function submitCheckpointRecord(
  configId: string, justification: JustificationValue, items: CheckpointItem[],
): Promise<void> {
  await client(submitCheckpoint).applyAction({
    p_config: configId,
    p_justification: JSON.parse(JSON.stringify(justification)) as never,
    p_items: JSON.parse(JSON.stringify(items)) as never,
  })
}

function invalidating<A>(fn: (a: A) => Promise<void>, done: string) {
  return function useIt() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: fn,
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['checkpoints'] })
        toast.success(done)
      },
      onError: (e: Error) => { toast.error(e.message) },
    })
  }
}

export interface NewCondition {
  kind: ConditionKind
  negated: boolean
  user_id?: string | null
  group_id?: string | null
  include_member_groups?: boolean
  marking_id?: string | null
  project_id?: string | null
  space_id?: string | null
}

export const useCreateConfig = invalidating<{
  organizationId: string | null
  spaceId: string | null
  name: string
  description: string
  title: string
  prompt: string
  checkpointDescription: string
  justificationType: JustificationType
  justificationConfig: CheckpointConfig['justification_config']
  checkpointTypes: string[]
  conditions: NewCondition[]
}>(async (a) => {
  const { data, error } = await supabase.from('checkpoint_configurations').insert({
    organization_id: a.organizationId, space_id: a.spaceId,
    name: a.name, description: a.description,
    title: a.title, prompt: a.prompt, checkpoint_description: a.checkpointDescription,
    justification_type: a.justificationType, justification_config: a.justificationConfig,
    checkpoint_types: a.checkpointTypes,
  }).select('id').single()
  if (error) throw new Error(error.message)
  if (a.conditions.length > 0) {
    const { error: e2 } = await supabase.from('checkpoint_conditions')
      .insert(a.conditions.map((c) => ({ config_id: (data as { id: string }).id, ...c })))
    if (e2) throw new Error(e2.message)
  }
}, 'Checkpoint configuration created')

export const useDeleteConfig = invalidating<{ id: string }>(async (a) => {
  const { error } = await supabase.from('checkpoint_configurations').delete().eq('id', a.id)
  if (error) throw new Error(error.message)
}, 'Configuration deleted — existing records keep their snapshot')

/** Picker data for the condition rows, one round trip per kind. */
export function useConditionCatalog() {
  return useQuery({
    queryKey: ['checkpoints', 'catalog'],
    queryFn: async () => {
      const [us, gs, mk, pr, sp] = await Promise.all([
        supabase.from('users').select('id, email').order('email'),
        supabase.from('groups').select('id, name').order('name'),
        supabase.from('markings').select('id, name').order('name'),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('spaces').select('id, name').order('name'),
      ])
      for (const r of [us, gs, mk, pr, sp]) if (r.error) throw new Error(r.error.message)
      return {
        users: us.data as { id: string; email: string }[],
        groups: gs.data as { id: string; name: string }[],
        markings: mk.data as { id: string; name: string }[],
        projects: pr.data as { id: string; name: string }[],
        spaces: sp.data as { id: string; name: string }[],
      }
    },
  })
}

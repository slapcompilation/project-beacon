// The Ontology cleanup queue's data (578/579).
//
// The tool "is a safe way to delete object types", and it asks a different
// question from `ontology_violations()`: not whether an object type is
// malformed but whether it is probably dead. Foundry keeps them as two nav
// sections with two counts, and so do we.
//
// Everything here is per-user. "Snoozing is an action that will affect only the
// user that performs it", and so is the flag configuration — which is why a
// configuration row is created lazily for whoever opens the page.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { cleanupFlags, cleanupEffectiveFlags, runCleanup } from '@beacon/platform'
import { setObjectTypeStatus, deleteObjectType } from '@/features/objectTypes/api'

/** A published flag: its priority, whether it ships on, what it parameterises,
 *  and — for the two that cannot be computed — why. */
export interface CleanupFlag {
  flag: string
  priority: string
  default_on: boolean
  parameter: string | null
  computable: boolean
  note: string
}

/** The same flag after this user's configuration is applied. */
export interface EffectiveFlag {
  flag: string
  enabled: boolean
  priority: string
  days: number | null
  regex: string | null
  computable: boolean
}

/** The user's configuration row for one ontology. */
export interface CleanupConfig {
  id: string
  mode: string
  computed_at: string | null
}

export interface Candidate {
  object_type_id: string
  api_name: string
  label: string
  flags: string[]
  priority: string
  reads: number | null
}

export const FLAG_LABEL: Record<string, string> = {
  no_registered_usage: 'No registered usage in 30d',
  past_deprecation_date: 'Past deprecation date',
  trashed_datasource: 'Trashed datasource',
  phonograph_deindexed: 'Phonograph deindexed',
  datasource_not_updated: 'Datasource not updated in 90d',
  description_missing: 'Description missing',
  display_name_regex: 'Display Name regex matches',
}

export function useCleanupFlags() {
  return useQuery({
    queryKey: ['cleanup-flags'],
    queryFn: async () => await client(cleanupFlags).executeFunction({}) as unknown as CleanupFlag[],
    staleTime: Infinity,   // a published vocabulary, not data
  })
}

/** The user's configuration for this ontology, created on first visit —
 *  Foundry has one implicitly the moment you open the page. */
export function useCleanupConfig(ontologyId: string | null) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['cleanup-config', ontologyId],
    enabled: Boolean(ontologyId),
    queryFn: async (): Promise<CleanupConfig | null> => {
      const { data: me } = await supabase.auth.getUser()
      const userId = me.user?.id
      if (!userId || !ontologyId) return null
      const existing = await supabase.from('cleanup_configurations')
        .select('id, mode, computed_at')
        .eq('ontology_id', ontologyId).eq('user_id', userId)
        .maybeSingle<CleanupConfig>()
      if (existing.data) return existing.data
      const created = await supabase.from('cleanup_configurations')
        .insert({ ontology_id: ontologyId, user_id: userId })
        .select('id, mode, computed_at').single<CleanupConfig>()
      if (created.error) throw created.error
      void qc.invalidateQueries({ queryKey: ['cleanup-config', ontologyId] })
      return created.data
    },
  })
}

export function useEffectiveFlags(configId: string | null) {
  return useQuery({
    queryKey: ['cleanup-effective-flags', configId],
    enabled: Boolean(configId),
    queryFn: async () =>
      await client(cleanupEffectiveFlags)
        .executeFunction({ p_config: configId ?? '' }) as unknown as EffectiveFlag[],
  })
}

/** The stored queue. Foundry prompts to recalculate rather than recomputing, so
 *  this reads what was stored and never triggers a run of its own. */
export function useCandidates(configId: string | null) {
  return useQuery({
    queryKey: ['cleanup-candidates', configId],
    enabled: Boolean(configId),
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase
        .from('cleanup_candidates')
        .select('object_type_id, flags, priority, reads, object_types(api_name, label)')
        .eq('configuration_id', configId ?? '')
      if (error) throw error
      type Row = {
        object_type_id: string; flags: string[]; priority: string; reads: number | null
        object_types: { api_name: string; label: string } | null
      }
      return (data as unknown as Row[]).map((r) => ({
        object_type_id: r.object_type_id,
        api_name: r.object_types?.api_name ?? '',
        label: r.object_types?.label ?? r.object_types?.api_name ?? '',
        flags: r.flags,
        priority: r.priority,
        reads: r.reads,
      }))
    },
  })
}

/** "When you opt to Start cleanup, the tool may take time to find cleanup
 *  candidates based on the size of your Ontology." */
export function useRunCleanup(configId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => await client(runCleanup).applyAction({ p_config: configId ?? '' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cleanup-candidates', configId] })
      void qc.invalidateQueries({ queryKey: ['cleanup-config'] })
      toast.success('Cleanup queue recalculated')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "Hide object types from your cleanup queue for a configurable amount of
 *  time." Per-user, and the queue drops it on the next run. */
export function useSnooze(configId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ objectTypeIds, days }: { objectTypeIds: string[]; days: number }) => {
      const { data: me } = await supabase.auth.getUser()
      const userId = me.user?.id
      if (!userId) throw new Error('not signed in')
      const until = new Date(Date.now() + days * 86_400_000).toISOString()
      const { error } = await supabase.from('cleanup_snoozes').upsert(
        objectTypeIds.map((id) => ({ user_id: userId, object_type_id: id, until })),
        { onConflict: 'user_id,object_type_id' })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cleanup-candidates', configId] })
      toast.success('Snoozed — it leaves your queue on the next recalculation')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Mode and per-flag overrides. Saving either "will reset previous Cleanup
 *  results" — the trigger does that; this only invalidates the cache. */
/** "Snooze: Hide object types from your cleanup queue for a configurable amount
 *  of time." Hidden, not deleted — so there has to be somewhere to see what is
 *  hidden and when it comes back, or a snooze is indistinguishable from a type
 *  that stopped being a candidate. */
export interface Snoozed {
  object_type_id: string
  label: string
  until: string
}

export function useSnoozed(ontologyId: string | null) {
  return useQuery({
    queryKey: ['cleanup-snoozed', ontologyId],
    enabled: Boolean(ontologyId),
    queryFn: async (): Promise<Snoozed[]> => {
      const { data: me } = await supabase.auth.getUser()
      const userId = me.user?.id
      if (!userId) return []
      const { data, error } = await supabase.from('cleanup_snoozes')
        .select('object_type_id, until, object_types!inner(label, api_name, ontology_id)')
        .eq('user_id', userId)
        .eq('object_types.ontology_id', ontologyId ?? '')
        .gt('until', new Date().toISOString())
        .order('until')
      if (error) throw error
      return (data as unknown as {
        object_type_id: string; until: string
        object_types: { label: string; api_name: string } | null
      }[]).map((r) => ({
        object_type_id: r.object_type_id,
        label: r.object_types?.label ?? r.object_types?.api_name ?? '',
        until: r.until,
      }))
    },
  })
}

/** Snoozing "will affect only the user that performs it", and so does undoing it. */
export function useUnsnooze(ontologyId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (objectTypeId: string) => {
      const { data: me } = await supabase.auth.getUser()
      const userId = me.user?.id
      if (!userId) throw new Error('not signed in')
      const { error } = await supabase.from('cleanup_snoozes').delete()
        .eq('user_id', userId).eq('object_type_id', objectTypeId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cleanup-snoozed', ontologyId] })
      toast.success('Un-snoozed — it returns to the queue on the next recalculation')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "Deprecation and deletion are staged the same way as normal Ontology
 *  modifications", so these go through the same calls the object type page uses
 *  and land in the save session rather than writing straight through.
 *
 *  The database refuses a deprecation with no reason and no deadline, which is
 *  why the toolbar asks for both rather than deprecating on one click. */
export function useDeprecateCandidates(configId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { ids: string[]; reason: string; deadline: string }) => {
      for (const id of i.ids) {
        await setObjectTypeStatus({
          id, status: 'deprecated', visibility: 'normal',
          deprecation: { reason: i.reason, deadline: i.deadline, replacedBy: null },
        })
      }
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['cleanup-candidates', configId] })
      void qc.invalidateQueries({ queryKey: ['object-types'] })
      toast.success(`Staged ${v.ids.length} deprecation${v.ids.length === 1 ? '' : 's'}`)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The trash icon beside them. The database refuses to delete anything active,
 *  so this reports that refusal rather than hiding it. */
export function useDeleteCandidates(configId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await deleteObjectType(id) },
    onSuccess: (_d, ids) => {
      void qc.invalidateQueries({ queryKey: ['cleanup-candidates', configId] })
      void qc.invalidateQueries({ queryKey: ['object-types'] })
      toast.success(`Deleted ${ids.length} object type${ids.length === 1 ? '' : 's'}`)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSaveFlagSettings(configId: string | null, ontologyId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ mode, overrides }: {
      mode: 'default' | 'custom'
      overrides: { flag: string; enabled: boolean; priority?: string; days?: number; regex?: string }[]
    }) => {
      if (!configId) throw new Error('no configuration')
      const { error: modeErr } = await supabase.from('cleanup_configurations')
        .update({ mode }).eq('id', configId)
      if (modeErr) throw modeErr
      const { error: clearErr } = await supabase.from('cleanup_flag_overrides')
        .delete().eq('configuration_id', configId)
      if (clearErr) throw clearErr
      if (mode === 'custom' && overrides.length > 0) {
        const { error } = await supabase.from('cleanup_flag_overrides').insert(
          overrides.map((o) => ({
            configuration_id: configId, flag: o.flag, enabled: o.enabled,
            priority: o.priority ?? null, param_days: o.days ?? null,
            param_regex: o.regex ?? null,
          })))
        if (error) throw error
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cleanup-effective-flags', configId] })
      void qc.invalidateQueries({ queryKey: ['cleanup-candidates', configId] })
      void qc.invalidateQueries({ queryKey: ['cleanup-config', ontologyId] })
      toast.success('Flag settings saved — the queue was reset')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

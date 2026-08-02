// Adoption across properties. W5 of docs/WORKSHOP-PLAN.md — the point of the arc.
//
// An installation pins a version rather than mirroring the source, so a property
// does not change under its staff overnight. Forking trades upgrades for local
// ownership, and the two states are structurally different rather than a flag.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface AdoptionRow {
  hotelId:          string
  hotelName:        string
  installed:        boolean
  installedVersion: number | null
  sourceVersion:    number
  forked:           boolean
  isAuthor:         boolean
}

export function useModuleAdoption(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['module-adoption', moduleId],
    enabled: !!moduleId,
    queryFn: async (): Promise<AdoptionRow[]> => {
      const result = await supabase.rpc('get_module_adoption', { p_module_id: moduleId }) as unknown as {
        data: Array<{
          hotel_id: string; hotel_name: string; installed: boolean
          installed_version: number | null; source_version: number
          forked: boolean; is_author: boolean
        }> | null
        error: { message: string } | null
      }
      if (result.error) throw new Error(result.error.message)
      return (result.data ?? []).map((r) => ({
        hotelId: r.hotel_id, hotelName: r.hotel_name, installed: r.installed,
        installedVersion: r.installed_version, sourceVersion: r.source_version,
        forked: r.forked, isAuthor: r.is_author,
      }))
    },
  })
}

function useAdoptionMutation<T>(fn: (arg: T) => Promise<void>, moduleId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['module-adoption', moduleId] })
      void qc.invalidateQueries({ queryKey: ['promoted-apps'] })
    },
  })
}

/** Adopt at a property, or move its pin to the source's current version —
 *  Foundry's "new versions available for upgrade". Same call either way. */
export function useInstallModule(moduleId: string | undefined) {
  return useAdoptionMutation<{ hotelId: string; version: number }>(async ({ hotelId, version }) => {
    if (!moduleId) return
    const { error } = await supabase.from('module_installations').upsert({
      module_id: moduleId, hotel_id: hotelId, installed_version: version,
    }, { onConflict: 'module_id,hotel_id' })
    if (error) throw new Error(error.message)
  }, moduleId)
}

export function useUninstallModule(moduleId: string | undefined) {
  return useAdoptionMutation<string>(async (hotelId) => {
    if (!moduleId) return
    const { error } = await supabase.from('module_installations')
      .delete().eq('module_id', moduleId).eq('hotel_id', hotelId)
    if (error) throw new Error(error.message)
  }, moduleId)
}

/** Take local ownership. The property stops receiving upgrades — that is the
 *  trade, and it is why this is a separate act rather than an edit. */
export function useForkInstallation(moduleId: string | undefined) {
  return useAdoptionMutation<string>(async (hotelId) => {
    if (!moduleId) return
    const { data, error } = await supabase.from('module_installations')
      .select('id').eq('module_id', moduleId).eq('hotel_id', hotelId).single<{ id: string }>()
    if (error) throw new Error(error.message)
    const forked = await supabase.rpc('fork_installed_module', { p_installation_id: data.id }) as unknown as {
      error: { message: string } | null
    }
    if (forked.error) throw new Error(forked.error.message)
  }, moduleId)
}

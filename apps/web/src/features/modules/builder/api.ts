// Builder writes. Plain table writes under the admin policies that already
// exist — a module is data, so authoring one needs no new write path.
//
// Every mutation invalidates the module document, because the canvas renders
// from get_module and a builder whose preview lags its own edit is worse than
// no preview.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { ModuleDoc } from '../api'

type Table = 'module_variables' | 'module_layouts' | 'module_widgets' | 'module_events'

function useModuleWrite<TArgs, TResult = void>(
  apiName: string, fn: (a: TArgs) => Promise<TResult>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['module', apiName] })
      void qc.invalidateQueries({ queryKey: ['module-variable'] })
    },
  })
}

/** Returns the new id so the builder can select what it just added — adding a
 *  widget and then hunting for it in the tree is a step nobody wants. */
export function useCreateRow(apiName: string) {
  return useModuleWrite<{ table: Table; row: Record<string, unknown> }, string>(
    apiName, async ({ table, row }) => {
      const { data, error } = await supabase.from(table).insert(row)
        .select('id').single<{ id: string }>()
      if (error) throw new Error(error.message)
      return data.id
    })
}

export function useUpdateRow(apiName: string) {
  return useModuleWrite<{ table: Table; id: string; patch: Record<string, unknown> }>(
    apiName, async ({ table, id, patch }) => {
      const { error } = await supabase.from(table).update(patch).eq('id', id)
      if (error) throw new Error(error.message)
    })
}

export function useDeleteRow(apiName: string) {
  return useModuleWrite<{ table: Table; id: string }>(apiName, async ({ table, id }) => {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw new Error(error.message)
  })
}

/** Publishing is a version bump. W4's promotions and W5's installations pin a
 *  version, so this is the act that makes both of them say "vN available". */
export function usePublishModule(apiName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (mod: ModuleDoc) => {
      const { error } = await supabase.from('modules')
        .update({ version: mod.version + 1, status: 'published' }).eq('id', mod.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['module', apiName] })
      void qc.invalidateQueries({ queryKey: ['promoted-apps'] })
      void qc.invalidateQueries({ queryKey: ['module-adoption'] })
    },
  })
}

export function useUpdateModule(apiName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from('modules').update(patch).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['module', apiName] }) },
  })
}

export interface NewModuleInput {
  apiName: string; title: string; description: string; icon: string
  hotelId: string | null
}

export function useCreateModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: NewModuleInput) => {
      const { data, error } = await supabase.from('modules').insert({
        api_name: i.apiName, title: i.title, description: i.description,
        icon: i.icon, hotel_id: i.hotelId, status: 'draft',
      }).select('api_name').single<{ api_name: string }>()
      if (error) throw new Error(error.message)
      return data.api_name
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['modules'] }) },
  })
}

/** api_name is DB-constrained to ^[a-z][a-zA-Z0-9_]*$, so derive rather than
 *  make the author satisfy a regex they cannot see. */
export function slugify(title: string): string {
  const s = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(s) ? s : `m_${s}`
}

/** Next free position among siblings — appending is the default everywhere. */
export function nextPosition(items: ReadonlyArray<{ position: number }>): number {
  return items.reduce((max, i) => Math.max(max, i.position), -1) + 1
}

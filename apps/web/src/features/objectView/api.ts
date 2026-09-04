// The Object View (718): the standard view is computed and stored nowhere;
// a row in object_views is a configured view and the detach moment. Reads
// here are plain table reads under the composed RLS — a view has no ACL of
// its own.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { evaluateObjectSet, listLinkedObjects, countLinkedObjects, type Json } from '@beacon/platform'

export interface ObjectView {
  id: string
  objectTypeId: string
  version: number
}

export interface ObjectViewTab {
  id: string
  tabId: string
  title: string
  position: number
  kind: 'managed_workshop' | 'standalone_workshop'
  moduleId: string
}

const keys = {
  view: (typeId: string) => ['object-view', typeId] as const,
  tabs: (viewId: string) => ['object-view-tabs', viewId] as const,
  record: (typeId: string, pk: string) => ['object-record', typeId, pk] as const,
  history: (typeId: string, pk: string) => ['object-history', typeId, pk] as const,
}

/** NULL means the standard view — the landing until a configured view exists. */
export function useObjectViewFor(typeId: string | null) {
  return useQuery({
    queryKey: keys.view(typeId ?? ''),
    enabled: typeId !== null,
    queryFn: async (): Promise<ObjectView | null> => {
      const { data, error } = await supabase.from('object_views')
        .select('id, object_type_id, version').eq('object_type_id', typeId ?? '').maybeSingle()
      if (error) throw new Error(error.message)
      if (data === null) return null
      const r = data as { id: string; object_type_id: string; version: number }
      return { id: r.id, objectTypeId: r.object_type_id, version: r.version }
    },
  })
}

export function useObjectViewTabs(viewId: string | null) {
  return useQuery({
    queryKey: keys.tabs(viewId ?? ''),
    enabled: viewId !== null,
    queryFn: async (): Promise<ObjectViewTab[]> => {
      const { data, error } = await supabase.from('object_view_tabs')
        .select('id, tab_id, title, position, kind, module_id')
        .eq('view_id', viewId ?? '').order('position')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; tab_id: string; title: string; position: number
        kind: ObjectViewTab['kind']; module_id: string
      }[]).map((r) => ({
        id: r.id, tabId: r.tab_id, title: r.title, position: r.position,
        kind: r.kind, moduleId: r.module_id,
      }))
    },
  })
}

/** One object's merged row, read through the same engine the Explorer uses —
 *  an exact-match filter on the primary key property. Applied, not executed:
 *  since 746 a named read records itself in the usage ledger. */
export function useObjectRecord(typeId: string | null, pkPropertyId: string | null, pk: string | null) {
  return useQuery({
    queryKey: keys.record(typeId ?? '', pk ?? ''),
    enabled: typeId !== null && pkPropertyId !== null && pk !== null,
    queryFn: async (): Promise<Record<string, unknown> | null> => {
      const rows = await client(evaluateObjectSet).applyAction({
        p_object_type: typeId as string,
        p_filters: [{ type: 'propertyFilter', propertyType: pkPropertyId,
          value: { type: 'valuesFilter', values: [pk] } }] as unknown as Json,
        p_limit: 1, p_offset: 0,
        p_application: 'object-views',
      })
      return (rows as Record<string, unknown>[]).at(0) ?? null
    },
  })
}

/** THIS object's linked rows through one link type — whole far objects, a
 *  page at a time. The api's shape: no totalCount rides along, so the badge
 *  is the companion count below. Applied, not executed: a named read records
 *  itself against the FAR type (752). */
export function useLinkedObjects(typeId: string | null, pk: string | null, link: string, limit: number) {
  return useQuery({
    queryKey: ['linked-objects', typeId, pk, link, limit],
    enabled: typeId !== null && pk !== null,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<Record<string, unknown>[]> => {
      const rows = await client(listLinkedObjects).applyAction({
        p_object_type: typeId as string, p_primary_key: pk as string, p_link: link,
        p_limit: limit, p_offset: 0, p_application: 'object-views',
      })
      return rows as Record<string, unknown>[]
    },
  })
}

export function useLinkedCount(typeId: string | null, pk: string | null, link: string) {
  return useQuery({
    queryKey: ['linked-count', typeId, pk, link],
    enabled: typeId !== null && pk !== null,
    queryFn: (): Promise<number> => client(countLinkedObjects).executeFunction({
      p_object_type: typeId as string, p_primary_key: pk as string, p_link: link,
    }),
  })
}

export interface ObjectEditRow {
  id: string
  instruction: string
  appliedAt: string
  actionTypeId: string | null
}

/** The per-object Edit History — action-stamped edits only, which is all the
 *  log holds by construction (only-edits-via-actions). */
export function useObjectHistory(typeId: string | null, pk: string | null) {
  return useQuery({
    queryKey: keys.history(typeId ?? '', pk ?? ''),
    enabled: typeId !== null && pk !== null,
    queryFn: async (): Promise<ObjectEditRow[]> => {
      const { data, error } = await supabase.from('object_edits')
        .select('id, instruction, applied_at, action_type_id')
        .eq('object_type_id', typeId ?? '').eq('primary_key', pk ?? '')
        .order('seq', { ascending: false }).limit(50)
      if (error) throw new Error(error.message)
      return (data as {
        id: string; instruction: string; applied_at: string; action_type_id: string | null
      }[]).map((r) => ({
        id: r.id, instruction: r.instruction, appliedAt: r.applied_at, actionTypeId: r.action_type_id,
      }))
    },
  })
}

/** Authoring: the first write IS the detach — the type renders its standard
 *  view until this row exists. */
export function useCreateObjectView(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.from('object_views')
        .insert({ object_type_id: typeId }).select('id').single()
      if (error) throw new Error(error.message)
      return (data as { id: string }).id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.view(typeId) })
      toast.success('Configured view created — it is now the default; the standard view stays one toggle away')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tab'

export function useAddObjectViewTab(viewId: string, typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      title: string
      kind: ObjectViewTab['kind']
      /** standalone: an existing module. managed: created here, owned by the view. */
      moduleId?: string
      organizationId?: string | null
      projectId?: string | null
    }) => {
      let moduleId = i.moduleId
      if (i.kind === 'managed_workshop') {
        const { data, error } = await supabase.from('workshop_modules')
          .insert({ organization_id: i.organizationId, project_id: i.projectId,
            name: i.title, header_visible: false }).select('id').single()
        if (error) throw new Error(error.message)
        moduleId = (data as { id: string }).id
      }
      if (!moduleId) throw new Error('Pick the Workshop module this tab shows.')
      const { count } = await supabase.from('object_view_tabs')
        .select('id', { count: 'exact', head: true }).eq('view_id', viewId)
      const { error } = await supabase.from('object_view_tabs').insert({
        view_id: viewId, tab_id: slugify(i.title), title: i.title,
        position: count ?? 0, kind: i.kind, module_id: moduleId,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.tabs(viewId) })
      void qc.invalidateQueries({ queryKey: keys.view(typeId) })
      toast.success('Tab added')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRemoveObjectViewTab(viewId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tabRowId: string) => {
      const { error } = await supabase.from('object_view_tabs').delete().eq('id', tabRowId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.tabs(viewId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

// Slate — applications, pages, identifiers, widgets, variables, events
// (688/689).
//
// Every named thing shares one namespace, so identifiers are read as one
// list and the widgets/variables that carry them join against it: "Shared
// variable names must be unique across all pages, widgets, events, queries,
// and functions" (slate/concepts-variables).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { createSlateApp, slateWidgetKinds, slateIdentifierPrefixes } from '@beacon/platform'

export type ContainerType = 'basic' | 'flex' | 'repeating' | 'split' | 'tabbed'
export type IdentifierKind = 'widget' | 'query' | 'variable' | 'function'

export interface SlateApp {
  id: string
  rid: string
  projectId: string
  name: string
  kind: 'integrated' | 'public'
  stylesheet: string
}

export interface SlatePage {
  id: string
  name: string
  position: number
}

export interface SlateIdentifier {
  id: string
  kind: IdentifierKind
  name: string
  pageId: string | null
}

export interface SlateWidget {
  id: string
  pageId: string
  identifierId: string
  parentId: string | null
  kind: string
  position: number
  containerType: ContainerType | null
  splitAxis: 'horizontally' | 'vertically' | null
  styles: string
  additionalClasses: string
  config: Record<string, unknown>
}

export interface SlateVariable {
  id: string
  identifierId: string
  valueType: string
  defaultValue: unknown
}

export interface SlateEvent {
  id: string
  eventIdentifierId: string
  eventName: string
  actionIdentifierId: string
  actionName: string
  body: string
  position: number
}

const keys = {
  apps: ['slate-apps'] as const,
  app: (id: string) => ['slate-app', id] as const,
}

export function useSlateApps() {
  return useQuery({
    queryKey: keys.apps,
    staleTime: 30_000,
    queryFn: async (): Promise<SlateApp[]> => {
      const { data, error } = await supabase.from('slate_apps')
        .select('id, rid, project_id, name, kind, stylesheet')
        .is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; rid: string; project_id: string; name: string
        kind: 'integrated' | 'public'; stylesheet: string
      }[]).map((r) => ({
        id: r.id, rid: r.rid, projectId: r.project_id, name: r.name,
        kind: r.kind, stylesheet: r.stylesheet,
      }))
    },
  })
}

export interface SlateContents {
  pages: SlatePage[]
  identifiers: SlateIdentifier[]
  widgets: SlateWidget[]
  variables: SlateVariable[]
  events: SlateEvent[]
}

export function useSlateContents(appId: string | null) {
  return useQuery({
    queryKey: keys.app(appId ?? ''),
    enabled: appId !== null,
    queryFn: async (): Promise<SlateContents> => {
      const id = appId ?? ''
      const [pg, ids, wid, vr, ev] = await Promise.all([
        supabase.from('slate_pages').select('id, name, position')
          .eq('app_id', id).order('position'),
        supabase.from('slate_identifiers').select('id, kind, name, page_id')
          .eq('app_id', id).order('name'),
        supabase.from('slate_widgets')
          .select('id, page_id, identifier_id, parent_id, kind, position, container_type, split_axis, styles, additional_classes, config')
          .eq('app_id', id).order('position'),
        supabase.from('slate_variables')
          .select('id, identifier_id, value_type, default_value').eq('app_id', id),
        supabase.from('slate_events')
          .select('id, event_identifier_id, event_name, action_identifier_id, action_name, body, position')
          .eq('app_id', id).order('position'),
      ])
      for (const r of [pg, ids, wid, vr, ev]) {
        if (r.error) throw new Error(r.error.message)
      }
      return {
        pages: pg.data as SlatePage[],
        identifiers: (ids.data as {
          id: string; kind: IdentifierKind; name: string; page_id: string | null
        }[]).map((r) => ({ id: r.id, kind: r.kind, name: r.name, pageId: r.page_id })),
        widgets: (wid.data as {
          id: string; page_id: string; identifier_id: string; parent_id: string | null
          kind: string; position: number; container_type: ContainerType | null
          split_axis: 'horizontally' | 'vertically' | null; styles: string
          additional_classes: string; config: Record<string, unknown>
        }[]).map((r) => ({
          id: r.id, pageId: r.page_id, identifierId: r.identifier_id,
          parentId: r.parent_id, kind: r.kind, position: r.position,
          containerType: r.container_type, splitAxis: r.split_axis,
          styles: r.styles, additionalClasses: r.additional_classes, config: r.config,
        })),
        variables: (vr.data as {
          id: string; identifier_id: string; value_type: string; default_value: unknown
        }[]).map((r) => ({
          id: r.id, identifierId: r.identifier_id, valueType: r.value_type,
          defaultValue: r.default_value,
        })),
        events: (ev.data as {
          id: string; event_identifier_id: string; event_name: string
          action_identifier_id: string; action_name: string; body: string; position: number
        }[]).map((r) => ({
          id: r.id, eventIdentifierId: r.event_identifier_id, eventName: r.event_name,
          actionIdentifierId: r.action_identifier_id, actionName: r.action_name,
          body: r.body, position: r.position,
        })),
      }
    },
  })
}

export function useSlateWidgetKinds() {
  return useQuery({
    queryKey: ['slate-widget-kinds'],
    staleTime: Infinity,
    queryFn: () => client(slateWidgetKinds).executeFunction({}),
  })
}

export function useIdentifierPrefixes() {
  return useQuery({
    queryKey: ['slate-identifier-prefixes'],
    staleTime: Infinity,
    queryFn: () => client(slateIdentifierPrefixes).executeFunction({}),
  })
}

export function useCreateSlateApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string }) =>
      client(createSlateApp).applyAction({ p_project: i.projectId, p_name: i.name }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.apps }); toast.success('Application created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

function useAppMutation<T>(appId: string, fn: (i: T) => Promise<void>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.app(appId) })
      void qc.invalidateQueries({ queryKey: keys.apps })
      if (done !== undefined) toast.success(done)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Adding a widget is two rows: the name it claims in the application's one
 *  namespace, then the widget itself. The database refuses a bad prefix or
 *  a taken name, so the surface does not re-check either. */
export function useAddSlateWidget(appId: string) {
  return useAppMutation<{
    pageId: string; parentId: string | null; kind: string; name: string
    containerType?: ContainerType; position: number
  }>(appId, async (i) => {
    const { data, error } = await supabase.from('slate_identifiers')
      .insert({ app_id: appId, kind: 'widget', name: i.name })
      .select('id').single<{ id: string }>()
    if (error) throw new Error(error.message)
    const { error: e2 } = await supabase.from('slate_widgets').insert({
      app_id: appId, page_id: i.pageId, identifier_id: data.id,
      parent_id: i.parentId, kind: i.kind, position: i.position,
      container_type: i.containerType ?? (i.kind === 'container' ? 'basic' : null),
    })
    if (e2) {
      await supabase.from('slate_identifiers').delete().eq('id', data.id)
      throw new Error(e2.message)
    }
  })
}

export function useUpdateSlateWidget(appId: string) {
  return useAppMutation<{ id: string } & Partial<{
    container_type: ContainerType | null; split_axis: string | null
    styles: string; additional_classes: string; config: Record<string, unknown>
    x: number | null; y: number | null; width: number | null; height: number | null
  }>>(appId, async ({ id, ...rest }) => {
    const { error } = await supabase.from('slate_widgets').update(rest).eq('id', id)
    if (error) throw new Error(error.message)
  }, 'Widget updated')
}

export function useRemoveSlateWidget(appId: string) {
  return useAppMutation<{ id: string; identifierId: string }>(appId, async (i) => {
    const { error } = await supabase.from('slate_widgets').delete().eq('id', i.id)
    if (error) throw new Error(error.message)
    await supabase.from('slate_identifiers').delete().eq('id', i.identifierId)
  })
}

export function useAddSlatePage(appId: string) {
  return useAppMutation<{ name: string; position: number }>(appId, async (i) => {
    const { error } = await supabase.from('slate_pages')
      .insert({ app_id: appId, name: i.name, position: i.position })
    if (error) throw new Error(error.message)
  }, 'Page added')
}

export function useAddSlateVariable(appId: string) {
  return useAppMutation<{
    name: string; valueType: string; pageId: string | null; defaultValue: unknown
  }>(appId, async (i) => {
    const { data, error } = await supabase.from('slate_identifiers')
      .insert({ app_id: appId, kind: 'variable', name: i.name, page_id: i.pageId })
      .select('id').single<{ id: string }>()
    if (error) throw new Error(error.message)
    const { error: e2 } = await supabase.from('slate_variables').insert({
      app_id: appId, identifier_id: data.id, value_type: i.valueType,
      default_value: i.defaultValue,
    })
    if (e2) {
      await supabase.from('slate_identifiers').delete().eq('id', data.id)
      throw new Error(e2.message)
    }
  }, 'Variable added')
}

export function useSetStylesheet(appId: string) {
  return useAppMutation<string>(appId, async (css) => {
    const { error } = await supabase.from('slate_apps')
      .update({ stylesheet: css }).eq('id', appId)
    if (error) throw new Error(error.message)
  }, 'Stylesheet saved')
}

export function useAddSlateEvent(appId: string) {
  return useAppMutation<{
    eventIdentifierId: string; eventName: string
    actionIdentifierId: string; actionName: string; body: string; position: number
  }>(appId, async (i) => {
    const { error } = await supabase.from('slate_events').insert({
      app_id: appId, event_identifier_id: i.eventIdentifierId, event_name: i.eventName,
      action_identifier_id: i.actionIdentifierId, action_name: i.actionName,
      body: i.body, position: i.position,
    })
    if (error) throw new Error(error.message)
  }, 'Event wired')
}

export function useRemoveSlateEvent(appId: string) {
  return useAppMutation<string>(appId, async (id) => {
    const { error } = await supabase.from('slate_events').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })
}

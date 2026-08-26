// Workshop — modules, layout, widgets, variables, events (685/686).
//
// "Workshop enables application builders to create interactive and
// high-quality applications for operational users" (workshop/overview),
// and every module is a resource in a project: Viewer opens, Editor edits.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  createWorkshopModule, workshopWidgetKinds, workshopEventKinds, objectSetRows,
} from '@beacon/platform'

export type SectionLayout = 'columns' | 'rows' | 'tabs' | 'flow' | 'toolbar' | 'loop'
export type SizeMode = 'auto' | 'absolute' | 'flex'

export interface WorkshopModule {
  id: string
  rid: string
  projectId: string
  folderId: string | null
  name: string
  headerVisible: boolean
  headerTitle: string | null
  headerIcon: string | null
  headerIconColor: string | null
}

export interface WorkshopPage {
  id: string
  name: string
  isDefault: boolean
  position: number
}

export interface WorkshopSection {
  id: string
  pageId: string | null
  overlayId: string | null
  parentId: string | null
  layout: SectionLayout
  position: number
  showHeader: boolean
  title: string | null
  icon: string | null
  collapsible: boolean
  collapsed: boolean
  widthMode: SizeMode
  widthValue: number | null
}

export interface WorkshopWidget {
  id: string
  sectionId: string | null
  inHeader: boolean
  kind: string
  name: string
  position: number
  sizeMode: SizeMode
  sizeValue: number | null
  config: Record<string, unknown>
}

export interface WorkshopVariable {
  id: string
  name: string
  valueType: string
  definitionType: string
  recompute: string
  definition: Record<string, unknown>
  position: number
}

export interface WorkshopOverlay {
  id: string
  name: string
  kind: 'drawer' | 'modal'
  side: 'left' | 'right' | null
  size: number | null
  showHeader: boolean
  title: string | null
  icon: string | null
}

export interface WorkshopEvent {
  id: string
  widgetId: string
  kind: string
  position: number
  pageId: string | null
  sectionId: string | null
  overlayId: string | null
  variableId: string | null
  sourceVariableId: string | null
}

const keys = {
  modules: ['workshop-modules'] as const,
  module: (id: string) => ['workshop-module', id] as const,
}

export function useWorkshopModules() {
  return useQuery({
    queryKey: keys.modules,
    staleTime: 30_000,
    queryFn: async (): Promise<WorkshopModule[]> => {
      const { data, error } = await supabase.from('workshop_modules')
        .select('id, rid, project_id, folder_id, name, header_visible, header_title, header_icon, header_icon_color')
        .is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; rid: string; project_id: string; folder_id: string | null; name: string
        header_visible: boolean; header_title: string | null; header_icon: string | null
        header_icon_color: string | null
      }[]).map((r) => ({
        id: r.id, rid: r.rid, projectId: r.project_id, folderId: r.folder_id, name: r.name,
        headerVisible: r.header_visible, headerTitle: r.header_title,
        headerIcon: r.header_icon, headerIconColor: r.header_icon_color,
      }))
    },
  })
}

/** The whole module in one read — the editor and the viewer both need the
 *  entire tree, and a module is small by construction. */
export interface ModuleContents {
  pages: WorkshopPage[]
  sections: WorkshopSection[]
  widgets: WorkshopWidget[]
  variables: WorkshopVariable[]
  overlays: WorkshopOverlay[]
  events: WorkshopEvent[]
}

export function useModuleContents(moduleId: string | null) {
  return useQuery({
    queryKey: keys.module(moduleId ?? ''),
    enabled: moduleId !== null,
    queryFn: async (): Promise<ModuleContents> => {
      const id = moduleId ?? ''
      const [pg, sec, wid, vr, ov] = await Promise.all([
        supabase.from('workshop_pages').select('id, name, is_default, position')
          .eq('module_id', id).order('position'),
        supabase.from('workshop_sections')
          .select('id, page_id, overlay_id, parent_id, layout, position, show_header, title, icon, collapsible, collapsed, width_mode, width_value')
          .eq('module_id', id).order('position'),
        supabase.from('workshop_widgets')
          .select('id, section_id, in_header, kind, name, position, size_mode, size_value, config')
          .eq('module_id', id).order('position'),
        supabase.from('workshop_variables')
          .select('id, name, value_type, definition_type, recompute, definition, position')
          .eq('module_id', id).order('position'),
        supabase.from('workshop_overlays')
          .select('id, name, kind, side, size, show_header, title, icon').eq('module_id', id),
      ])
      for (const r of [pg, sec, wid, vr, ov]) {
        if (r.error) throw new Error(r.error.message)
      }
      const widgets = (wid.data as {
        id: string; section_id: string | null; in_header: boolean; kind: string; name: string
        position: number; size_mode: SizeMode; size_value: number | null
        config: Record<string, unknown>
      }[]).map((r) => ({
        id: r.id, sectionId: r.section_id, inHeader: r.in_header, kind: r.kind, name: r.name,
        position: r.position, sizeMode: r.size_mode, sizeValue: r.size_value, config: r.config,
      }))
      let events: WorkshopEvent[] = []
      if (widgets.length > 0) {
        const { data: ev, error } = await supabase.from('workshop_events')
          .select('id, widget_id, kind, position, page_id, section_id, overlay_id, variable_id, source_variable_id')
          .in('widget_id', widgets.map((w) => w.id)).order('position')
        if (error) throw new Error(error.message)
        events = (ev as {
          id: string; widget_id: string; kind: string; position: number
          page_id: string | null; section_id: string | null; overlay_id: string | null
          variable_id: string | null; source_variable_id: string | null
        }[]).map((r) => ({
          id: r.id, widgetId: r.widget_id, kind: r.kind, position: r.position,
          pageId: r.page_id, sectionId: r.section_id, overlayId: r.overlay_id,
          variableId: r.variable_id, sourceVariableId: r.source_variable_id,
        }))
      }
      return {
        pages: (pg.data as { id: string; name: string; is_default: boolean; position: number }[])
          .map((r) => ({ id: r.id, name: r.name, isDefault: r.is_default, position: r.position })),
        sections: (sec.data as {
          id: string; page_id: string | null; overlay_id: string | null; parent_id: string | null
          layout: SectionLayout; position: number; show_header: boolean; title: string | null
          icon: string | null; collapsible: boolean; collapsed: boolean
          width_mode: SizeMode; width_value: number | null
        }[]).map((r) => ({
          id: r.id, pageId: r.page_id, overlayId: r.overlay_id, parentId: r.parent_id,
          layout: r.layout, position: r.position, showHeader: r.show_header, title: r.title,
          icon: r.icon, collapsible: r.collapsible, collapsed: r.collapsed,
          widthMode: r.width_mode, widthValue: r.width_value,
        })),
        widgets,
        variables: (vr.data as {
          id: string; name: string; value_type: string; definition_type: string
          recompute: string; definition: Record<string, unknown>; position: number
        }[]).map((r) => ({
          id: r.id, name: r.name, valueType: r.value_type, definitionType: r.definition_type,
          recompute: r.recompute, definition: r.definition, position: r.position,
        })),
        overlays: (ov.data as {
          id: string; name: string; kind: 'drawer' | 'modal'; side: 'left' | 'right' | null
          size: number | null; show_header: boolean; title: string | null; icon: string | null
        }[]).map((r) => ({
          id: r.id, name: r.name, kind: r.kind, side: r.side, size: r.size,
          showHeader: r.show_header, title: r.title, icon: r.icon,
        })),
        events,
      }
    },
  })
}

/** The catalogue: six built, the rest recorded against the page that would
 *  build them. Asked of the database so a kind cannot exist there and be
 *  missing here. */
export function useWidgetKinds() {
  return useQuery({
    queryKey: ['workshop-widget-kinds'],
    staleTime: Infinity,
    queryFn: () => client(workshopWidgetKinds).executeFunction({}),
  })
}

export function useEventKinds() {
  return useQuery({
    queryKey: ['workshop-event-kinds'],
    staleTime: Infinity,
    queryFn: () => client(workshopEventKinds).executeFunction({}),
  })
}

export function useCreateModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string; folderId?: string }) =>
      client(createWorkshopModule).applyAction({
        p_project: i.projectId, p_name: i.name,
        ...(i.folderId ? { p_folder: i.folderId } : {}),
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.modules }); toast.success('Module created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useUpdateModule(moduleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: Partial<{
      name: string; header_visible: boolean; header_title: string | null
      header_icon: string | null; header_icon_color: string | null
    }>) => {
      const { error } = await supabase.from('workshop_modules').update(i).eq('id', moduleId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.modules }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Sections, widgets, variables and events all hang off one module, so one
 *  invalidation refreshes the tree however it changed. */
function useModuleMutation<T>(moduleId: string, fn: (i: T) => Promise<void>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.module(moduleId) })
      if (done !== undefined) toast.success(done)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useAddWidget(moduleId: string) {
  return useModuleMutation<{ sectionId: string; kind: string; name: string; position: number }>(
    moduleId, async (i) => {
      const { error } = await supabase.from('workshop_widgets').insert({
        module_id: moduleId, section_id: i.sectionId, kind: i.kind,
        name: i.name, position: i.position,
      })
      if (error) throw new Error(error.message)
    })
}

export function useSetWidgetConfig(moduleId: string) {
  return useModuleMutation<{ id: string; config: Record<string, unknown> }>(
    moduleId, async (i) => {
      const { error } = await supabase.from('workshop_widgets')
        .update({ config: i.config }).eq('id', i.id)
      if (error) throw new Error(error.message)
    }, 'Widget saved')
}

export function useRemoveWidget(moduleId: string) {
  return useModuleMutation<string>(moduleId, async (id) => {
    const { error } = await supabase.from('workshop_widgets').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })
}

export function useSetSection(moduleId: string) {
  return useModuleMutation<{ id: string } & Partial<{
    layout: SectionLayout; show_header: boolean; title: string | null
    icon: string | null; collapsible: boolean; collapsed: boolean
    width_mode: SizeMode; width_value: number | null
  }>>(moduleId, async ({ id, ...rest }) => {
    const { error } = await supabase.from('workshop_sections').update(rest).eq('id', id)
    if (error) throw new Error(error.message)
  })
}

export function useSplitSection(moduleId: string) {
  return useModuleMutation<{ parentId: string; layout: SectionLayout }>(
    moduleId, async (i) => {
      const { error } = await supabase.from('workshop_sections').insert([
        { module_id: moduleId, parent_id: i.parentId, layout: 'rows', position: 0 },
        { module_id: moduleId, parent_id: i.parentId, layout: 'rows', position: 1 },
      ])
      if (error) throw new Error(error.message)
      const { error: e2 } = await supabase.from('workshop_sections')
        .update({ layout: i.layout }).eq('id', i.parentId)
      if (e2) throw new Error(e2.message)
    })
}

export function useAddPage(moduleId: string) {
  return useModuleMutation<{ name: string; position: number }>(
    moduleId, async (i) => {
      const { error } = await supabase.from('workshop_pages')
        .insert({ module_id: moduleId, name: i.name, position: i.position })
        .select('id').single<{ id: string }>()
      if (error) throw new Error(error.message)
    }, 'Page added')
}

export function useAddVariable(moduleId: string) {
  return useModuleMutation<{
    name: string; valueType: string; definitionType: string
    definition: Record<string, unknown>
  }>(moduleId, async (i) => {
    const { error } = await supabase.from('workshop_variables').insert({
      module_id: moduleId, name: i.name, value_type: i.valueType,
      definition_type: i.definitionType, definition: i.definition,
    })
    if (error) throw new Error(error.message)
  }, 'Variable added')
}

export function useRemoveVariable(moduleId: string) {
  return useModuleMutation<string>(moduleId, async (id) => {
    const { error } = await supabase.from('workshop_variables').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })
}

/** Rows for an object-set-backed widget. The set is named by the widget's
 *  bound object set variable; the engine is 475's. */
export function useObjectSetRows(objectSetId: string | null, limit = 200) {
  return useQuery({
    queryKey: ['workshop-set-rows', objectSetId, limit],
    enabled: objectSetId !== null,
    queryFn: () => client(objectSetRows).executeFunction({
      p_set: objectSetId ?? '', p_limit: limit, p_offset: 0 }),
  })
}

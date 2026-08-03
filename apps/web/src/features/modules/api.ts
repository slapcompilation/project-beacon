// Workshop modules — an application assembled from rows rather than written as
// a React file. W1 of docs/WORKSHOP-PLAN.md.
//
// The whole module arrives in ONE call (get_module) because a renderer that
// makes four requests to draw one screen is a renderer that flickers.

import { supabase } from '@/lib/supabase/client'
import { rowToObjectSet, type ObjectSetRow } from '@/features/objectSets/api'
import {
  fetchBuiltinRecords, fetchObjectRecordsForTypes, rowToObjectType, type ObjectTypeRow,
} from '@/features/objectTypes/api'
import { buildAuthoredAgentTools, selectObjectSet } from '@beacon/reality-graph'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'

/** Foundry names twelve variable types; W1 sources six. */
export type ModuleVariableType =
  | 'object_set' | 'object_set_filter' | 'string' | 'numeric' | 'boolean' | 'date'

export type ModuleDefinitionKind =
  | 'static' | 'object_set_definition' | 'function'
  | 'object_set_aggregation' | 'object_property' | 'variable_transformation'

/** Five of Foundry's ~forty, demand-gated individually.
 *
 *  `tabs` was here and is gone (migration 313): Foundry's Tabs is a layout
 *  option on a section, not a widget you place, so the container draws its own
 *  bar and the widget had nothing left to do. */
export type ModuleWidgetType =
  | 'object_table' | 'metric_card' | 'markdown' | 'object_set_title' | 'button_group'
  | 'embedded_module' | 'tabs'

export interface ModuleVariable {
  id:             string
  apiName:        string
  label:          string
  varType:        ModuleVariableType
  definitionKind: ModuleDefinitionKind
  definition:     Record<string, unknown>
  /** automatic | event | on_load_and_event — Foundry's recompute contract. */
  recompute:      'automatic' | 'event' | 'on_load_and_event'
  /** True when a parent module may map onto this one. Everything else is the
   *  module's own private state. */
  isInterface:    boolean
}

export interface ModuleLayout {
  id: string; apiName: string; title: string
  /** `row` arranges children horizontally; `loop` renders an embedded module
   *  per entry of a set; everything else stacks. */
  layoutType: 'page' | 'section' | 'tab' | 'overlay' | 'row' | 'column' | 'loop'
  parentId: string | null; position: number
  /** Loop settings live here — layouts carry no other configuration yet. */
  config: Record<string, unknown>
}

export interface ModuleWidget {
  id: string; apiName: string; widgetType: ModuleWidgetType
  title: string; layoutId: string | null; variableId: string | null
  config: Record<string, unknown>; position: number
}

/** One EFFECT. A trigger with three effects is three rows sharing a source
 *  widget and trigger, ordered by `position` — dispatch order, not completion
 *  order. See applyEffects in runtime.ts. */
export interface ModuleEvent {
  id: string
  sourceWidgetId: string | null
  trigger: 'click' | 'row_select' | 'selection_change' | 'tab_change' | 'on_load'
  effectType:
    | 'open_overlay' | 'close_overlay'
    | 'switch_page' | 'switch_tab' | 'toggle_section'
    | 'set_variable' | 'reset_variable' | 'recompute_variable' | 'stream_llm_into_variable'
    | 'open_module' | 'open_object_view'
    | 'refresh_module' | 'toggle_theme'
  config: Record<string, unknown>
  position: number
}

export interface ModuleDoc {
  id: string; apiName: string; title: string; description: string; icon: string
  status: 'draft' | 'published' | 'archived'
  version: number
  hotelId: string | null
  variables: ModuleVariable[]
  layouts:   ModuleLayout[]
  widgets:   ModuleWidget[]
  events:    ModuleEvent[]
}

export async function fetchModule(apiName: string): Promise<ModuleDoc | null> {
  const result = await supabase.rpc('get_module', { p_api_name: apiName }) as unknown as {
    data: ModuleDoc | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function fetchModules(): Promise<Pick<ModuleDoc,
  'id' | 'apiName' | 'title' | 'description' | 'icon' | 'status' | 'version' | 'hotelId'>[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('id, api_name, title, description, icon, status, version, hotel_id')
    .order('title')
  if (error) throw new Error(error.message)
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string, apiName: r.api_name as string, title: r.title as string,
    description: r.description as string, icon: r.icon as string,
    status: r.status as ModuleDoc['status'], version: r.version as number,
    hotelId: r.hotel_id as string | null,
  }))
}

/** A `function`-defined variable: a Logic Tool call, with its arguments bound by
 *  the same grammar action parameters use.
 *
 *  The tool registry is built with a browser reader, so the SAME implementation
 *  the agents and the cycle call answers here — a module cannot compute a number
 *  a different way than the rest of the system does. */
export async function resolveFunctionVariable(
  variable: ModuleVariable, args: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const name = variable.definition.toolName
  if (typeof name !== 'string') return null
  const tool = buildAuthoredAgentTools(makeSupabaseGraphReader()).get(name)
  if (!tool) throw new Error(`Workshop:UnknownTool ${name}`)
  const out = await tool.invoke(args)
  return out as Record<string, unknown>
}

/** Records behind an `object_set` variable.
 *
 *  Resolved through the SAME path cohorts use — object_sets row → its subject
 *  type → that type's records → selectObjectSet. One implementation, so a
 *  module and a cohort cannot disagree about what a set contains. */
export async function resolveObjectSetVariable(
  variable: ModuleVariable,
): Promise<Record<string, unknown>[]> {
  const setId = variable.definition.objectSetId
  if (variable.varType !== 'object_set' || typeof setId !== 'string') return []

  const { data: setRows, error } = await supabase.from('object_sets').select('*').eq('id', setId)
  if (error) throw new Error(error.message)
  const set = (setRows as ObjectSetRow[] | null)?.[0]
  if (!set || set.subject_type_id === null) return []

  const { data: typeRows, error: typeErr } = await supabase
    .from('object_types').select('*').eq('id', set.subject_type_id)
  if (typeErr) throw new Error(typeErr.message)
  const typeRow = (typeRows as ObjectTypeRow[] | null)?.[0]
  if (!typeRow) return []

  const type = rowToObjectType(typeRow)
  const records = type.kind === 'builtin'
    ? (await fetchBuiltinRecords(type)).rows
    : await fetchObjectRecordsForTypes([type.id])

  return selectObjectSet(rowToObjectSet(set), [{ type, records: records.map((r) => r.data) }])
    .records as Record<string, unknown>[]
}

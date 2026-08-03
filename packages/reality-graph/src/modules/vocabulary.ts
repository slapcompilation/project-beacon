// The Workshop module vocabulary — one definition, used by everything.
//
// This existed twice: once in apps/web as the renderer's types, once in
// authoring/moduleSpec.ts as the grammar the generator is held to. They drifted
// within days. By the time it was noticed the generator knew 5 of 8 widget
// types, 6 of 7 layouts and 3 of 4 definition kinds — so an operator asking for
// tabs got a worse answer, and a CORRECT spec naming `filter_list` would have
// been refused as unknown.
//
// Worse than the omissions: the grammar still said a metric card may show an
// object set, which the renderer stopped accepting in #478. The validator would
// pass a spec the runtime then refuses on screen — the two disagreeing about
// what a valid module is.
//
// So the vocabulary lives here, in the package both sides already depend on.
// The database CHECK constraints remain the authority; this is the one place
// TypeScript states them, and `pnpm check:vocabulary` is what keeps the two
// honest about values nothing consumes.

export const MODULE_WIDGET_TYPES = [
  'object_table', 'metric_card', 'markdown', 'object_set_title', 'button_group',
  'embedded_module', 'tabs', 'filter_list',
] as const
export type ModuleWidgetType = typeof MODULE_WIDGET_TYPES[number]

export const MODULE_VARIABLE_TYPES = [
  'object_set', 'object_set_filter', 'string', 'numeric', 'boolean', 'date',
] as const
export type ModuleVariableType = typeof MODULE_VARIABLE_TYPES[number]

/** All six of Foundry's, since W1 — the two that are not implemented are
 *  declared here and refused by the authoring validator, so the gap is visible
 *  rather than silent. */
export const MODULE_DEFINITION_KINDS = [
  'static', 'object_set_definition', 'function', 'object_set_aggregation',
  'object_property', 'variable_transformation',
] as const
export type ModuleDefinitionKind = typeof MODULE_DEFINITION_KINDS[number]

/** The kinds a variable can actually be given today. */
export const IMPLEMENTED_DEFINITION_KINDS = [
  'static', 'object_set_definition', 'function', 'object_set_aggregation',
] as const

export const MODULE_LAYOUT_TYPES = [
  'page', 'section', 'tab', 'overlay', 'row', 'column', 'loop',
] as const
export type ModuleLayoutType = typeof MODULE_LAYOUT_TYPES[number]

export const MODULE_TRIGGERS = ['click', 'row_select', 'selection_change', 'tab_change', 'on_load'] as const
export type ModuleTrigger = typeof MODULE_TRIGGERS[number]

/** Effects the runtime performs. The full CHECK carries Foundry's thirteen;
 *  these are the ones that do something, and the authoring validator refuses the
 *  rest rather than letting a generator wire a no-op. */
export const IMPLEMENTED_EFFECTS = [
  'set_variable', 'reset_variable', 'recompute_variable',
  'switch_tab', 'switch_page', 'toggle_section',
  'open_overlay', 'close_overlay', 'refresh_module',
] as const

/** What each widget needs bound, mirroring module_widgets_needs_binding and the
 *  renderer's own rules. Kept beside the types because the last time these lived
 *  apart they disagreed. */
export const WIDGET_BINDING: Record<ModuleWidgetType, {
  /** Must name a variable. */
  needsVariable: boolean
  /** Variable types it accepts; omitted means any. */
  accepts?: ReadonlyArray<ModuleVariableType>
}> = {
  object_table:     { needsVariable: true,  accepts: ['object_set'] },
  object_set_title: { needsVariable: true,  accepts: ['object_set'] },
  filter_list:      { needsVariable: true,  accepts: ['object_set'] },
  // Foundry: "the value used to populate the metric must be backed by a Workshop
  // variable of the corresponding type". A set is not a value — aggregating
  // belongs to an object_set_aggregation variable (#478).
  metric_card:      { needsVariable: true,  accepts: ['string', 'numeric', 'boolean', 'date'] },
  markdown:         { needsVariable: false },
  button_group:     { needsVariable: false },
  embedded_module:  { needsVariable: false },
  tabs:             { needsVariable: false },
}

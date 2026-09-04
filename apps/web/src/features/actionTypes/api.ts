// Action types: read whole, staged whole, applied one at a time.
//
// "an action type, which has three components: The Rules (what it does) … The
// Form (what the user sees) … submission criteria" — so the row is never useful
// alone, and the read embeds its children the way the session carries them.
//
// Staging goes through save_action_type, which is why nothing here writes a
// table: the header's Save control is what lands the action in the ontology.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAppStore } from '@/stores/app.store'
import { useComposeBranch } from '@/features/branching/api'
import { toast } from 'sonner'
import type { ObjectTypeStatus, PropertyType } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { saveActionType, applyAction, revertAction, actionRuleKinds, actionFormEffective, type Json } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import { useReindex } from '@/features/objectTypes/indexing'

/** Where a rule property's value comes from. `object_parameter_property` is in
 *  the CHECK too and is OMITTED BY NAME — it reads a property off an object
 *  parameter, and the builder only offers primitive ones. */
export const VALUE_SOURCES = ['parameter', 'static', 'current_user', 'current_time'] as const
export type ValueSource = typeof VALUE_SOURCES[number]

export interface ActionParameterRow {
  id: string
  api_name: string
  display_name: string
  description: string
  /** Which payload the parameter carries. Only `object` can receive Automate's
   *  Single object effect input (630) — there is no set-shaped kind. */
  data_kind: 'base_type' | 'object' | 'interfaceObject' | 'objectType'
  base_type: PropertyType | null
  object_type_id: string | null
  required: boolean
  exposed: boolean
  editable: boolean
  position: number
}

export interface ActionRulePropertyRow {
  id: string
  property_id: string
  value_source: ValueSource | 'object_parameter_property'
  parameter_id: string | null
  static_value: Json
}

export interface ActionRuleRow {
  id: string
  kind: string
  position: number
  object_type_id: string | null
  link_type_id: string | null
  function_name: string | null
  function_version_id: string | null
  auto_upgrade: boolean
  source_parameter_id: string | null
  target_parameter_id: string | null
  action_type_rule_properties: ActionRulePropertyRow[]
}

export interface ActionTypeRow {
  id: string
  ontology_id: string
  api_name: string
  label: string
  description: string
  status: ObjectTypeStatus
  created_at: string
  /** The Frontend consumers switch (612). False keeps the action out of the
   *  automation wizard's picker, and the runner refuses it too. */
  automate_can_submit: boolean
  action_type_rules: ActionRuleRow[]
  action_type_parameters: ActionParameterRow[]
}

const KEY = ['action-types'] as const

export function useActionTypes(ontologyId: string | null) {
  const q = useQuery({
    queryKey: [...KEY, ontologyId],
    enabled: ontologyId !== null,
    staleTime: 30_000,
    queryFn: async (): Promise<ActionTypeRow[]> => {
      const { data, error } = await supabase.from('action_types')
        .select('*, action_type_rules(*, action_type_rule_properties(*)), action_type_parameters(*)')
        .eq('ontology_id', ontologyId as string)
        .order('created_at')
      if (error) throw new Error(error.message)
      return data as ActionTypeRow[]
    },
  })
  // On a branch the list shows the branch's version (461's overlay).
  const compose = useComposeBranch<ActionTypeRow>('action_type', {
    action_type_rules: [], action_type_parameters: [], status: 'experimental',
  })
  const data = useMemo(() => compose(q.data ?? []), [q.data, compose])
  return { ...q, data }
}

/** The rule vocabulary, with the note the picker shows. Asked of the database so
 *  a kind cannot exist there and be missing here. */
export function useRuleKinds() {
  return useQuery({
    queryKey: ['action-rule-kinds'],
    staleTime: Infinity,
    queryFn: () => client(actionRuleKinds).executeFunction({}),
  })
}

export interface ActionDraft {
  id?: string
  apiName: string
  label: string
  description: string
  ontologyId: string
  parameters: {
    api_name: string; display_name: string
    /** A value parameter names a base type; an object reference names a type
     *  instead (418's either-or, landed since 755). */
    base_type: PropertyType | null
    data_kind?: 'base_type' | 'object'
    object_type_id?: string | null
    required: boolean; exposed: boolean; editable: boolean; position: number
  }[]
  rules: {
    kind: string; position: number; object_type_id: string | null
    /** Set instead of `object_type_id` on the three interface object rules. */
    interface_id?: string | null
    /** The Run function card's four: which function, the pinned version, the
     *  caret, and the input-to-parameter mapping (538/668). */
    function_name?: string | null
    function_version_id?: string | null
    auto_upgrade?: boolean
    inputs?: { input_name: string; parameter_api_name: string }[]
    /** A link rule's three (755): the many-to-many link and its two sides,
     *  each an object reference parameter. */
    link_type_id?: string | null
    source_parameter_api_name?: string | null
    target_parameter_api_name?: string | null
    properties: {
      /** A rule names an object type's property, or an interface's — never both.
       *  An interface property resolves onto a different property per
       *  implementing type, which is the whole reason 570 split the column. */
      property_id?: string | null
      interface_property_id?: string | null
      value_source: ValueSource
      parameter_api_name: string | null; static_value: string | null
    }[]
  }[]
}

export function useSaveActionType() {
  const qc = useQueryClient()
  return useMutation({
    // The draft carries no criteria: they are edited on the action type itself
    // (CriteriaEditor), not staged with its rules and parameters.
    mutationFn: (d: ActionDraft) => client(saveActionType).applyAction({
      p_action: {
        id: d.id ?? null, api_name: d.apiName, label: d.label, description: d.description,
        ontology_id: d.ontologyId, parameters: d.parameters, rules: d.rules,
        project_id: d.id ? null : useAppStore.getState().omaProjectId,
      } as unknown as Json,
      p_branch: useAppStore.getState().omaBranchId ?? undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success('Staged — save to add it to the ontology')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export interface ApplyInput {
  actionTypeId: string
  parameters: Record<string, string>
  primaryKey?: string
  /** The object types the rules touch — their indexes are stale the moment the
   *  edit lands, so the count only moves once they rebuild. */
  objectTypeIds: string[]
}

/** "The toast below is your only opportunity to revert the action" — so the
 *  toast has to know which submission it is offering to undo. apply_action
 *  returns an edit count, and the application is read back from the log's
 *  own table (682); a second concurrent apply of the same action by the same
 *  user would name the wrong one, recorded rather than papered over. */
async function myLastApplication(actionTypeId: string): Promise<string | null> {
  const { data: me } = await supabase.auth.getUser()
  const uid = me.user?.id
  if (uid === undefined) return null
  const { data } = await supabase.from('action_applications')
    .select('id, revertible')
    .eq('action_type_id', actionTypeId).eq('applied_by_user_id', uid)
    .is('reverted_at', null)
    .order('applied_at', { ascending: false }).limit(1)
  const row = (data as { id: string; revertible: boolean }[] | null)?.at(0)
  return row?.revertible === true ? row.id : null
}

export function useApplyAction() {
  const reindex = useReindex()
  const revert = useRevertAction()
  return useMutation({
    mutationFn: (i: ApplyInput) => client(applyAction).applyAction({
      p_action_type: i.actionTypeId,
      p_parameters: i.parameters,
      ...(i.primaryKey ? { p_primary_key: i.primaryKey } : {}),
    }),
    onSuccess: (_n, i) => {
      for (const id of new Set(i.objectTypeIds)) reindex.mutate(id)
      void myLastApplication(i.actionTypeId).then((application) => {
        // The drawn button says Revert where the prose says Undo.
        toast.success('Edits successfully applied.', application === null ? undefined : {
          action: {
            label: 'Revert',
            onClick: () => { revert.mutate({ application, objectTypeIds: i.objectTypeIds }) },
          },
        })
      })
    },
    // Actions:MissingParameter, Actions:ModifyNeedsTarget, Actions:EditsDisabled…
    // the name is the useful half; re-deriving the rule here is how they drift.
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRevertAction() {
  const reindex = useReindex()
  return useMutation({
    mutationFn: (i: { application: string; objectTypeIds: string[] }) =>
      client(revertAction).applyAction({ p_application: i.application }),
    onSuccess: (_n, i) => {
      toast.success('Edits successfully reverted')
      for (const id of new Set(i.objectTypeIds)) reindex.mutate(id)
    },
    // Actions:ObjectEditedSince, Actions:NotTheApplier, Actions:NotRevertible…
    onError: (e: Error) => { toast.error(e.message) },
  })
}

// ── The form's effective configuration (666) ─────────────────────────────────

export interface EffectiveDefault {
  source: 'static' | 'object_property'
  value?: unknown
  parameter?: string
  property?: string
}

export interface EffectiveParameter {
  visible: boolean
  disabled: boolean
  required: boolean
  default: EffectiveDefault | null
  type_classes: string[]
  section: string | null
}

export interface EffectiveSection {
  visible: boolean
  title: string
  description: string
  columns: 1 | 2
  show_title_bar: boolean
  collapsible: boolean
}

export interface EffectiveForm {
  parameters: Record<string, EffectiveParameter | undefined>
  sections: Record<string, EffectiveSection | undefined>
}

/** The one place first-true-wins lives — the server resolves overrides, the
 *  form only renders. Re-resolved as values change, because conditions read
 *  them ("A section can be hidden at first and only shown based on a prior
 *  parameter"). */
export function useActionFormEffective(actionId: string | null, values: Record<string, string>) {
  return useQuery({
    queryKey: ['action-form-effective', actionId, values],
    enabled: actionId !== null,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<EffectiveForm> =>
      await client(actionFormEffective).executeFunction({
        p_action: actionId as string, p_parameters: values,
      }) as unknown as EffectiveForm,
  })
}

/** Section order — the resolver carries the grammar, this carries the list. */
export function useFormSections(actionId: string | null) {
  return useQuery({
    queryKey: ['action-form-sections', actionId],
    enabled: actionId !== null,
    queryFn: async (): Promise<{ api_name: string; position: number }[]> => {
      const { data, error } = await supabase.from('action_type_form_sections')
        .select('api_name, position').eq('action_type_id', actionId ?? '').order('position')
      if (error) throw new Error(error.message)
      return data as { api_name: string; position: number }[]
    },
  })
}

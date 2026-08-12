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
import { saveActionType, applyAction, actionRuleKinds, type Json } from '@beacon/platform'
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
    api_name: string; display_name: string; base_type: PropertyType
    required: boolean; exposed: boolean; editable: boolean; position: number
  }[]
  rules: {
    kind: string; position: number; object_type_id: string | null
    properties: {
      property_id: string; value_source: ValueSource
      parameter_api_name: string | null; static_value: string | null
    }[]
  }[]
}

export function useSaveActionType() {
  const qc = useQueryClient()
  return useMutation({
    // Criteria are OMITTED BY NAME: 421 stores the tree, but nothing evaluates
    // it yet, so an editor here would author a gate that never fires.
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

export function useApplyAction() {
  const reindex = useReindex()
  return useMutation({
    mutationFn: (i: ApplyInput) => client(applyAction).applyAction({
      p_action_type: i.actionTypeId,
      p_parameters: i.parameters,
      ...(i.primaryKey ? { p_primary_key: i.primaryKey } : {}),
    }),
    onSuccess: (n, i) => {
      toast.success(`${String(n)} edit${n === 1 ? '' : 's'} written`)
      for (const id of new Set(i.objectTypeIds)) reindex.mutate(id)
    },
    // Actions:MissingParameter, Actions:ModifyNeedsTarget, Actions:EditsDisabled…
    // the name is the useful half; re-deriving the rule here is how they drift.
    onError: (e: Error) => { toast.error(e.message) },
  })
}

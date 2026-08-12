// The Actions sub-tab's data: an interface's action constraints, the
// implementing type's satisfactions, and the atomic satisfy call.
// "A concrete action type satisfies a constraint when it has compatible
// parameters for the constraint's required parameters."

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { satisfyActionConstraint, type Json } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'

export interface ParameterConstraintRow {
  id: string
  api_name: string
  display_name: string
  base_type: string
  is_list: boolean
  required: boolean
}

export interface ActionConstraintFullRow {
  id: string
  interface_id: string
  api_name: string
  display_name: string
  description: string
  required: boolean
  interface_action_parameter_constraints: ParameterConstraintRow[]
}

/** Constraints of the given interfaces — callers pass own + inherited ids,
 *  because "action type constraints are inherited through interface
 *  extensions". */
export function useActionConstraints(interfaceIds: string[]) {
  return useQuery({
    queryKey: ['action-constraints', ...interfaceIds].sort(),
    enabled: interfaceIds.length > 0,
    queryFn: async (): Promise<ActionConstraintFullRow[]> => {
      const { data, error } = await supabase.from('interface_action_constraints')
        .select('id, interface_id, api_name, display_name, description, required, interface_action_parameter_constraints(id, api_name, display_name, base_type, is_list, required)')
        .in('interface_id', interfaceIds).order('api_name')
      if (error) throw new Error(error.message)
      return data as unknown as ActionConstraintFullRow[]
    },
  })
}

export interface SatisfactionRow {
  interface_id: string
  constraint_id: string
  action_type_id: string
  interface_action_parameter_mappings: {
    parameter_constraint_id: string
    action_parameter_id: string
  }[]
}

export function useSatisfactions(objectTypeId: string) {
  return useQuery({
    queryKey: ['action-satisfactions', objectTypeId],
    queryFn: async (): Promise<SatisfactionRow[]> => {
      const { data, error } = await supabase.from('interface_action_satisfactions')
        .select('interface_id, constraint_id, action_type_id, interface_action_parameter_mappings(parameter_constraint_id, action_parameter_id)')
        .eq('object_type_id', objectTypeId)
      if (error) throw new Error(error.message)
      return data as unknown as SatisfactionRow[]
    },
  })
}

/** One call — the satisfaction and its Configure-parameters mappings land
 *  together, so the commit-time completeness judges the whole. */
export function useSatisfy(objectTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: {
      interfaceId: string; constraintId: string; actionTypeId: string
      mappings: { parameter_constraint_id: string; action_parameter_id: string }[]
    }) => client(satisfyActionConstraint).applyAction({
      p_object_type: objectTypeId, p_interface: i.interfaceId,
      p_constraint: i.constraintId, p_action_type: i.actionTypeId,
      p_mappings: i.mappings as unknown as Json,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['action-satisfactions', objectTypeId] })
      toast.success('Constraint satisfied')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Skipping an optional constraint again — required ones refuse at commit,
 *  which is the completeness rule doing its job. */
export function useUnsatisfy(objectTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { interfaceId: string; constraintId: string }) => {
      const { error } = await supabase.from('interface_action_satisfactions').delete()
        .eq('object_type_id', objectTypeId)
        .eq('interface_id', i.interfaceId)
        .eq('constraint_id', i.constraintId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['action-satisfactions', objectTypeId] }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

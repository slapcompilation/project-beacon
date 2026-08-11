// Value types — a reusable semantic declaration, owned by a space.
// Creation lives here, in its own application; the binding dropdown lives in
// Ontology Manager. "Two applications, two surfaces." (readings/value-types §7)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { mintValueTypeVersion, valueConforms, type Json } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import type { PropertyType } from '@beacon/ontology'

const key = (spaceId: string) => ['value-types', spaceId]

export type ConstraintKind = 'enum' | 'range' | 'regex' | 'rid' | 'uuid'

export interface ConstraintDraft {
  kind: ConstraintKind
  params: Record<string, unknown>
}

export interface ValueTypeRow {
  id: string
  apiName: string
  displayName: string
  description: string
  baseType: PropertyType
  exampleValue: unknown
  failureMessage: string
  currentVersion: number
  /** The current version's constraint — "a constraint", singular. */
  constraint: { kind: string; params: Record<string, unknown> } | null
}

export function useSpaces() {
  return useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: async (): Promise<{ id: string; name: string; path: string }[]> => {
      const { data, error } = await supabase.from('spaces').select('id, name, path').order('name')
      if (error) throw new Error(error.message)
      return data as { id: string; name: string; path: string }[]
    },
    staleTime: 60_000,
  })
}

export function useValueTypes(spaceId: string | null) {
  return useQuery({
    queryKey: key(spaceId ?? ''),
    enabled: spaceId !== null,
    queryFn: async (): Promise<ValueTypeRow[]> => {
      const { data, error } = await supabase.from('value_types')
        .select('id, api_name, display_name, description, base_type, example_value, failure_message, current_version, value_type_constraints(version, kind, params)')
        .eq('space_id', spaceId ?? '').order('display_name')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; api_name: string; display_name: string; description: string
        base_type: PropertyType; example_value: unknown; failure_message: string
        current_version: number
        value_type_constraints: { version: number; kind: string; params: Record<string, unknown> }[]
      }[]).map((r) => ({
        id: r.id, apiName: r.api_name, displayName: r.display_name, description: r.description,
        baseType: r.base_type, exampleValue: r.example_value, failureMessage: r.failure_message,
        currentVersion: r.current_version,
        constraint: r.value_type_constraints.find((c) => c.version === r.current_version) ?? null,
      }))
    },
  })
}

/** One atomic commit at the end of the wizard — "Create value type". The
 *  constraint lands as version 1 directly; minting is for later edits. */
export function useCreateValueType(spaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      displayName: string; apiName: string; description: string
      baseType: PropertyType; failureMessage: string; exampleValue: string
      constraint: ConstraintDraft | null
    }) => {
      const { data, error } = await supabase.from('value_types').insert({
        space_id: spaceId, api_name: i.apiName, display_name: i.displayName,
        description: i.description, base_type: i.baseType,
        failure_message: i.failureMessage || 'Constraint failed',
        example_value: i.exampleValue ? parseValue(i.exampleValue) : null,
      }).select('id').single()
      if (error) throw new Error(error.message)
      if (i.constraint) {
        const { error: e2 } = await supabase.from('value_type_constraints').insert({
          value_type_id: (data as { id: string }).id, version: 1,
          kind: i.constraint.kind, params: i.constraint.params,
        })
        if (e2) throw new Error(e2.message)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(spaceId) })
      toast.success('Value type created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "The metadata values for name, description, and apiName can be changed
 *  whenever necessary." Base type is refused by the database. */
export function useUpdateValueTypeMetadata(spaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id: string; displayName: string; description: string; failureMessage: string }) => {
      const { error } = await supabase.from('value_types').update({
        display_name: i.displayName, description: i.description, failure_message: i.failureMessage,
      }).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key(spaceId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "If you choose to update the constraints… a new version… is created." */
export function useMintVersion(spaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { id: string; constraint: ConstraintDraft | null }) =>
      client(mintValueTypeVersion).applyAction({
        p_value_type: i.id,
        p_constraints: (i.constraint ? [i.constraint] : []) as unknown as Json,
      }),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: key(spaceId) })
      toast.success(`Version ${String(v)} minted`)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Bare words are strings; anything that parses as JSON is passed as parsed. */
export function parseValue(raw: string): Json {
  try { return JSON.parse(raw) as Json } catch { return raw }
}

/** The Preview panel's live check — the stored validator, not a re-statement. */
export async function checkValue(valueTypeId: string, raw: string): Promise<boolean> {
  return client(valueConforms).executeFunction({ p_value: parseValue(raw), p_value_type: valueTypeId })
}

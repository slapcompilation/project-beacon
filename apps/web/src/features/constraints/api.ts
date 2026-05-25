// constraints table — CRUD + a helper that lifts a row into the typed
// ConstraintRecord the evaluator consumes.

import { supabase } from '@/lib/supabase/client'
import type { ConstraintRecord, ConstraintTypedRule } from '@beacon/reality-graph'

export interface ConstraintRow {
  id: string
  hotel_id: string
  organization_id: string | null
  body: string
  bucket: 'scope' | 'threshold' | 'time-window' | 'actor-role'
  typed_rule: ConstraintTypedRule
  severity: 'hard' | 'soft'
  applies_to_action_types: string[]
  active: boolean
  authored_by_user_id: string
  created_at: string
  deactivated_at: string | null
}

export async function fetchActiveConstraints(hotelId: string): Promise<ConstraintRow[]> {
  const { data, error } = await supabase
    .from('constraints')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ConstraintRow[]
}

export async function fetchAllConstraints(hotelId: string): Promise<ConstraintRow[]> {
  const { data, error } = await supabase
    .from('constraints')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ConstraintRow[]
}

export interface CreateConstraintInput {
  hotelId: string
  body: string
  bucket: ConstraintTypedRule['bucket']
  typedRule: ConstraintTypedRule
  severity?: 'hard' | 'soft'
  appliesToActionTypes?: string[]
  authoredByUserId: string
}

export async function createConstraint(input: CreateConstraintInput): Promise<ConstraintRow> {
  const { data, error } = await supabase
    .from('constraints')
    .insert({
      hotel_id:                input.hotelId,
      body:                    input.body,
      bucket:                  input.bucket,
      typed_rule:              input.typedRule,
      severity:                input.severity ?? 'hard',
      applies_to_action_types: input.appliesToActionTypes ?? [],
      authored_by_user_id:     input.authoredByUserId,
    })
    .select('*')
    .single<ConstraintRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchConstraint(id: string): Promise<ConstraintRow | null> {
  const { data, error } = await supabase
    .from('constraints')
    .select('*')
    .eq('id', id)
    .maybeSingle<ConstraintRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function setConstraintActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('constraints')
    .update({
      active,
      deactivated_at: active ? null : new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Lifts a persisted row into the typed shape the evaluator consumes. */
export function rowToConstraintRecord(row: ConstraintRow): ConstraintRecord {
  return {
    id: row.id,
    body: row.body,
    bucket: row.bucket,
    typedRule: row.typed_rule,
    severity: row.severity,
    appliesToActionTypes: row.applies_to_action_types,
    active: row.active,
  }
}

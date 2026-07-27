// Authored agents — CRUD over user_agents. The definition is data; compiling and
// running it is reality-graph's job (compileAgent / runAuthoredAgent).

import { supabase } from '@/lib/supabase/client'
import type { AgentApproval, AgentCadence, AgentScope, ProcedureStep } from '@beacon/reality-graph'

export interface UserAgentRow {
  id: string
  organization_id: string
  hotel_id: string | null
  name: string
  api_name: string
  purpose: string
  scope: AgentScope
  cadence: AgentCadence
  approval: AgentApproval
  toolset: string[]
  procedure: ProcedureStep[]
  /** PostgREST returns `numeric` as a string — coerced in rowToAgentDef. */
  clarification_threshold: string | number
  enabled: boolean
  created_at: string
}

export async function fetchUserAgents(): Promise<UserAgentRow[]> {
  const { data, error } = await supabase
    .from('user_agents').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as UserAgentRow[]
}

export interface CreateUserAgentInput {
  name: string
  apiName: string
  purpose: string
  scope: AgentScope
  cadence: AgentCadence
  approval: AgentApproval
  toolset: string[]
  procedure: ProcedureStep[]
  clarificationThreshold: number
}

/** org + author land from column DEFAULTs — the client sends only the agent. */
export async function createUserAgent(i: CreateUserAgentInput): Promise<UserAgentRow> {
  const { data, error } = await supabase.from('user_agents')
    .insert({
      name: i.name, api_name: i.apiName, purpose: i.purpose,
      scope: i.scope, cadence: i.cadence, approval: i.approval,
      toolset: i.toolset, procedure: i.procedure,
      clarification_threshold: i.clarificationThreshold,
    })
    .select('*').single<UserAgentRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteUserAgent(id: string): Promise<void> {
  const { error } = await supabase.from('user_agents').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** The row as the reality-graph definition shape. */
export function rowToAgentDef(r: UserAgentRow) {
  return {
    name: r.name, apiName: r.api_name, purpose: r.purpose,
    scope: r.scope, cadence: r.cadence, approval: r.approval,
    toolset: r.toolset, procedure: r.procedure,
    clarificationThreshold: Number(r.clarification_threshold),
  }
}

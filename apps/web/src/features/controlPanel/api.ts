// Control Panel > Authentication: the rules-editor data layer. Reads are
// admin-scoped by RLS (654); the two provider knobs write through 657's
// column grant; rules and conditions are add/remove (the editor recreates
// rather than edits, which is all the policies admit on purpose).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface Provider {
  id: string
  name: string
  kind: string
  realm: string
  org_assignment_enabled: boolean
  default_organization_id: string | null
}

export type MatchKind = 'includes' | 'does_not_include' | 'is_equal_to'

export const MATCH_KIND_LABEL: Record<MatchKind, string> = {
  includes: 'includes pattern matching (regex)',
  does_not_include: 'does not include pattern matching (regex)',
  is_equal_to: 'is equal to pattern matching (regex)',
}

export interface GroupRuleCondition {
  id: string
  attribute: string
  match_kind: MatchKind
  pattern: string
}

export interface GroupRule {
  id: string
  group_id: string
  group_name: string
  conditions: GroupRuleCondition[]
}

export interface OrgRule {
  id: string
  position: number
  attribute: string
  match_kind: MatchKind
  pattern: string
  organization_id: string
}

export function useProvider() {
  return useQuery({
    queryKey: ['control-panel', 'provider'],
    queryFn: async (): Promise<Provider | null> => {
      const { data, error } = await supabase.from('authentication_providers')
        .select('id, name, kind, realm, org_assignment_enabled, default_organization_id')
        .eq('kind', 'internal').maybeSingle()
      if (error) throw new Error(error.message)
      return data as Provider | null
    },
  })
}

export function useGroupRules(providerId: string | null) {
  return useQuery({
    queryKey: ['control-panel', 'group-rules', providerId],
    enabled: providerId !== null,
    queryFn: async (): Promise<GroupRule[]> => {
      const { data, error } = await supabase.from('group_assignment_rules')
        .select('id, group_id, groups(name), group_assignment_conditions(id, attribute, match_kind, pattern)')
        .eq('provider_id', providerId ?? '')
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      const rows = data as unknown as {
        id: string
        group_id: string
        groups: { name: string } | { name: string }[] | null
        group_assignment_conditions: GroupRuleCondition[]
      }[]
      return rows.map((r) => ({
        id: r.id,
        group_id: r.group_id,
        group_name: (Array.isArray(r.groups) ? r.groups[0]?.name : r.groups?.name) ?? '—',
        conditions: r.group_assignment_conditions,
      }))
    },
  })
}

export function useRuleBasedGroups() {
  return useQuery({
    queryKey: ['control-panel', 'rule-based-groups'],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase.from('groups')
        .select('id, name').eq('group_type', 'rule_based').order('name')
      if (error) throw new Error(error.message)
      return data as { id: string; name: string }[]
    },
  })
}

export function useOrgRules(providerId: string | null) {
  return useQuery({
    queryKey: ['control-panel', 'org-rules', providerId],
    enabled: providerId !== null,
    queryFn: async (): Promise<OrgRule[]> => {
      const { data, error } = await supabase.from('org_assignment_rules')
        .select('id, position, attribute, match_kind, pattern, organization_id')
        .eq('provider_id', providerId ?? '')
        .order('position', { ascending: true })
      if (error) throw new Error(error.message)
      return data as OrgRule[]
    },
  })
}

export function useOrganizationsList() {
  return useQuery({
    queryKey: ['control-panel', 'organizations'],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase.from('organizations').select('id, name').order('name')
      if (error) throw new Error(error.message)
      return data as { id: string; name: string }[]
    },
  })
}

export function useOrgUsers() {
  return useQuery({
    queryKey: ['control-panel', 'users'],
    queryFn: async (): Promise<{ id: string; email: string }[]> => {
      const { data, error } = await supabase.from('users').select('id, email').order('email')
      if (error) throw new Error(error.message)
      return data as { id: string; email: string }[]
    },
  })
}

function invalidating<A>(fn: (a: A) => Promise<void>, done: string) {
  return function useIt() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: fn,
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['control-panel'] })
        toast.success(done)
      },
      onError: (e: Error) => { toast.error(e.message) },
    })
  }
}

export const useAddGroupRule = invalidating<{
  providerId: string
  groupId: string
  conditions: { attribute: string; match_kind: MatchKind; pattern: string }[]
}>(async (a) => {
  const { data, error } = await supabase.from('group_assignment_rules')
    .insert({ provider_id: a.providerId, group_id: a.groupId }).select('id').single()
  if (error) throw new Error(error.message)
  const ruleId = (data as { id: string }).id
  const { error: e2 } = await supabase.from('group_assignment_conditions')
    .insert(a.conditions.map((c) => ({ rule_id: ruleId, ...c })))
  if (e2) throw new Error(e2.message)
}, 'Rule added — it applies at the next login')

export const useDeleteGroupRule = invalidating<{ ruleId: string }>(async (a) => {
  const { error } = await supabase.from('group_assignment_rules').delete().eq('id', a.ruleId)
  if (error) throw new Error(error.message)
}, 'Rule removed')

export const useUpdateProvider = invalidating<{
  providerId: string
  enabled: boolean
  defaultOrganizationId: string | null
}>(async (a) => {
  const { error } = await supabase.from('authentication_providers')
    .update({ org_assignment_enabled: a.enabled, default_organization_id: a.defaultOrganizationId })
    .eq('id', a.providerId)
  if (error) throw new Error(error.message)
}, 'Organization assignment updated')

export const useAddOrgRule = invalidating<{
  providerId: string
  position: number
  attribute: string
  match_kind: MatchKind
  pattern: string
  organizationId: string
}>(async (a) => {
  const { error } = await supabase.from('org_assignment_rules').insert({
    provider_id: a.providerId, position: a.position, attribute: a.attribute,
    match_kind: a.match_kind, pattern: a.pattern, organization_id: a.organizationId,
  })
  if (error) throw new Error(error.message)
}, 'Rule added')

export const useDeleteOrgRule = invalidating<{ ruleId: string }>(async (a) => {
  const { error } = await supabase.from('org_assignment_rules').delete().eq('id', a.ruleId)
  if (error) throw new Error(error.message)
}, 'Rule removed')

// "applied in order at login" — the order IS the semantics, so a swap is a
// first-class edit. Three updates because (provider, position) is unique.
export const useSwapOrgRules = invalidating<{ a: OrgRule; b: OrgRule }>(async ({ a, b }) => {
  const bump = 1_000_000 + a.position
  for (const step of [
    { id: a.id, position: bump },
    { id: b.id, position: a.position },
    { id: a.id, position: b.position },
  ]) {
    const { error } = await supabase.from('org_assignment_rules')
      .update({ position: step.position }).eq('id', step.id)
    if (error) throw new Error(error.message)
  }
}, 'Rules reordered')

export interface TestResult { rule: string; group: string; matched: boolean }

export function useTestAssignment() {
  return useMutation({
    mutationFn: async (a: { userId: string }): Promise<TestResult[]> => {
      const res = (await supabase.rpc('test_group_assignment', { p_user: a.userId })) as {
        data: TestResult[] | null
        error: { message: string } | null
      }
      if (res.error) throw new Error(res.error.message)
      return res.data ?? []
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

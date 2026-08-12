// Internal realm groups — "Access to Projects and resources are usually
// granted to groups rather than individual users." (security/users-and-groups)
//
// Shape from platform-security-management/manage-groups.md: members are users
// or other groups, two administrative permissions govern management, and two
// expiration bounds constrain new memberships. Every rule lives in the
// database (migration 481); these hooks only carry rows and surface refusals.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface Group {
  id: string
  name: string
  description: string | null
  latestExpiration: string | null
  maxDuration: string | null
  createdAt: string
  memberCount: number
}

export interface GroupMember {
  memberUserId: string | null
  memberGroupId: string | null
  expiresAt: string | null
  /** Email for a user, name for a group; the id when neither resolves. */
  label: string
}

export type GroupPermission = 'manage_permissions' | 'manage_membership'

export interface GroupPermissionGrant {
  userId: string
  permission: GroupPermission
  label: string
}

const keys = {
  all: ['groups'] as const,
  members: (id: string) => ['group-members', id] as const,
  permissions: (id: string) => ['group-permissions', id] as const,
}

// Emails resolve best-effort, the same trade the project pickers make:
// better a listed id than an invisible member.
async function emailsFor(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data } = await supabase.from('users').select('id, email').in('id', ids)
  return new Map((data as { id: string; email: string }[] | null ?? []).map((u) => [u.id, u.email]))
}

export function useGroups() {
  return useQuery({
    queryKey: keys.all,
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase.from('groups')
        .select('id, name, description, latest_expiration, max_duration, created_at').order('name')
      if (error) throw new Error(error.message)
      const rows = data as {
        id: string; name: string; description: string | null
        latest_expiration: string | null; max_duration: string | null; created_at: string
      }[]
      const { data: members } = await supabase.from('group_members').select('group_id')
      const counts = new Map<string, number>()
      for (const m of (members as { group_id: string }[] | null ?? [])) {
        counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1)
      }
      return rows.map((r) => ({
        id: r.id, name: r.name, description: r.description,
        latestExpiration: r.latest_expiration, maxDuration: r.max_duration,
        createdAt: r.created_at, memberCount: counts.get(r.id) ?? 0,
      }))
    },
    staleTime: 30_000,
  })
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: keys.members(groupId ?? ''),
    enabled: !!groupId,
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await supabase.from('group_members')
        .select('member_user_id, member_group_id, expires_at').eq('group_id', groupId ?? '')
      if (error) throw new Error(error.message)
      const rows = data as { member_user_id: string | null; member_group_id: string | null; expires_at: string | null }[]

      const emails = await emailsFor(rows.flatMap((r) => r.member_user_id ? [r.member_user_id] : []))
      const groupIds = rows.flatMap((r) => r.member_group_id ? [r.member_group_id] : [])
      const names = new Map<string, string>()
      if (groupIds.length > 0) {
        const { data: gs } = await supabase.from('groups').select('id, name').in('id', groupIds)
        for (const g of (gs as { id: string; name: string }[] | null ?? [])) names.set(g.id, g.name)
      }
      return rows.map((r) => ({
        memberUserId: r.member_user_id, memberGroupId: r.member_group_id, expiresAt: r.expires_at,
        label: r.member_user_id
          ? (emails.get(r.member_user_id) ?? r.member_user_id)
          : (names.get(r.member_group_id ?? '') ?? r.member_group_id ?? ''),
      }))
    },
    staleTime: 15_000,
  })
}

export function useGroupPermissions(groupId: string | null) {
  return useQuery({
    queryKey: keys.permissions(groupId ?? ''),
    enabled: !!groupId,
    queryFn: async (): Promise<GroupPermissionGrant[]> => {
      const { data, error } = await supabase.from('group_permissions')
        .select('user_id, permission').eq('group_id', groupId ?? '')
      if (error) throw new Error(error.message)
      const rows = data as { user_id: string; permission: GroupPermission }[]
      const emails = await emailsFor(rows.map((r) => r.user_id))
      return rows.map((r) => ({
        userId: r.user_id, permission: r.permission,
        label: emails.get(r.user_id) ?? r.user_id,
      }))
    },
    staleTime: 15_000,
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { name: string; description: string }) => {
      const { error } = await supabase.from('groups')
        .insert({ name: i.name, description: i.description || null })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Group created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The two bounds from "Membership expiration": Latest expiration and Maximum
 *  duration. Passed through as-is; the database refuses what they forbid. */
export function useUpdateGroup(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { description?: string | null; latestExpiration?: string | null; maxDuration?: string | null }) => {
      const patch: Record<string, string | null> = {}
      if ('description' in i) patch.description = i.description ?? null
      if ('latestExpiration' in i) patch.latest_expiration = i.latestExpiration ?? null
      if ('maxDuration' in i) patch.max_duration = i.maxDuration ?? null
      const { error } = await supabase.from('groups').update(patch).eq('id', groupId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Group updated') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', groupId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Group deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useAddGroupMember(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { userId?: string; memberGroupId?: string; expiresAt?: string | null }) => {
      const { error } = await supabase.from('group_members').insert({
        group_id: groupId,
        member_user_id: i.userId ?? null,
        member_group_id: i.memberGroupId ?? null,
        expires_at: i.expiresAt ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.members(groupId) })
      void qc.invalidateQueries({ queryKey: keys.all })
      toast.success('Member added')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRemoveGroupMember(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { userId?: string; memberGroupId?: string }) => {
      let q = supabase.from('group_members').delete().eq('group_id', groupId)
      q = i.userId ? q.eq('member_user_id', i.userId) : q.eq('member_group_id', i.memberGroupId ?? '')
      const { error } = await q
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.members(groupId) })
      void qc.invalidateQueries({ queryKey: keys.all })
      toast.success('Member removed')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useGrantGroupPermission(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { userId: string; permission: GroupPermission }) => {
      const { error } = await supabase.from('group_permissions')
        .insert({ group_id: groupId, user_id: i.userId, permission: i.permission })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.permissions(groupId) }); toast.success('Permission granted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRevokeGroupPermission(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { userId: string; permission: GroupPermission }) => {
      const { error } = await supabase.from('group_permissions').delete()
        .eq('group_id', groupId).eq('user_id', i.userId).eq('permission', i.permission)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.permissions(groupId) }); toast.success('Permission revoked') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

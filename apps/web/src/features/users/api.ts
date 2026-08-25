// User administration — the wire shape as rows (678/679). The capture's
// table draws Username | Given name | Family name | Organization | Realm,
// which is not the column list its own prose gives; the capture is the
// drawn surface (platform-security-management/images/manage-users.png).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export type UserStatus = 'ACTIVE' | 'DELETED'

export interface PlatformUser {
  id: string
  username: string
  givenName: string | null
  familyName: string | null
  email: string
  organizationName: string | null
  /** The realm IDENTIFIER, which is what the wire's `realm` field is and
   *  what the capture's Realm column draws (`palantir-intern…`). The
   *  provider's display name lives in multipass:realm-name instead. */
  realm: string | null
  status: UserStatus
}

/** name -> values, the map-of-lists the wire publishes. */
export interface UserAttribute {
  name: string
  values: string[]
}

const keys = {
  users: ['platform-users'] as const,
  attributes: (id: string) => ['user-attributes', id] as const,
  groups: (id: string) => ['user-groups', id] as const,
}

export function useUsers() {
  return useQuery({
    queryKey: keys.users,
    staleTime: 30_000,
    queryFn: async (): Promise<PlatformUser[]> => {
      const { data, error } = await supabase.from('users')
        .select(`id, username, given_name, family_name, email, status,
                 organizations(name), authentication_providers!users_realm_fkey(realm)`)
        .order('username').limit(500)
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; username: string; given_name: string | null; family_name: string | null
        email: string; status: UserStatus
        organizations: { name: string } | null
        authentication_providers: { realm: string } | null
      }[]).map((r) => ({
        id: r.id, username: r.username, givenName: r.given_name, familyName: r.family_name,
        email: r.email, status: r.status,
        organizationName: r.organizations?.name ?? null,
        realm: r.authentication_providers?.realm ?? null,
      }))
    },
  })
}

export function useUserAttributes(userId: string | null) {
  return useQuery({
    queryKey: keys.attributes(userId ?? ''),
    enabled: userId !== null,
    queryFn: async (): Promise<UserAttribute[]> => {
      const { data, error } = await supabase.from('user_attributes')
        .select('name, values').eq('user_id', userId ?? '').order('name')
      if (error) throw new Error(error.message)
      return data as UserAttribute[]
    },
  })
}

/** The details panel's Groups block: which groups this user belongs to. */
export function useUserGroups(userId: string | null) {
  return useQuery({
    queryKey: keys.groups(userId ?? ''),
    enabled: userId !== null,
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase.from('group_members')
        .select('groups(id, name)').eq('member_user_id', userId ?? '')
      if (error) throw new Error(error.message)
      return (data as unknown as { groups: { id: string; name: string } | null }[])
        .flatMap((r) => (r.groups ? [r.groups] : []))
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      id: string; username: string; givenName: string | null; familyName: string | null
    }) => {
      const { error } = await supabase.from('users')
        .update({ username: i.username, given_name: i.givenName, family_name: i.familyName })
        .eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.users }); toast.success('User saved') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Deletion is soft — the documented undelete is this same update back. */
export function useSetUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id: string; status: UserStatus }) => {
      const { error } = await supabase.from('users').update({ status: i.status }).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: keys.users })
      toast.success(i.status === 'DELETED' ? 'User deleted' : 'User restored')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSetUserAttribute(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { name: string; values: string[] }) => {
      const { error } = await supabase.from('user_attributes')
        .upsert({ user_id: userId, name: i.name, values: i.values })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.attributes(userId) }); toast.success('Attribute saved') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRemoveUserAttribute(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('user_attributes')
        .delete().eq('user_id', userId).eq('name', name)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.attributes(userId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

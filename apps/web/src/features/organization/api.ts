// The organization itself: its backing marking and its guests.
// "A guest of an Organization is a user who can view Projects, files, users,
// groups… Guests can be users or groups."
// (administration/enrollments-and-organizations-access.md)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth.store'

export interface OrgGuest {
  id: string
  userId: string | null
  groupId: string | null
  /** Resolved when the principal is visible to the caller; the id otherwise —
   *  registries are org-siloed, and enrollment-wide discovery is the next
   *  slice of the enrollments reading. */
  label: string
  grantedAt: string
}

const keys = {
  org: ['my-organization'] as const,
  guests: ['org-guests'] as const,
}

export function useMyOrganization() {
  const orgId = useAuthStore((s) => s.session?.user.organization_id ?? null)
  return useQuery({
    queryKey: keys.org,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations')
        .select('id, name, marking_id, markings(name)').eq('id', orgId ?? '').single()
      if (error) throw new Error(error.message)
      const r = data as unknown as {
        id: string; name: string; marking_id: string | null; markings: { name: string } | null
      }
      return { id: r.id, name: r.name, markingId: r.marking_id, markingName: r.markings?.name ?? null }
    },
    staleTime: 60_000,
  })
}

export function useOrgGuests() {
  const orgId = useAuthStore((s) => s.session?.user.organization_id ?? null)
  return useQuery({
    queryKey: keys.guests,
    enabled: !!orgId,
    queryFn: async (): Promise<OrgGuest[]> => {
      const { data, error } = await supabase.from('organization_guests')
        .select('id, user_id, group_id, granted_at').eq('organization_id', orgId ?? '')
      if (error) throw new Error(error.message)
      const rows = data as { id: string; user_id: string | null; group_id: string | null; granted_at: string }[]

      const userIds = rows.flatMap((r) => r.user_id ? [r.user_id] : [])
      const groupIds = rows.flatMap((r) => r.group_id ? [r.group_id] : [])
      const labels = new Map<string, string>()
      if (userIds.length > 0) {
        const { data: people } = await supabase.from('users').select('id, email').in('id', userIds)
        for (const u of (people as { id: string; email: string }[] | null ?? [])) labels.set(u.id, u.email)
      }
      if (groupIds.length > 0) {
        const { data: gs } = await supabase.from('groups').select('id, name').in('id', groupIds)
        for (const g of (gs as { id: string; name: string }[] | null ?? [])) labels.set(g.id, g.name)
      }
      return rows.map((r) => ({
        id: r.id, userId: r.user_id, groupId: r.group_id, grantedAt: r.granted_at,
        label: labels.get(r.user_id ?? r.group_id ?? '') ?? (r.user_id ?? r.group_id ?? ''),
      }))
    },
    staleTime: 15_000,
  })
}

export function useAddOrgGuest() {
  const qc = useQueryClient()
  const orgId = useAuthStore((s) => s.session?.user.organization_id ?? null)
  return useMutation({
    mutationFn: async (i: { kind: 'user' | 'group'; principalId: string }) => {
      const { error } = await supabase.from('organization_guests').insert({
        organization_id: orgId,
        user_id: i.kind === 'user' ? i.principalId : null,
        group_id: i.kind === 'group' ? i.principalId : null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.guests }); toast.success('Guest added') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRemoveOrgGuest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (guestRowId: string) => {
      const { error } = await supabase.from('organization_guests').delete().eq('id', guestRowId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.guests }); toast.success('Guest removed') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

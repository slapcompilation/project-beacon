import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import {
  fetchTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  removeTeamMember,
} from '../api'

export const teamKeys = {
  all: (hotelId: string | null) => ['team', hotelId] as const,
}

export function useTeamMembers() {
  const hotelId = useAuthStore((s) => s.hotelId)
  return useQuery({
    queryKey: teamKeys.all(hotelId),
    queryFn: () => fetchTeamMembers(hotelId!),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,  // team data changes infrequently
  })
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      inviteTeamMember(email, role),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.all(hotelId) })
      toast.success(`Invite sent to ${vars.email}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.all(hotelId) })
      toast.success('Role updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: (userId: string) => removeTeamMember(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.all(hotelId) })
      toast.success('Member removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

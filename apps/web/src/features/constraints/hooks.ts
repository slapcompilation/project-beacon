import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import {
  createConstraint,
  fetchActiveConstraints,
  fetchAllConstraints,
  setConstraintActive,
  type CreateConstraintInput,
} from './api'

export const constraintKeys = {
  active: (hotelId: string) => ['constraints', 'active', hotelId] as const,
  all:    (hotelId: string) => ['constraints', 'all', hotelId] as const,
}

export function useActiveConstraints() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: constraintKeys.active(hotelId ?? ''),
    queryFn:  () => fetchActiveConstraints(hotelId ?? ''),
    enabled:  !!hotelId,
    staleTime: 30_000,
  })
}

export function useAllConstraints() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: constraintKeys.all(hotelId ?? ''),
    queryFn:  () => fetchAllConstraints(hotelId ?? ''),
    enabled:  !!hotelId,
    staleTime: 30_000,
  })
}

export function useCreateConstraint() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<CreateConstraintInput, 'hotelId' | 'authoredByUserId'>) => {
      if (!hotelId || !userId) throw new Error('Missing hotel or user context')
      return createConstraint({ ...input, hotelId, authoredByUserId: userId })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: constraintKeys.active(hotelId ?? '') })
      void qc.invalidateQueries({ queryKey: constraintKeys.all(hotelId ?? '') })
      toast.success('Constraint saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSetConstraintActive() {
  const hotelId = useActiveHotelId()
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setConstraintActive(id, active),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: constraintKeys.active(hotelId ?? '') })
      void qc.invalidateQueries({ queryKey: constraintKeys.all(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

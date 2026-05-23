import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import {
  createPrinciple,
  fetchActivePrinciples,
  fetchAllPrinciples,
  setPrincipleActive,
} from './api'
import { categorizePrinciple } from './categorizer'

export const principleKeys = {
  active: (hotelId: string) => ['principles', 'active', hotelId] as const,
  all:    (hotelId: string) => ['principles', 'all', hotelId] as const,
}

export function useActivePrinciples() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: principleKeys.active(hotelId ?? ''),
    queryFn:  () => fetchActivePrinciples(hotelId ?? ''),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

export function useAllPrinciples() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: principleKeys.all(hotelId ?? ''),
    queryFn:  () => fetchAllPrinciples(hotelId ?? ''),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

/** Categorizes the NL body via the agent-llm edge function (heuristic fallback),
 *  then writes the row. */
export function useCreatePrinciple() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: async (body: string) => {
      if (!hotelId || !userId) throw new Error('Missing hotel or user context')
      const category = await categorizePrinciple(body)
      return createPrinciple({
        hotelId,
        body,
        category,
        authoredByUserId: userId,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: principleKeys.active(hotelId ?? '') })
      void qc.invalidateQueries({ queryKey: principleKeys.all(hotelId ?? '') })
      toast.success('Principle saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSetPrincipleActive() {
  const hotelId = useActiveHotelId()
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setPrincipleActive(id, active),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: principleKeys.active(hotelId ?? '') })
      void qc.invalidateQueries({ queryKey: principleKeys.all(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

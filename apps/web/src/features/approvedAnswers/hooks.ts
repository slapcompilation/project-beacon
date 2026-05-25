import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import {
  createApprovedAnswer,
  fetchApprovedAnswers,
  recordApprovedAnswerHit,
  retireApprovedAnswer,
  type ApprovedAnswerRow,
} from './api'

export const approvedAnswerKeys = {
  list: (hotelId: string) => ['approved-answers', hotelId] as const,
}

export function useApprovedAnswers() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: approvedAnswerKeys.list(hotelId ?? ''),
    queryFn:  () => (hotelId ? fetchApprovedAnswers(hotelId) : Promise.resolve([] as ApprovedAnswerRow[])),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

export function useCurateAnswer() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: async (args: { question: string; answer: string; sourceMessageId?: string | null }) => {
      if (!hotelId || !userId) throw new Error('Missing context')
      return createApprovedAnswer({
        hotelId,
        question:        args.question,
        answer:          args.answer,
        sourceMessageId: args.sourceMessageId,
        curatedByUserId: userId,
      })
    },
    onSuccess: () => {
      toast.success('Answer curated')
      void qc.invalidateQueries({ queryKey: approvedAnswerKeys.list(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRetireApprovedAnswer() {
  const hotelId = useActiveHotelId()
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => retireApprovedAnswer(id),
    onSuccess: () => {
      toast.success('Retired')
      void qc.invalidateQueries({ queryKey: approvedAnswerKeys.list(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export { recordApprovedAnswerHit }

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import {
  fetchCopilotConfig,
  upsertCopilotConfig,
} from './api'

export const copilotConfigKeys = {
  detail: (hotelId: string) => ['copilot-config', hotelId] as const,
}

export function useCopilotConfig() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: copilotConfigKeys.detail(hotelId ?? ''),
    queryFn:  () => (hotelId ? fetchCopilotConfig(hotelId) : Promise.resolve(null)),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

export function useUpsertCopilotConfig() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: async (disabledTools: string[]) => {
      if (!hotelId || !userId) throw new Error('Missing context')
      return upsertCopilotConfig({
        hotelId,
        disabledTools,
        updatedByUserId: userId,
      })
    },
    onSuccess: () => {
      toast.success('Copilot tools updated')
      void qc.invalidateQueries({ queryKey: copilotConfigKeys.detail(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

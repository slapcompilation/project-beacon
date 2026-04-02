// Layer: Flow — TanStack Query hooks for stocktake session lifecycle
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchActiveDraftSession,
  fetchSessionLines,
  beginStocktake,
  updateStocktakeLine,
  commitStocktake,
  cancelStocktake,
} from '../api/stocktake'

const keys = {
  activeSession: (hotelId: string) => ['stocktake-session', hotelId] as const,
  lines: (sessionId: string) => ['stocktake-lines', sessionId] as const,
}

export function useActiveDraftSession() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: keys.activeSession(hotelId ?? ''),
    queryFn: () => fetchActiveDraftSession(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 30 * 1000,
  })
}

export function useSessionLines(sessionId: string | undefined) {
  return useQuery({
    queryKey: keys.lines(sessionId ?? ''),
    queryFn: () => fetchSessionLines(sessionId ?? ''),
    enabled: !!sessionId,
    staleTime: 10 * 1000,
  })
}

export function useBeginStocktake() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (note?: string) => beginStocktake(note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.activeSession(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateStocktakeLine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lineId, countedQty }: { lineId: string; sessionId: string; countedQty: number | null }) =>
      updateStocktakeLine(lineId, countedQty),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: keys.lines(vars.sessionId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCommitStocktake() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (sessionId: string) => commitStocktake(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.activeSession(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['products', hotelId] })
      toast.success('Stocktake committed', {
        action: {
          label: 'View movement report →',
          onClick: () => { window.location.href = '/reports?tab=movement' },
        },
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCancelStocktake() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (sessionId: string) => cancelStocktake(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.activeSession(hotelId ?? '') })
      toast.info('Stocktake cancelled')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

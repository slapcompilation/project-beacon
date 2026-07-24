import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchAutomations, createAutomation, setAutomationEnabled, setAutomationStage,
  deleteAutomation, fetchVariantReadings, type CreateAutomationInput,
} from './api'

const keys = {
  list: ['automations'] as const,
  readings: (hotelId: string) => ['automation-readings', hotelId] as const,
}

export function useAutomations() {
  return useQuery({ queryKey: keys.list, queryFn: fetchAutomations, staleTime: 30_000 })
}

export function useVariantReadings() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: keys.readings(hotelId ?? ''),
    queryFn: () => fetchVariantReadings(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 60_000,
  })
}

export function useCreateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAutomationInput) => createAutomation(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.list }); toast.success('Automation created — starts in sandbox') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useToggleAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setAutomationEnabled(id, enabled),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.list }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function usePromoteAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: 'sandbox' | 'staging' | 'production' }) => setAutomationStage(id, stage),
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: keys.list }); toast.success(`Moved to ${v.stage}`) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAutomation(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.list }); toast.success('Automation deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

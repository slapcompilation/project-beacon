// Layer: Mind — Events hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import { fetchEvents } from '../api'
import type { EventInput } from '../api'

const eventsKeys = {
  all: (hotelId: string) => ['events', hotelId] as const,
}

export function useEvents() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: eventsKeys.all(hotelId ?? ''),
    queryFn: () => fetchEvents(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,  // events change infrequently
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (input: EventInput) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        {
          type:         'CREATE_EVENT',
          hotelId,
          name:         input.name,
          eventDate:    input.event_date,
          guestCount:   input.guest_count,
          eventType:    input.event_type,
          demandFactor: input.demand_factor,
          notes:        input.notes ?? null,
        },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventsKeys.all(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['eye', 'occupancy-forecast'] })
      void queryClient.invalidateQueries({ queryKey: ['eye', 'booking-forecasts'] })
      toast.success('Event created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<EventInput> }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        {
          type:         'UPDATE_EVENT',
          eventId:      id,
          hotelId,
          name:         input.name,
          eventDate:    input.event_date,
          guestCount:   input.guest_count,
          eventType:    input.event_type,
          demandFactor: input.demand_factor,
          notes:        input.notes,
        },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventsKeys.all(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['eye', 'occupancy-forecast'] })
      void queryClient.invalidateQueries({ queryKey: ['eye', 'booking-forecasts'] })
      toast.success('Event updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (id: string) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'DELETE_EVENT', eventId: id, hotelId },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventsKeys.all(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['eye', 'occupancy-forecast'] })
      void queryClient.invalidateQueries({ queryKey: ['eye', 'booking-forecasts'] })
      toast.success('Event deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

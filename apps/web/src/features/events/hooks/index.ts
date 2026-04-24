// Layer: Mind — Events hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { fetchEvents, createEvent, updateEvent, deleteEvent } from '../api'
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
  return useMutation({
    mutationFn: (input: EventInput) => createEvent(hotelId ?? '', input),
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
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<EventInput> }) =>
      updateEvent(id, input),
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
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventsKeys.all(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['eye', 'occupancy-forecast'] })
      void queryClient.invalidateQueries({ queryKey: ['eye', 'booking-forecasts'] })
      toast.success('Event deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

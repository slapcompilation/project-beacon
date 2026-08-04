import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'
import {
  fetchAccessibleHotels, updateHotelProfile, updateRemovalReasonPolicy, updateAutonomousSettings,
  type HotelProfileInput, type AutonomousSettingsInput,
} from '../api'

export function useHotels() {
  const hotelId = useAuthStore((s) => s.hotelId)
  return useQuery({
    queryKey: ['hotels', hotelId],
    queryFn: fetchAccessibleHotels,
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000, // hotel list changes rarely
  })
}

/** Returns the currently active Hotel object (respects hotel switcher). */
export function useActiveHotel() {
  const { data: hotels = [] } = useHotels()
  const authHotelId = useAuthStore((s) => s.hotelId)
  const overrideHotelId = useAppStore((s) => s.activeHotelId)
  const activeId = overrideHotelId ?? authHotelId
  return hotels.find((h) => h.id === activeId) ?? null
}

export function useUpdateHotel() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)

  return useMutation({
    mutationFn: (input: HotelProfileInput) => updateHotelProfile(hotelId ?? '', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hotels', hotelId] })
      toast.success('Hotel profile saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateAutonomousSettings() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)

  return useMutation({
    mutationFn: (input: AutonomousSettingsInput) => updateAutonomousSettings(hotelId ?? '', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hotels', hotelId] })
      toast.success('Autonomous settings saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateRemovalReasonPolicy() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  // The setting is read off the active hotel, so it has to be written there too.
  // The old RPC wrote to users.hotel_id, which is a different property once
  // somebody manages two.
  const active = useActiveHotel()

  return useMutation({
    mutationFn: (required: boolean) => updateRemovalReasonPolicy(active?.id ?? '', required),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hotels', hotelId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

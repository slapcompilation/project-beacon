// Layer: Floor · Eye · Mind — TanStack Query hooks for F&B + POS Intelligence

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchMenuItems, createMenuItem, updateMenuItem, deleteMenuItem,
  addIngredient, updateIngredient, removeIngredient,
  fetchPOSHealth, fetchCOGSByItem, fetchPOSVariance,
} from '../api'

export const fbKeys = {
  menuItems:   (hotelId: string)                    => ['fb', 'menu-items', hotelId]        as const,
  posHealth:   (hotelId: string)                    => ['fb', 'pos-health', hotelId]         as const,
  cogs:        (hotelId: string, days: number)      => ['fb', 'cogs', hotelId, days]         as const,
  variance:    (hotelId: string, days: number, t: number) => ['fb', 'variance', hotelId, days, t] as const,
}

// ─── Menu items ───────────────────────────────────────────────────────────────

export function useMenuItems() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: fbKeys.menuItems(hotelId ?? ''),
    queryFn:  fetchMenuItems,
    enabled:  !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: (payload: { name: string; category: string | null; sell_price: number | null }) =>
      createMenuItem(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') })
    },
  })
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: ({ id, patch }: {
      id: string
      patch: Partial<{ name: string; category: string | null; sell_price: number | null; is_active: boolean }>
    }) => updateMenuItem(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') })
    },
  })
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') })
    },
  })
}

// ─── Ingredients ─────────────────────────────────────────────────────────────

export function useAddIngredient() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: (payload: { menu_item_id: string; variant_id: string; qty_per_serve: number; unit: string | null }) =>
      addIngredient(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') })
    },
  })
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<{ qty_per_serve: number; unit: string | null }> }) =>
      updateIngredient(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') })
    },
  })
}

export function useRemoveIngredient() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: (id: string) => removeIngredient(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') })
    },
  })
}

// ─── POS health ───────────────────────────────────────────────────────────────

export function usePOSHealth() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:       fbKeys.posHealth(hotelId ?? ''),
    queryFn:        fetchPOSHealth,
    enabled:        !!hotelId,
    staleTime:       5 * 60 * 1000,  // match refetch interval to avoid stale-window double-fetches
    refetchInterval: 5 * 60 * 1000,
  })
}

// ─── COGS ────────────────────────────────────────────────────────────────────

export function useCOGSByItem(days = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: fbKeys.cogs(hotelId ?? '', days),
    queryFn:  () => fetchCOGSByItem(days),
    enabled:  !!hotelId,
    staleTime: 10 * 60 * 1000,
  })
}

// ─── Variance ────────────────────────────────────────────────────────────────

export function usePOSVariance(days = 30, thresholdPct = 15) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: fbKeys.variance(hotelId ?? '', days, thresholdPct),
    queryFn:  () => fetchPOSVariance(days, thresholdPct),
    enabled:  !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

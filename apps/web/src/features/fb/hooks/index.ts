// Layer: Floor · Insights · Mind — TanStack Query hooks for F&B + POS Intelligence

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import {
  fetchMenuItems,
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
  const userId      = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (payload: { name: string; category: string | null; sell_price: number | null }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'CREATE_MENU_ITEM', hotelId, name: payload.name, category: payload.category, sellPrice: payload.sell_price },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') }) },
    onError:   (err: Error) => toast.error(err.message),
  })
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  const userId      = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async ({ id, patch }: {
      id: string
      patch: Partial<{ name: string; category: string | null; sell_price: number | null; is_active: boolean }>
    }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        {
          type:       'UPDATE_MENU_ITEM',
          menuItemId: id,
          hotelId,
          name:       patch.name,
          category:   patch.category,
          sellPrice:  patch.sell_price,
          isActive:   patch.is_active,
        },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') }) },
    onError:   (err: Error) => toast.error(err.message),
  })
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  const userId      = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (id: string) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'ARCHIVE_MENU_ITEM', menuItemId: id, hotelId },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') }) },
    onError:   (err: Error) => toast.error(err.message),
  })
}

// ─── Ingredients ─────────────────────────────────────────────────────────────

export function useAddIngredient() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  const userId      = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (payload: { menu_item_id: string; variant_id: string; qty_per_serve: number; unit: string | null }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        {
          type:        'ADD_MENU_INGREDIENT',
          hotelId,
          menuItemId:  payload.menu_item_id,
          variantId:   payload.variant_id,
          qtyPerServe: payload.qty_per_serve,
          unit:        payload.unit,
        },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') }) },
    onError:   (err: Error) => toast.error(err.message),
  })
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  const userId      = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<{ qty_per_serve: number; unit: string | null }> }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'UPDATE_MENU_INGREDIENT', ingredientId: id, hotelId, qtyPerServe: patch.qty_per_serve, unit: patch.unit },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') }) },
    onError:   (err: Error) => toast.error(err.message),
  })
}

export function useRemoveIngredient() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  const userId      = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (id: string) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'REMOVE_MENU_INGREDIENT', ingredientId: id, hotelId },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: fbKeys.menuItems(hotelId ?? '') }) },
    onError:   (err: Error) => toast.error(err.message),
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

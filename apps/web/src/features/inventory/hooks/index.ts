import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { queueMutation, notifyQueueChanged } from '@/lib/offline-queue'
import { dispatchAction } from '@/lib/actions/dispatch'
import type { OfflineMutation, ProductWithVariants } from '@beacon/types'
import {
  fetchProducts,
  fetchStockLogs,
  createProduct,
  updateProduct,
  deleteProduct,
  undoStockAdjustment,
  fetchExpiringVariants,
  fetchExpiryBatches,
  discardBatch,
  fetchUpcomingReminders,
  createVariant,
  updateVariant,
  softDeleteVariant,
  setVariantActive,
  fetchForecast,
  batchAdjustStock,
  lookupVariantByBarcode,
  fetchCostHistory,
  fetchProcurementProposals,
  createBulkRestockRequests,
  fetchFefoBatchMap,
  fetchStockoutProbabilities,
  type CreateProductInput,
  type VariantInput,
} from '../api'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const inventoryKeys = {
  products: (hotelId: string) => ['products', hotelId] as const,
  stockLogs: (hotelId: string, variantId: string) =>
    ['stock-logs', hotelId, variantId] as const,
}

// ─── Products ─────────────────────────────────────────────────────────────────

export function useProducts() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: inventoryKeys.products(hotelId ?? ''),
    queryFn: () => fetchProducts(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 60 * 1000,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(hotelId ?? '', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      toast.success('Product created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateProductInput> }) =>
      updateProduct(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      toast.success('Product updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      toast.success('Product removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Stock logs ───────────────────────────────────────────────────────────────

export function useStockLogs(variantId: string | null) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: inventoryKeys.stockLogs(hotelId ?? '', variantId ?? ''),
    queryFn: () => fetchStockLogs(variantId ?? ''),
    enabled: !!hotelId && !!variantId,
    staleTime: 60_000,
  })
}

// ─── Stock adjustment ─────────────────────────────────────────────────────────

export function useAdjustStock() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const isOnline = useOnlineStatus()
  const userId = useAuthStore((s) => s.session?.user.id ?? '')

  type AdjustVars = {
    variantId: string
    delta: number
    reason: string
    photoFile?: File | null
    removalCategory?: string | null
  }

  return useMutation({
    mutationFn: async ({
      variantId,
      delta,
      reason,
      photoFile,
      removalCategory,
    }: AdjustVars): Promise<{ queued: boolean }> => {
      if (!isOnline) {
        const mutation: OfflineMutation = {
          id: crypto.randomUUID(),
          variant_id: variantId,
          delta,
          reason,
          client_timestamp: new Date().toISOString(),
          client_id: navigator.userAgent.slice(0, 40),
          hotel_id: hotelId ?? '',
          user_id: userId,
          synced: false,
        }
        await queueMutation(mutation)
        notifyQueueChanged()
        return { queued: true }
      }
      const actionResult = await dispatchAction(
        { type: 'ADJUST_STOCK', variantId, delta, reason, hotelId: hotelId ?? '', userId, removalCategory },
        { hotelId: hotelId ?? '', actorId: userId, triggeredBy: 'user' },
        { photoFile },
      )
      if (!actionResult.success) throw new Error(actionResult.error.message)
      return { queued: false as const }
    },
    // ── Optimistic update — apply delta immediately so UI doesn't lag ──────────
    onMutate: async ({ variantId, delta }: AdjustVars) => {
      if (!isOnline) return // offline path uses queue — no optimistic needed
      const key = inventoryKeys.products(hotelId ?? '')
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<ProductWithVariants[]>(key)
      if (prev) {
        queryClient.setQueryData<ProductWithVariants[]>(key,
          prev.map((p) => ({
            ...p,
            product_variants: p.product_variants.map((v) =>
              v.id === variantId
                ? { ...v, current_stock: Math.max(0, v.current_stock + delta) }
                : v
            ),
          }))
        )
      }
      return { prev }
    },
    onError: (err: Error, _, ctx) => {
      // Roll back on failure
      if (ctx?.prev) {
        queryClient.setQueryData(inventoryKeys.products(hotelId ?? ''), ctx.prev)
      }
      toast.error(err.message)
    },
    onSuccess: (data, vars) => {
      if (data.queued) {
        toast.info('Offline — queued for sync when reconnected')
        return
      }
      void queryClient.invalidateQueries({
        queryKey: inventoryKeys.stockLogs(hotelId ?? '', vars.variantId),
      })
      // Cascade to Eye/Mind layers — stock changes affect waste radar, forecast, dead stock
      void queryClient.invalidateQueries({ queryKey: ['eye', hotelId] })
      void queryClient.invalidateQueries({ queryKey: ['mind', hotelId] })
      // If this was a categorised removal (waste), offer a direct link to the waste report
      if (vars.removalCategory && vars.delta < 0) {
        toast.success('Stock updated', {
          action: {
            label: 'View waste report →',
            onClick: () => { window.location.href = '/reports?tab=waste' },
          },
        })
      } else {
        toast.success('Stock updated')
      }
    },
    onSettled: () => {
      // Always confirm from server after mutation settles (success or error)
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
    },
  })
}

// ─── Expiry ───────────────────────────────────────────────────────────────────

export function useUpcomingReminders(daysAhead = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['upcoming-reminders', hotelId, daysAhead],
    queryFn: () => fetchUpcomingReminders(hotelId ?? '', daysAhead),
    enabled: !!hotelId,
    staleTime: 60 * 1000,
  })
}

export function useExpiringVariants(daysAhead = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['expiring-variants', hotelId, daysAhead],
    queryFn: () => fetchExpiringVariants(hotelId ?? '', daysAhead),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useExpiryBatches(daysAhead = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['expiry-batches', hotelId, daysAhead],
    queryFn: () => fetchExpiryBatches(daysAhead),
    enabled: !!hotelId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useDiscardBatch() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ batchId, reason }: { batchId: string; reason?: string }) =>
      discardBatch(batchId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expiry-batches', hotelId] })
      void queryClient.invalidateQueries({ queryKey: ['products', hotelId] })
      void queryClient.invalidateQueries({ queryKey: ['eye', hotelId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUndoStock() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: (logId: string) => undoStockAdjustment(logId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['eye', hotelId] })
      void queryClient.invalidateQueries({ queryKey: ['mind', hotelId] })
      toast.success('Adjustment undone')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Variant CRUD ─────────────────────────────────────────────────────────────

export function useCreateVariant(productId: string) {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (input: VariantInput) => createVariant(productId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      toast.success('Variant added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateVariant() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<VariantInput> }) =>
      updateVariant(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      toast.success('Variant updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteVariant() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (id: string) => softDeleteVariant(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      toast.success('Variant removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useToggleVariantActive() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setVariantActive(id, active),
    onSuccess: (_, { active }) => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      toast.success(active ? 'Variant marked active' : 'Variant marked inactive')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Batch stocktake ──────────────────────────────────────────────────────────

export function useBatchAdjustStock() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: (adjustments: Array<{ variant_id: string; delta: number; reason: string }>) =>
      batchAdjustStock(adjustments),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['recent-activity', hotelId] })
      void queryClient.invalidateQueries({ queryKey: ['eye', hotelId] })
      void queryClient.invalidateQueries({ queryKey: ['mind', hotelId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Barcode lookup ───────────────────────────────────────────────────────────

export function useLookupBarcode() {
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (barcode: string) => lookupVariantByBarcode(hotelId ?? '', barcode),
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Cost history ─────────────────────────────────────────────────────────────

export function useCostHistory(variantId: string | null) {
  return useQuery({
    queryKey: ['cost-history', variantId],
    queryFn: () => fetchCostHistory(variantId ?? ''),
    enabled: !!variantId,
    staleTime: 60 * 1000,
  })
}

// ─── Forecast ─────────────────────────────────────────────────────────────────
// Returns avg daily consumption per variantId (not days-left — caller divides).

export function useForecast() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['forecast', hotelId],
    queryFn: () => fetchForecast(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Procurement Proposals ────────────────────────────────────────────────────
// Layer: Mind — Predictive Procurement Engine
// Fetches ranked procurement signals from get_procurement_proposals() RPC.

export function useProcurementProposals() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['procurement', 'proposals', hotelId],
    queryFn: () => fetchProcurementProposals(),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Bulk restock requests ────────────────────────────────────────────────────
// Layer: Mind — Place multiple restock requests from a procurement proposal list.

export function useCreateBulkRestockRequests() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (items: { variantId: string; quantityNeeded: number; supplier?: string; notes?: string }[]) =>
      createBulkRestockRequests(items),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restocks', hotelId] })
      toast.success('Restock requests created')
    },
    onError: () => { toast.error('Failed to create restock requests') },
  })
}

// ─── FEFO batch map ───────────────────────────────────────────────────────────

export function useFefoBatchMap() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['fefo-batch-map', hotelId],
    queryFn: fetchFefoBatchMap,
    enabled: !!hotelId,
    staleTime: 2 * 60 * 1000,
  })
}

// ─── Probabilistic Intelligence ──────────────────────────────────────────────
// Eye Layer — per-variant stockout probability + confidence score.
// 5-min staleTime: daily consumption stats change slowly; operator refreshes
// are rare and the RPC is moderately expensive (cross-join + generate_series).

export function useStockoutProbabilities() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['stockout-probabilities', hotelId],
    queryFn:  fetchStockoutProbabilities,
    enabled:  !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

// Floor realtime subscription removed — useRealtimeSync (AppLayout) handles
// product_variants and stock_logs globally, eliminating duplicate channels.

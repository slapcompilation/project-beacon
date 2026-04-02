import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOnlineStatus } from './useOnlineStatus'
import { useAuthStore } from '@/stores/auth.store'
import { inventoryKeys } from '@/features/inventory/hooks'
import { adjustStock } from '@/features/inventory/api'
import {
  getPendingMutations,
  getPendingCount,
  removeMutation,
  notifyQueueChanged,
  onQueueChanged,
} from '@/lib/offline-queue'

/**
 * Mounts once in AppLayout / ScanLayout.
 * - Tracks online/offline status and pending count for the OfflineBanner.
 * - On reconnect, flushes the IndexedDB queue in client_timestamp order,
 *   replaying each delta through the adjust_stock RPC.
 * - Exposes syncError when a flush stalls, plus retrySync() and clearQueue()
 *   so the operator can recover without reloading the page.
 */
export function useSyncQueue() {
  const isOnline    = useOnlineStatus()
  const [isSyncing,   setIsSyncing]   = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncError,   setSyncError]   = useState(false)  // true when flush stalled on an RPC error
  const queryClient = useQueryClient()
  const hotelId     = useAuthStore((s) => s.hotelId)

  const refreshCount = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  // Keep pendingCount fresh whenever the queue changes
  useEffect(() => {
    void refreshCount()
    return onQueueChanged(() => { void refreshCount() })
  }, [refreshCount])

  const flush = useCallback(async () => {
    const mutations = await getPendingMutations()
    if (mutations.length === 0) return

    setIsSyncing(true)
    setSyncError(false)

    // Replay in the order they were created on the device
    const sorted = [...mutations].sort(
      (a, b) =>
        new Date(a.client_timestamp).getTime() - new Date(b.client_timestamp).getTime()
    )

    let synced   = 0
    let hadError = false

    for (const m of sorted) {
      try {
        await adjustStock(m.variant_id, m.delta, m.reason)
        await removeMutation(m.id)
        notifyQueueChanged()
        synced++
      } catch {
        // Stop on first failure to preserve delta ordering; expose the stall
        hadError = true
        break
      }
    }

    if (synced > 0 && hotelId) {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId) })
      void queryClient.invalidateQueries({ queryKey: ['recent-activity', hotelId] })
      toast.success(
        `${String(synced)} offline adjustment${synced !== 1 ? 's' : ''} synced`
      )
    }

    // Surface the error — OfflineBanner will show retry/discard options
    if (hadError) setSyncError(true)
    setIsSyncing(false)
  }, [hotelId, queryClient])

  // Auto-flush when coming back online; clear stale error on disconnect
  useEffect(() => {
    if (!isOnline) { setSyncError(false); return }
    void flush()
  }, [isOnline, flush])

  /** Manually retry a stalled sync (no-op while already syncing or offline). */
  const retrySync = useCallback(() => {
    if (!isOnline || isSyncing) return
    setSyncError(false)
    void flush()
  }, [isOnline, isSyncing, flush])

  /** Discard all pending mutations — operator acknowledges they will be lost. */
  const clearQueue = useCallback(async () => {
    const mutations = await getPendingMutations()
    for (const m of mutations) {
      await removeMutation(m.id)
      notifyQueueChanged()
    }
    setSyncError(false)
    await refreshCount()
  }, [refreshCount])

  return { isOnline, isSyncing, pendingCount, syncError, retrySync, clearQueue }
}

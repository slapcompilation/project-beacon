import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services } from '@/lib/services'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { inventoryKeys } from '@/features/inventory/hooks'
import { restockKeys } from '@/features/restock/hooks'
import { notificationKeys } from '@/features/notifications/hooks'
import { eyeKeys } from '@/features/eye/hooks'
import { briefingKeys } from '@/features/briefing/hooks'
import { useUserPrefs } from '@/features/user/hooks'

function isInQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  // Handle overnight ranges (e.g. 22:00 – 07:00)
  if (startMins > endMins) return nowMins >= startMins || nowMins <= endMins
  return nowMins >= startMins && nowMins <= endMins
}

/**
 * Opens Supabase Realtime subscriptions for the active hotel.
 * On any remote change, the relevant TanStack Query caches are invalidated
 * so all components refresh automatically — no polling needed.
 *
 * Mount this once inside AppLayout so it's active for all authenticated routes.
 * Uses useActiveHotelId so subscriptions re-bind when the hotel switcher changes.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId = useAuthStore((s) => s.userId)
  const { data: prefs } = useUserPrefs()
  // Keep refs so effect closures read latest values without re-subscribing
  const prefsRef = useRef(prefs)
  const userIdRef = useRef(userId)
  useEffect(() => { prefsRef.current = prefs }, [prefs])
  useEffect(() => { userIdRef.current = userId }, [userId])

  useEffect(() => {
    if (!hotelId) return

    const filter = `hotel_id=eq.${hotelId}`

    const unsubs = [
      // ── Products / variants ──────────────────────────────────────────────────
      services.realtime.subscribe('products', '*', () => {
        void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId) })
      }, filter),

      // product_variants has no hotel_id column (scope inherited via parent products);
      // applying `hotel_id=eq.X` here triggers Postgres "invalid column for filter".
      // RLS already gates visibility by the parent product's hotel, so subscribe globally.
      services.realtime.subscribe('product_variants', '*', () => {
        void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId) })
      }),

      // ── Stock logs ───────────────────────────────────────────────────────────
      // Surgical invalidation: only bust queries that directly depend on stock_logs.
      // Analytical queries (PMS health, chain benchmarks, CPOR, supplier synthesis,
      // GL exports, etc.) have their own staleTime and are NOT stock-derived —
      // busting them here caused 15-25 concurrent refetches per stock adjustment.
      services.realtime.subscribe('stock_logs', 'INSERT', (payload) => {
        void queryClient.invalidateQueries({ queryKey: inventoryKeys.products(hotelId) })
        void queryClient.invalidateQueries({ queryKey: ['monitor', 'activity', hotelId] })
        void queryClient.invalidateQueries({ queryKey: ['recent-activity', hotelId] })
        void queryClient.invalidateQueries({ queryKey: ['stock-movement-report', hotelId] })
        void queryClient.invalidateQueries({ queryKey: ['audit-log', hotelId] })
        // Eye — only stock-derived analytics
        void queryClient.invalidateQueries({ queryKey: eyeKeys.wasteRadar(hotelId) })
        void queryClient.invalidateQueries({ queryKey: ['eye', 'consumption-stats', hotelId] })
        void queryClient.invalidateQueries({ queryKey: ['eye', 'forecast', hotelId] })
        void queryClient.invalidateQueries({ queryKey: ['eye', 'spikes', hotelId] })
        void queryClient.invalidateQueries({ queryKey: ['eye', 'dead-stock', hotelId] })
        // Mind — only waste cost is stock-derived
        void queryClient.invalidateQueries({ queryKey: ['mind', 'waste-cost', hotelId] })
        // Briefing feed: stock changes affect low_stock / waste_spike actions
        void queryClient.invalidateQueries({ queryKey: briefingKeys.actions(hotelId) })

        const row = (payload as { new?: { user_id?: string; quantity_change?: number; is_revert?: boolean } }).new
        if (row?.user_id && row.user_id !== userIdRef.current && !row.is_revert) {
          const delta = row.quantity_change ?? 0
          toast.info(
            `Stock ${delta > 0 ? 'added' : 'removed'} by another user (${delta > 0 ? '+' : ''}${String(delta)})`,
            { duration: 3000 }
          )
        }
      }, filter),

      // ── Restock requests ─────────────────────────────────────────────────────
      // Also invalidates briefing: proposal approvals remove the action from the feed.
      services.realtime.subscribe('restock_requests', '*', () => {
        void queryClient.invalidateQueries({ queryKey: restockKeys.all(hotelId) })
        void queryClient.invalidateQueries({ queryKey: briefingKeys.actions(hotelId) })
      }, filter),

      // ── Stocktake lines ──────────────────────────────────────────────────────
      // Lets multiple users counting simultaneously see each other's progress.
      services.realtime.subscribe('stocktake_lines', 'UPDATE', () => {
        void queryClient.invalidateQueries({ queryKey: ['stocktake-lines'] })
      }, filter),

      // ── Notifications ────────────────────────────────────────────────────────
      // Invalidates badge + fires browser push if permitted and not in quiet hours.
      services.realtime.subscribe('notifications', 'INSERT', (payload) => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all(hotelId) })
        const msg = (payload as { new?: { message?: string } }).new?.message
        const p = prefsRef.current
        const quiet = isInQuietHours(p?.quiet_hours_start ?? null, p?.quiet_hours_end ?? null)
        if (msg && !quiet && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Beacon', { body: msg, icon: '/favicon.ico' })
        }
      }, filter),

      // ── Alerts ───────────────────────────────────────────────────────────────
      // Keeps the alerts list in Insights · Alerts fresh when auto_create_alerts fires.
      services.realtime.subscribe('alerts', '*', () => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all(hotelId) })
      }, filter),

      // ── Shift handovers ──────────────────────────────────────────────────────
      // Pushes new handover entries to the Flow · Handover tab live.
      services.realtime.subscribe('shift_handovers', 'INSERT', () => {
        void queryClient.invalidateQueries({ queryKey: ['shift-handovers', hotelId] })
      }, filter),

      // ── Purchase orders ──────────────────────────────────────────────────────
      // Keeps the Operations · Operations PO pipeline and Procurement tab fresh.
      services.realtime.subscribe('purchase_orders', '*', () => {
        void queryClient.invalidateQueries({ queryKey: ['mind', 'po-summary', hotelId] })
        void queryClient.invalidateQueries({ queryKey: briefingKeys.actions(hotelId) })
      }, filter),
    ]

    return () => {
      unsubs.forEach((fn) => { fn(); })
    }
  }, [hotelId, queryClient])
}

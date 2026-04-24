import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  autoCreateAlerts,
  fetchNotificationFeedback,
  fetchAlertPreferences,
  upsertAlertPreferences,
} from '../api'
import type { AlertPreferences } from '@beacon/types'

export type TypeFeedback = {
  type: string
  total: number
  /** reason key → count */
  reasons: Record<string, number>
  incorrectRate: number  // 0–100
}

export const notificationKeys = {
  all: (hotelId: string | null) => ['notifications', hotelId] as const,
}

export function useNotifications() {
  const hotelId = useAuthStore((s) => s.hotelId)
  return useQuery({
    queryKey: notificationKeys.all(hotelId),
    queryFn: fetchNotifications,
    enabled: !!hotelId,
    staleTime: 30_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string | null }) =>
      markNotificationRead(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all(hotelId) })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all(hotelId) })
    },
  })
}

export function useAlertPreferences() {
  const hotelId = useAuthStore((s) => s.hotelId)
  return useQuery({
    queryKey: ['alert-preferences', hotelId],
    queryFn:  fetchAlertPreferences,
    enabled:  !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateAlertPreferences() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: (prefs: AlertPreferences) => upsertAlertPreferences(prefs),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alert-preferences', hotelId] })
      toast.success('Alert preferences saved')
    },
    onError: (err: Error) => {
      toast.error(`Failed to save preferences: ${err.message}`)
    },
  })
}

export function useAutoAlerts() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: ({ daysThreshold, wasteThreshold }: { daysThreshold?: number; wasteThreshold?: number }) =>
      autoCreateAlerts(daysThreshold, wasteThreshold),
    onSuccess: (count: number) => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all(hotelId) })
      if (count === 0) {
        toast.success('No new alerts — all conditions look good')
      } else {
        toast.success(`${String(count)} new alert${count !== 1 ? 's' : ''} created`)
      }
    },
    onError: (err: Error) => {
      toast.error(`Alert scan failed: ${err.message}`)
    },
  })
}

export function useNotificationFeedback() {
  const hotelId = useAuthStore((s) => s.hotelId)
  return useQuery({
    queryKey: ['notification-feedback', hotelId],
    queryFn: fetchNotificationFeedback,
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
    select: (rows): TypeFeedback[] => {
      const byType = new Map<string, { total: number; reasons: Record<string, number> }>()
      for (const row of rows) {
        const t = row.type
        if (!byType.has(t)) byType.set(t, { total: 0, reasons: {} })
        const entry = byType.get(t)
        if (!entry) continue
        entry.total++
        const reason = row.dismissed_reason ?? 'none'
        entry.reasons[reason] = (entry.reasons[reason] ?? 0) + 1
      }
      const result: TypeFeedback[] = []
      for (const [type, { total, reasons }] of byType) {
        const incorrectCount = reasons['incorrect_data'] ?? 0
        result.push({ type, total, reasons, incorrectRate: total > 0 ? (incorrectCount / total) * 100 : 0 })
      }
      return result.sort((a, b) => b.total - a.total)
    },
  })
}

export function useUnreadNotificationCount(): number {
  const { data = [] } = useNotifications()
  return useMemo(() => data.filter((n) => !n.read).length, [data])
}

/**
 * Silently runs auto_create_alerts on mount (once per session) and
 * every INTERVAL_MS thereafter. No toast — background refresh only.
 * Call this from any persistent layout component (e.g. DashboardPage, AppShell).
 */
const ALERT_REFRESH_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

export function useSilentAutoAlerts() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  const ranOnce = useRef(false)

  useEffect(() => {
    if (!hotelId) return

    const run = () => {
      // No explicit thresholds — RPC resolves from alert_preferences, then global defaults
      void autoCreateAlerts().then(() => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all(hotelId) })
      }).catch(() => { /* silent — don't surface background errors */ })
    }

    // Run immediately on mount (once per session guard)
    if (!ranOnce.current) {
      ranOnce.current = true
      run()
    }

    // Then re-run on interval
    const id = setInterval(run, ALERT_REFRESH_INTERVAL_MS)
    return () => { clearInterval(id) }
  }, [hotelId, queryClient])
}

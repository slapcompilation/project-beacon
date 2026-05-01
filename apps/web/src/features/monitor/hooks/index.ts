// Layer: Eye — Live Operations Monitor hooks
// useActivityFeed: initial load only. Realtime invalidation is handled centrally
// by useRealtimeSync (stock_logs INSERT → ['monitor', 'activity', hotelId]).
// New events are tracked in `newIds` for 4 s so the UI can animate them in.

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { fetchRecentActivity, fetchCronHealthSummary } from '../api'

export const monitorKeys = {
  activity:    (hotelId: string, limit: number) => ['monitor', 'activity', hotelId, limit] as const,
  cronHealth:  () => ['monitor', 'cron-health'] as const,
}

export function useActivityFeed(limit = 100) {
  const hotelId = useActiveHotelId()

  // Set of log_ids that just arrived — cleared after 4 s for highlight animation
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set())
  const knownIdsRef          = useRef<Set<string>>(new Set())
  const isFirstLoad          = useRef(true)

  const query = useQuery({
    queryKey: monitorKeys.activity(hotelId ?? '', limit),
    queryFn:  () => fetchRecentActivity(limit),
    enabled:  !!hotelId,
    staleTime: 30_000,  // 30s — realtime invalidation handles live updates
  })

  // Detect newly arrived events when data changes
  useEffect(() => {
    if (!query.data) return

    if (isFirstLoad.current) {
      query.data.forEach((e) => knownIdsRef.current.add(e.log_id))
      isFirstLoad.current = false
      return
    }

    const incoming = query.data.filter((e) => !knownIdsRef.current.has(e.log_id))
    if (incoming.length === 0) return

    incoming.forEach((e) => knownIdsRef.current.add(e.log_id))
    const arrivedIds = new Set(incoming.map((e) => e.log_id))
    setNewIds((prev) => new Set([...prev, ...arrivedIds]))

    const timer = setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev)
        arrivedIds.forEach((id) => next.delete(id))
        return next
      })
    }, 4000)

    return () => { clearTimeout(timer) }
  }, [query.data])

  return { ...query, newIds }
}

/**
 * Cron health for the Settings → Autonomous Operations panel.
 * Backed by `get_cron_health_summary()` (admin/owner only — gated server-side).
 * Disabled for non-admin/owner roles to avoid 42501 noise in the console.
 */
export function useCronHealthSummary() {
  const role = useAuthStore((s) => s.role)
  const enabled = role === 'admin' || role === 'owner'
  return useQuery({
    queryKey:  monitorKeys.cronHealth(),
    queryFn:   fetchCronHealthSummary,
    enabled,
    staleTime: 60_000,        // 1 min — the underlying monitor runs every 5 min
    refetchInterval: 60_000,  // refresh while panel is open
  })
}

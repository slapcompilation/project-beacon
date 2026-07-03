// Integration health — reads the unified connector + ingestion-pipeline freshness
// (get_integration_health, migration 190) and classifies each source against the
// operator's tunable SLA. The metric (last-activity age, backlog) comes from the
// DB; the trigger (warn/down/stuck) lives in org policy, honored in code.

import { useQuery } from '@tanstack/react-query'
import {
  classifyIntegrationHealth,
  type IntegrationSourceReading,
  type IntegrationHealthHit,
} from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useMonitorPolicy } from './hooks'

interface HealthRow {
  source_key: string
  label: string
  kind: string
  last_activity_at: string | null
  total_events: number
  pending_count: number | null
  oldest_pending_at: string | null
}

async function fetchHealth(): Promise<IntegrationSourceReading[]> {
  const result = await supabase.rpc('get_integration_health') as unknown as {
    data: HealthRow[] | null; error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []).map((r) => ({
    sourceKey: r.source_key,
    label: r.label,
    kind: r.kind as IntegrationSourceReading['kind'],
    lastActivityAt: r.last_activity_at,
    totalEvents: r.total_events,
    pendingCount: r.pending_count ?? undefined,
    oldestPendingAt: r.oldest_pending_at,
  }))
}

export function useIntegrationHealth() {
  const hotelId = useActiveHotelId()
  const { data: policy } = useMonitorPolicy()
  const rule = policy?.merged.monitors.integration

  const query = useQuery({
    queryKey: ['integration-health', hotelId],
    queryFn: fetchHealth,
    enabled: !!hotelId,
    staleTime: 30_000,
  })

  const readings = query.data ?? []
  const hits: IntegrationHealthHit[] =
    rule && rule.enabled ? readings.map((r) => classifyIntegrationHealth(r, rule)) : []

  return { ...query, readings, hits, rule }
}

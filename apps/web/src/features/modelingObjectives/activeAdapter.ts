// Resolves which adapter the forecast_consumption tool should delegate to.
// Order of preference per org:
//   1. production release for the objective
//   2. staging release
//   3. sandbox release
//   4. objective's defaultAdapter
//   5. undefined → tool falls back to its inline baseline

import { useQuery } from '@tanstack/react-query'
import { useActiveOrgId } from '@/hooks/useActiveOrgId'
import { getObjectiveDescriptor } from './registry'
import { fetchReleases, type ReleaseStage } from './api'
import {
  baselineRolling30dAdapter,
  seasonalNaiveV1Adapter,
  ewmaV1Adapter,
  holtLinearV1Adapter,
  autoSelectV1Adapter,
  type ConsumptionForecastInput,
  type ConsumptionForecastOutput,
  type ModelAdapter,
} from '@beacon/reality-graph'

const STAGE_PRIORITY: ReleaseStage[] = ['production', 'staging', 'sandbox']

const ADAPTERS_BY_NAME: Record<string, ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> | undefined> = {
  [baselineRolling30dAdapter.name]: baselineRolling30dAdapter,
  [seasonalNaiveV1Adapter.name]:    seasonalNaiveV1Adapter,
  [ewmaV1Adapter.name]:             ewmaV1Adapter,
  [holtLinearV1Adapter.name]:       holtLinearV1Adapter,
  [autoSelectV1Adapter.name]:       autoSelectV1Adapter,
}

export function useActiveForecastAdapter(): ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> | undefined {
  const orgId = useActiveOrgId()
  const descriptor = getObjectiveDescriptor('consumption_forecast')

  const { data: releases = [] } = useQuery({
    queryKey: ['mo', 'active-adapter', 'consumption_forecast', orgId ?? ''],
    queryFn:  () => fetchReleases('consumption_forecast', orgId),
    staleTime: 60_000,
  })

  // Highest-priority release first.
  for (const stage of STAGE_PRIORITY) {
    const r = releases.find((rel) => rel.stage === stage)
    if (r) {
      const adapter = ADAPTERS_BY_NAME[r.adapter_name]
      if (adapter && adapter.version === r.adapter_version) return adapter
    }
  }

  // Fallback to the objective's defaultAdapter when nothing is released yet.
  if (descriptor) {
    return ADAPTERS_BY_NAME[descriptor.objective.defaultAdapter]
  }
  return undefined
}

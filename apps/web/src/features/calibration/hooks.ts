import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  computeCalibration,
  orgPolicyToCalibrationOptions,   type CalibrationReport,
} from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useOrgPolicy } from '@/features/mind/policy'
import { fetchResolvedSamples, type ResolvedSample } from './api'

export type CalibrationWindow = 30 | 90 | 0  // 0 = all-time

export interface CalibrationSlice {
  key: string
  report: CalibrationReport
}

export interface DecisionCalibration {
  overall: CalibrationReport
  byAgent: CalibrationSlice[]
  byActionType: CalibrationSlice[]
  totalResolved: number
}

export function useDecisionCalibration(windowDays: CalibrationWindow) {
  const hotelId = useActiveHotelId()
  const { data: policyData } = useOrgPolicy()
  const query = useQuery({
    queryKey: ['calibration', hotelId ?? '', windowDays],
    queryFn:  () => fetchResolvedSamples(hotelId ?? '', windowDays || undefined),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })

  const opts = policyData ? orgPolicyToCalibrationOptions(policyData.merged) : undefined
  const derived = useMemo<DecisionCalibration | null>(() => {
    if (!query.data || !opts) return null
    return deriveCalibration(query.data, opts)
  }, [query.data, opts?.editPenalty, opts?.halfLifeDays, opts?.minSamples])  // eslint-disable-line react-hooks/exhaustive-deps

  return { ...query, calibration: derived, samples: query.data }
}

export type CalibrationOpts = ReturnType<typeof orgPolicyToCalibrationOptions>

/** Scores a sample set under the operator's scoring policy: recent outcomes
 *  weigh more (half-life), an edited-then-approved call is a partial hit. The
 *  page reuses this with draft options to preview a change before saving. */
export function deriveCalibration(samples: ResolvedSample[], opts: CalibrationOpts): DecisionCalibration {
  const overall = computeCalibration(samples, opts)
  return {
    overall,
    byAgent:      sliceBy(samples, (s) => s.agent_name, opts),
    byActionType: sliceBy(samples, (s) => s.action_type, opts),
    totalResolved: overall.resolved + overall.excluded.expired + overall.excluded.pending,
  }
}

function sliceBy(samples: ResolvedSample[], keyOf: (s: ResolvedSample) => string, opts: CalibrationOpts): CalibrationSlice[] {
  const groups = new Map<string, ResolvedSample[]>()
  for (const s of samples) {
    const k = keyOf(s)
    const bucket = groups.get(k)
    if (bucket) bucket.push(s)
    else groups.set(k, [s])
  }
  return [...groups.entries()]
    .map(([key, rows]) => ({ key, report: computeCalibration(rows, opts) }))
    .sort((a, b) => b.report.resolved - a.report.resolved)
}

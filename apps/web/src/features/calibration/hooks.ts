import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  computeCalibration, DEFAULT_CALIBRATION_HALF_LIFE_DAYS, DEFAULT_CALIBRATION_EDIT_PENALTY,
  type CalibrationReport,
} from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
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
  const query = useQuery({
    queryKey: ['calibration', hotelId ?? '', windowDays],
    queryFn:  () => fetchResolvedSamples(hotelId ?? '', windowDays || undefined),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })

  const derived = useMemo<DecisionCalibration | null>(() => {
    if (!query.data) return null
    return deriveCalibration(query.data)
  }, [query.data])

  return { ...query, calibration: derived }
}

// Operator display weights recent outcomes more (decided_at + half-life) and
// discounts edited-then-approved calls to partial hits, so the reliability
// picture is honest about how the agent behaves now. The auto-execution trust
// budget is intentionally left on the raw labels for now.
const DISPLAY_OPTS = {
  halfLifeDays: DEFAULT_CALIBRATION_HALF_LIFE_DAYS,
  editPenalty:  DEFAULT_CALIBRATION_EDIT_PENALTY,
}

function deriveCalibration(samples: ResolvedSample[]): DecisionCalibration {
  const overall = computeCalibration(samples, DISPLAY_OPTS)
  return {
    overall,
    byAgent:      sliceBy(samples, (s) => s.agent_name),
    byActionType: sliceBy(samples, (s) => s.action_type),
    totalResolved: overall.resolved + overall.excluded.expired + overall.excluded.pending,
  }
}

function sliceBy(samples: ResolvedSample[], keyOf: (s: ResolvedSample) => string): CalibrationSlice[] {
  const groups = new Map<string, ResolvedSample[]>()
  for (const s of samples) {
    const k = keyOf(s)
    const bucket = groups.get(k)
    if (bucket) bucket.push(s)
    else groups.set(k, [s])
  }
  return [...groups.entries()]
    .map(([key, rows]) => ({ key, report: computeCalibration(rows, DISPLAY_OPTS) }))
    .sort((a, b) => b.report.resolved - a.report.resolved)
}

// Time-series properties (Tier 5.7) — Foundry attaches a series to an object
// type and gives it three operations: first point, last point, stream points.
// This consumes the first two, which answer the questions asked most often:
// "what is it now" and "how far back does this go".
//
// Registration is config, so a new series appears here with no code change —
// the property key is looked up in time_series_properties by the RPC.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface SeriesPoint {
  at:    string
  value: number
}

export interface SeriesBounds {
  first: SeriesPoint | null
  last:  SeriesPoint | null
}

interface PointResult {
  data:  { at: string; value: number | string }[] | null
  error: { message: string } | null
}

// An unregistered series raises TimeSeries:PropertyNotRegistered. That is a real
// answer for a caller asking about a property this type does not have, so it
// surfaces as "no series" rather than as a thrown error.
function firstRow(result: PointResult): SeriesPoint | null {
  if (result.error) return null
  const row = result.data?.[0]
  return row ? { at: row.at, value: Number(row.value) } : null
}

// Both names are written as LITERALS on purpose. scripts/check-rpcs.mjs and the
// shape audit find callers by matching a literal argument, so a dynamically
// named call is never checked against pg_proc — which is exactly how four
// missing RPCs survived until a webhook hit them. A shared helper taking the
// name as an argument would read tidier and defeat both guards.
async function seriesPoints(typeApiName: string, propertyKey: string, recordId: string): Promise<SeriesBounds> {
  const args = { p_type_api_name: typeApiName, p_property_key: propertyKey, p_record_id: recordId }
  const [first, last] = await Promise.all([
    supabase.rpc('time_series_first_point', args) as unknown as Promise<PointResult>,
    supabase.rpc('time_series_last_point',  args) as unknown as Promise<PointResult>,
  ])
  return { first: firstRow(first), last: firstRow(last) }
}

/** First and last point of one object's series. Null when the series is not
 *  registered for this type, or has no points yet. */
export function useSeriesBounds(typeApiName: string, propertyKey: string, recordId: string | undefined) {
  return useQuery({
    queryKey: ['time-series-bounds', typeApiName, propertyKey, recordId],
    enabled:  !!recordId,
    staleTime: 60_000,
    queryFn:  () => seriesPoints(typeApiName, propertyKey, recordId ?? ''),
  })
}

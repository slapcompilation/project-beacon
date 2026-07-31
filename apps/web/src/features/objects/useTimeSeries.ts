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

async function point(fn: 'time_series_first_point' | 'time_series_last_point',
                     typeApiName: string, propertyKey: string, recordId: string): Promise<SeriesPoint | null> {
  const result = await supabase.rpc(fn, {
    p_type_api_name: typeApiName, p_property_key: propertyKey, p_record_id: recordId,
  }) as unknown as {
    data: { at: string; value: number | string }[] | null
    error: { message: string } | null
  }
  // An unregistered series raises TimeSeries:PropertyNotRegistered. That is a
  // real answer for a caller asking about a property this type does not have,
  // so it surfaces as "no series" rather than as a thrown error.
  if (result.error) return null
  const row = result.data?.[0]
  return row ? { at: row.at, value: Number(row.value) } : null
}

/** First and last point of one object's series. Null when the series is not
 *  registered for this type, or has no points yet. */
export function useSeriesBounds(typeApiName: string, propertyKey: string, recordId: string | undefined) {
  return useQuery({
    queryKey: ['time-series-bounds', typeApiName, propertyKey, recordId],
    enabled:  !!recordId,
    staleTime: 60_000,
    queryFn:  async (): Promise<SeriesBounds> => {
      const [first, last] = await Promise.all([
        point('time_series_first_point', typeApiName, propertyKey, recordId ?? ''),
        point('time_series_last_point',  typeApiName, propertyKey, recordId ?? ''),
      ])
      return { first, last }
    },
  })
}

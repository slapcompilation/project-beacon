// Supabase-backed OccupancyForecastReader for the occupancy_adjusted_forecast tool.
// Reuses the graph reader's stock-log access; adds occupancy context (historical
// mean from occupancy_logs, forward from booking_forecasts, category sensitivity).

import { supabase } from '@/lib/supabase/client'
import type { OccupancyContext, OccupancyForecastReader } from '@beacon/reality-graph'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'

export function makeOccupancyReader(): OccupancyForecastReader {
  const graph = makeSupabaseGraphReader()
  return {
    getStockLogs: (variantId, sinceDays) => graph.getStockLogs(variantId, sinceDays),

    async getOccupancyContext(hotelId, variantId, sinceDays): Promise<OccupancyContext> {
      const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10)
      const today = new Date().toISOString().slice(0, 10)

      const [occ, fwd, variant] = await Promise.all([
        supabase.from('occupancy_logs').select('date, occupancy_pct').eq('hotel_id', hotelId).gte('date', since).order('date'),
        supabase.from('booking_forecasts').select('date, expected_occupancy_pct').eq('hotel_id', hotelId).gt('date', today).order('date'),
        supabase.from('product_variants').select('product:products(category:categories(occupancy_sensitivity))').eq('id', variantId).maybeSingle(),
      ])

      // The whole series — history AND forward. The adapter slices it at `asOf`;
      // handing over a precomputed mean is what let the tool's window drift from
      // the model's.
      const series = [
        ...((occ.data ?? []) as Array<{ date: string; occupancy_pct: number }>)
          .map((r) => ({ date: r.date, pct: r.occupancy_pct })),
        ...((fwd.data ?? []) as Array<{ date: string; expected_occupancy_pct: number }>)
          .map((r) => ({ date: r.date, pct: r.expected_occupancy_pct })),
      ]

      const v = variant.data as { product?: { category?: { occupancy_sensitivity?: number | null } | null } | null } | null
      const sensitivity = v?.product?.category?.occupancy_sensitivity ?? 0.5

      return { series, sensitivity }
    },
  }
}

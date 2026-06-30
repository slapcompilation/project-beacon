// Occupancy-adjusted demand for a variant, via the occupancy_adjusted_forecast
// Logic Tool (UI→tool.invoke, the sanctioned path — no predictive math in the UI).

import { useQuery } from '@tanstack/react-query'
import { makeOccupancyAdjustedForecastTool, type OccupancyAdjustedForecastOutput } from '@beacon/reality-graph'
import { makeOccupancyReader } from '@/features/inventory/api/occupancyReader'

export function useOccupancyAdjustedForecast(variantId: string | null, hotelId: string | null, horizonDays = 7) {
  return useQuery({
    queryKey: ['occupancy-adjusted-forecast', variantId ?? '', hotelId ?? '', horizonDays],
    queryFn:  async (): Promise<OccupancyAdjustedForecastOutput | null> => {
      if (!variantId || !hotelId) return null
      return makeOccupancyAdjustedForecastTool(makeOccupancyReader()).invoke({ variantId, hotelId, horizonDays })
    },
    enabled:   !!variantId && !!hotelId,
    staleTime: 60_000,
  })
}

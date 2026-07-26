// Forecast Lab data: pull recent stock logs for the hotel's variants, slice
// them into eval cohorts (perishable vs shelf-stable), and backtest every
// registered consumption_forecast adapter against the held-out last 7 days.
// The same fetched logs power the live runner (run an adapter ad-hoc).

import { useQuery } from '@tanstack/react-query'
import {
  backtestForecastAdapters, CONSUMPTION_FORECAST_ADAPTERS,
  type BacktestCase, type BacktestResult,
} from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

export const FORECAST_ADAPTERS = CONSUMPTION_FORECAST_ADAPTERS
export const HOLDOUT_DAYS = 7

interface VariantRow {
  id: string
  name: string
  products: { name: string; shelf_life_days: number | null } | { name: string; shelf_life_days: number | null }[] | null
}
interface LogRow { id: string; variant_id: string; hotel_id: string; quantity_change: number; timestamp: string }

export interface ForecastLabData {
  result: BacktestResult
  cases: BacktestCase[]
}

async function fetchForecastLab(hotelId: string): Promise<ForecastLabData> {
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString()
  const [{ data: vrows, error: vErr }, { data: lrows, error: lErr }] = await Promise.all([
    supabase.from('product_variants')
      .select('id, name, products!inner(name, shelf_life_days, hotel_id)')
      .eq('products.hotel_id', hotelId).eq('enabled', true)
      .overrideTypes<VariantRow[], { merge: false }>(),
    supabase.from('stock_logs')
      .select('id, variant_id, hotel_id, quantity_change, timestamp')
      .eq('hotel_id', hotelId).gte('timestamp', since)
      .overrideTypes<LogRow[], { merge: false }>(),
  ])
  if (vErr) throw new Error(vErr.message)
  if (lErr) throw new Error(lErr.message)

  const byVariant = new Map<string, BacktestCase['logs'][number][]>()
  for (const l of lrows) {
    const arr = byVariant.get(l.variant_id) ?? []
    arr.push({ id: l.id, variant_id: l.variant_id, hotel_id: l.hotel_id, delta: l.quantity_change, created_at: l.timestamp })
    byVariant.set(l.variant_id, arr)
  }

  const cases: BacktestCase[] = vrows.map((v) => {
    const p = Array.isArray(v.products) ? v.products[0] : v.products
    const productName = p?.name ?? 'item'
    return {
      variantId: v.id,
      label: v.name !== 'Standard' ? `${productName} · ${v.name}` : productName,
      cohort: p?.shelf_life_days != null ? 'Perishable' : 'Shelf-stable',
      logs: byVariant.get(v.id) ?? [],
    }
  })

  const result = await backtestForecastAdapters(FORECAST_ADAPTERS, cases, { holdoutDays: HOLDOUT_DAYS })
  return { result, cases }
}

export function useForecastLab() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['forecast-lab', hotelId ?? ''],
    queryFn:  () => fetchForecastLab(hotelId ?? ''),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

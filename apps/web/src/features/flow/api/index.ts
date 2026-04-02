// Layer: Flow — variant timeline API
import { supabase } from '@/lib/supabase/client'

export interface TimelineRow {
  log_id:           string
  happened_at:      string
  actor_email:      string | null
  actor_id:         string | null
  variant_name:     string
  product_name:     string
  sku:              string
  unit_cost:        number
  par_level:        number
  quantity_change:  number
  balance_after:    number
  reason:           string
  removal_category: string | null
  is_revert:        boolean
  revert_of:        string | null
  was_offline:      boolean
  photo_url:        string | null
  cost_impact:      number
}

export async function fetchVariantTimeline(
  variantId: string,
  days: number = 90,
): Promise<TimelineRow[]> {
  const { data, error } = await supabase.rpc('get_variant_timeline', {
    p_variant_id: variantId,
    p_days: days,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as TimelineRow[]
}

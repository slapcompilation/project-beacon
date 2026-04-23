// Layer: Flow — variant timeline + shift handover API
import { supabase } from '@/lib/supabase/client'
import type { ShiftHandover, HandoverFlaggedItem } from '@beacon/types'

export type { ShiftHandover, HandoverFlaggedItem }

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

export async function fetchShiftHandovers(limit = 10): Promise<ShiftHandover[]> {
  const result = await supabase.rpc('get_shift_handovers', { p_limit: limit }) as unknown as { data: ShiftHandover[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function createShiftHandover(payload: {
  window_hours: number
  started_at:   string
  notes:        string | null
  flagged_items: HandoverFlaggedItem[]
}): Promise<void> {
  const { error } = await supabase
    .from('shift_handovers')
    .insert({
      window_hours:  payload.window_hours,
      started_at:    payload.started_at,
      notes:         payload.notes,
      flagged_items: payload.flagged_items,
    })
  if (error) throw new Error(error.message)
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

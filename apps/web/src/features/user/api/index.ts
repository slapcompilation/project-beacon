import { supabase } from '@/lib/supabase/client'
import type { UserPreferences } from '@beacon/types'

// Full preferences shape (mirrors types/UserPreferences + alert thresholds)
export interface FullUserPrefs extends UserPreferences {
  /** Days-until-zero threshold that triggers a low-stock alert (default 7) */
  low_stock_days_threshold: number
  /** Minimum units wasted before a waste alert fires (default 10) */
  waste_alert_threshold: number
}

const DEFAULTS: FullUserPrefs = {
  theme: 'system',
  compact_view: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  default_view: 'dashboard',
  language: 'en',
  date_format: 'dd/MM/yyyy',
  low_stock_days_threshold: 7,
  waste_alert_threshold: 10,
}

export async function fetchUserPrefs(userId: string): Promise<FullUserPrefs> {
  const { data, error } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .single()

  if (error) throw new Error(error.message)
  const raw = (data.preferences ?? {}) as Record<string, unknown>

  return {
    theme:                   (raw.theme as FullUserPrefs['theme'])      ?? DEFAULTS.theme,
    compact_view:            (raw.compact_view as boolean)              ?? DEFAULTS.compact_view,
    quiet_hours_start:       (raw.quiet_hours_start as string | null)   ?? DEFAULTS.quiet_hours_start,
    quiet_hours_end:         (raw.quiet_hours_end as string | null)     ?? DEFAULTS.quiet_hours_end,
    default_view:            (raw.default_view as string)               ?? DEFAULTS.default_view,
    language:                (raw.language as string)                   ?? DEFAULTS.language,
    date_format:             (raw.date_format as string)                ?? DEFAULTS.date_format,
    low_stock_days_threshold:(raw.low_stock_days_threshold as number)   ?? DEFAULTS.low_stock_days_threshold,
    waste_alert_threshold:   (raw.waste_alert_threshold as number)      ?? DEFAULTS.waste_alert_threshold,
  }
}

export async function updateUserPrefs(
  userId: string,
  patch: Partial<FullUserPrefs>
): Promise<void> {
  // Read-modify-write to preserve fields we're not patching
  const currentResult = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .single() as { data: { preferences: Record<string, unknown> | null } | null; error: unknown }

  const merged = { ...(currentResult.data?.preferences ?? {}), ...patch }

  const { error } = await supabase
    .from('profiles')
    .update({ preferences: merged })
    .eq('id', userId)

  if (error) throw new Error(error.message)
}

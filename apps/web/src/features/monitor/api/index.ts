// Layer: Eye — Live Operations Monitor API

import { supabase } from '@/lib/supabase/client'
import type { ActivityEvent } from '@beacon/types'

export async function fetchRecentActivity(limit: number): Promise<ActivityEvent[]> {
  const result = await supabase.rpc('get_recent_activity', { p_limit: limit }) as unknown as {
    data: ActivityEvent[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

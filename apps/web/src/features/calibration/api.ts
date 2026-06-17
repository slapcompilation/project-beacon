// Calibration surface data. One read: the resolved proposals (anything past
// pending) for the hotel, narrowed to what the reliability math needs. The
// page slices these by agent/action and runs reality-graph's computeCalibration
// — same descriptive-aggregation pattern as bandByConfidence in the queue.

import { supabase } from '@/lib/supabase/client'
import type { CalibrationSample } from '@beacon/reality-graph'

export interface ResolvedSample extends CalibrationSample {
  agent_name: string
  action_type: string
}

export async function fetchResolvedSamples(
  hotelId: string,
  windowDays?: number,
): Promise<ResolvedSample[]> {
  let q = supabase
    .from('proposals')
    .select('confidence, status, agent_name, action_type, decided_at')
    .eq('hotel_id', hotelId)
    .neq('status', 'pending')
    .limit(5000)

  if (typeof windowDays === 'number') {
    const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString()
    q = q.gte('created_at', cutoff)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data.map((r) => ({
    confidence: Number(r.confidence),
    status: r.status as CalibrationSample['status'],
    decidedAt: r.decided_at as string | null,
    agent_name: r.agent_name as string,
    action_type: r.action_type as string,
  }))
}

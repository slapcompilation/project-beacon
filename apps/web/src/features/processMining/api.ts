// Process mining (P11, Foundry Machinery parity) — reads the lifecycle transition
// event log through mine_process() (migration 208) into a state machine with
// per-state and per-transition metrics.

import { supabase } from '@/lib/supabase/client'
import type { LifecycleNode } from '@beacon/reality-graph'

export interface ProcessState {
  state:          string
  entered_count:  number
  current_count:  number
  exited_count:   number
  avg_duration_s: number | null
}

export interface ProcessTransition {
  from:            string
  to:              string
  count:           number
  avg_lead_time_s: number | null
}

export interface MinedProcess {
  states:      ProcessState[]
  transitions: ProcessTransition[]
}

const EMPTY: MinedProcess = { states: [], transitions: [] }

export async function fetchMinedProcess(nodeType: LifecycleNode, hotelId: string): Promise<MinedProcess> {
  const { data, error } = await supabase.rpc('mine_process', {
    p_node_type: nodeType,
    p_hotel_id:  hotelId,
  }) as unknown as { data: MinedProcess | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data ?? EMPTY
}

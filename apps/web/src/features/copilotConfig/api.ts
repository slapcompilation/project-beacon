// copilot_tool_configs — per-hotel allowlist for the copilot's tool surface.
//
// The edge function loads the row at the start of each request and filters
// its TOOLS array to exclude any name in disabled_tools. Absence of a row
// means "all tools enabled".

import { supabase } from '@/lib/supabase/client'

export interface CopilotToolConfigRow {
  hotel_id:            string
  organization_id:     string | null
  disabled_tools:      string[]
  updated_by_user_id:  string | null
  updated_at:          string
}

export async function fetchCopilotConfig(hotelId: string): Promise<CopilotToolConfigRow | null> {
  const { data, error } = await supabase
    .from('copilot_tool_configs')
    .select('*')
    .eq('hotel_id', hotelId)
    .maybeSingle<CopilotToolConfigRow>()
  if (error) throw new Error(error.message)
  return data
}

export interface UpsertCopilotConfigInput {
  hotelId:           string
  disabledTools:     string[]
  updatedByUserId:   string
}

export async function upsertCopilotConfig(input: UpsertCopilotConfigInput): Promise<CopilotToolConfigRow> {
  const { data, error } = await supabase
    .from('copilot_tool_configs')
    .upsert(
      {
        hotel_id:           input.hotelId,
        disabled_tools:     input.disabledTools,
        updated_by_user_id: input.updatedByUserId,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: 'hotel_id' },
    )
    .select('*')
    .single<CopilotToolConfigRow>()
  if (error) throw new Error(error.message)
  return data
}

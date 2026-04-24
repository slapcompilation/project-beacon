import { supabase } from '@/lib/supabase/client'
import type { Hotel } from '@beacon/types'

export async function fetchAccessibleHotels(): Promise<Hotel[]> {
  const { data, error } = await supabase.from('hotels').select('*').order('name')
  if (error) throw new Error(error.message)
  return data as Hotel[]
}

export interface HotelProfileInput {
  name: string
  address: string
  timezone: string
  currency: string
}

export async function updateHotelProfile(id: string, input: HotelProfileInput): Promise<void> {
  const { error } = await supabase
    .from('hotels')
    .update({
      name:     input.name,
      address:  input.address,
      timezone: input.timezone,
      currency: input.currency,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export interface AutonomousSettingsInput {
  auto_approve_threshold: number
  auto_po_enabled: boolean
  auto_invoice_tolerance_pct: number
}

export async function updateAutonomousSettings(id: string, input: AutonomousSettingsInput): Promise<void> {
  const { error } = await supabase
    .from('hotels')
    .update({
      auto_approve_threshold:     input.auto_approve_threshold,
      auto_po_enabled:            input.auto_po_enabled,
      auto_invoice_tolerance_pct: input.auto_invoice_tolerance_pct,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateHotelConfig(key: string, value: unknown): Promise<void> {
  const { error } = await supabase.rpc('update_hotel_config', {
    p_key: key,
    p_value: value,
  })
  if (error) throw new Error(error.message)
}

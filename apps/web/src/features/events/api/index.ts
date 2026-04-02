// Layer: Mind — Events API
// CRUD for hotel events used by the Event Demand Planner.

import { supabase } from '@/lib/supabase/client'

export interface HotelEvent {
  id: string
  hotel_id: string
  name: string
  event_date: string   // ISO date YYYY-MM-DD
  guest_count: number
  event_type: string
  demand_factor: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EventInput {
  name: string
  event_date: string
  guest_count: number
  event_type: string
  demand_factor: number
  notes?: string | null
}

export async function fetchEvents(hotelId: string): Promise<HotelEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('event_date', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as HotelEvent[]
}

export async function createEvent(hotelId: string, input: EventInput): Promise<HotelEvent> {
  const { data, error } = await supabase
    .from('events')
    .insert({ hotel_id: hotelId, ...input })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as HotelEvent
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<HotelEvent> {
  const { data, error } = await supabase
    .from('events')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as HotelEvent
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

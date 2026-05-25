// approved_answers — tier-1 cache served before fresh LLM calls.

import { supabase } from '@/lib/supabase/client'

export interface ApprovedAnswerRow {
  id:                  string
  hotel_id:            string
  organization_id:     string | null
  question:            string
  answer:              string
  embedding_ref:       string | null
  hit_count:           number
  last_served_at:      string | null
  source_message_id:   string | null
  curated_by_user_id:  string
  created_at:          string
  retired_at:          string | null
}

export async function fetchApprovedAnswers(hotelId: string): Promise<ApprovedAnswerRow[]> {
  const { data, error } = await supabase
    .from('approved_answers')
    .select('*')
    .eq('hotel_id', hotelId)
    .is('retired_at', null)
    .order('hit_count', { ascending: false })
    .order('created_at', { ascending: false })
    .overrideTypes<ApprovedAnswerRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export interface CreateApprovedAnswerInput {
  hotelId:           string
  organizationId?:   string | null
  question:          string
  answer:            string
  sourceMessageId?:  string | null
  curatedByUserId:   string
}

export async function createApprovedAnswer(input: CreateApprovedAnswerInput): Promise<ApprovedAnswerRow> {
  const { data, error } = await supabase
    .from('approved_answers')
    .insert({
      hotel_id:            input.hotelId,
      organization_id:     input.organizationId ?? null,
      question:            input.question,
      answer:              input.answer,
      source_message_id:   input.sourceMessageId ?? null,
      curated_by_user_id:  input.curatedByUserId,
    })
    .select('*')
    .single<ApprovedAnswerRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function retireApprovedAnswer(id: string): Promise<void> {
  const { error } = await supabase
    .from('approved_answers')
    .update({ retired_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function recordApprovedAnswerHit(id: string): Promise<void> {
  const { error } = await supabase.rpc('record_approved_answer_hit', { p_id: id })
  if (error) throw new Error(error.message)
}

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
  // Embed the question (best-effort) so the new semantic match RPC can
  // serve it. Failure leaves embedding NULL — the cache row still works
  // for manual browsing and exact-match curation.
  let embedding: string | null = null
  try {
    const embedResp = await supabase.functions.invoke<{ embeddings: number[][] }>('embed-text', {
      body: { texts: [input.question] },
    })
    const vec = embedResp.data?.embeddings[0]
    if (vec && vec.length > 0) embedding = `[${vec.join(',')}]`
  } catch {
    // swallow — embedding is opportunistic
  }

  const { data, error } = await supabase
    .from('approved_answers')
    .insert({
      hotel_id:            input.hotelId,
      organization_id:     input.organizationId ?? null,
      question:            input.question,
      answer:              input.answer,
      source_message_id:   input.sourceMessageId ?? null,
      curated_by_user_id:  input.curatedByUserId,
      embedding,
    })
    .select('*')
    .single<ApprovedAnswerRow>()
  if (error) throw new Error(error.message)
  return data
}

// ─── Semantic match (Phase 14.b) ────────────────────────────────────────────

export interface ApprovedAnswerMatch {
  id:         string
  question:   string
  answer:     string
  similarity: number
}

interface MatchApprovedRow {
  id:         string
  question:   string
  answer:     string
  similarity: number
}

/** Embeds the query via embed-text, then calls match_approved_answers RPC
 *  for server-side cosine similarity ranking. Returns the top matches above
 *  the threshold (default 0.78). */
export async function matchApprovedAnswers(args: {
  hotelId:    string
  query:      string
  threshold?: number
  limit?:     number
}): Promise<ApprovedAnswerMatch[]> {
  const embedResp = await supabase.functions.invoke<{ embeddings: number[][] }>('embed-text', {
    body: { texts: [args.query] },
  })
  const vec = embedResp.data?.embeddings[0]
  if (!vec || vec.length === 0) return []

  const result = await supabase.rpc('match_approved_answers', {
    p_hotel_id:  args.hotelId,
    p_query:     `[${vec.join(',')}]`,
    p_threshold: args.threshold ?? 0.78,
    p_limit:     args.limit     ?? 5,
  }) as { data: MatchApprovedRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
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

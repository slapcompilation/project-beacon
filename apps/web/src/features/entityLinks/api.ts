// entity_link_suggestions — LLM-proposed describes_entity edges awaiting
// operator approval. The entity-extract edge function writes; this page
// reads + decides.

import { supabase } from '@/lib/supabase/client'
import type { EntityNodeType } from '@/features/documents/api'

export type EntityLinkStatus = 'pending' | 'approved' | 'rejected' | 'superseded'

export interface EntityLinkSuggestionRow {
  id:                  string
  hotel_id:            string
  organization_id:     string | null
  document_id:         string
  chunk_key:           string | null
  entity_type:         EntityNodeType
  entity_id:           string
  confidence:          number
  reasoning:           string
  evidence_snippet:    string | null
  status:              EntityLinkStatus
  resulting_edge_id:   string | null
  decided_by_user_id:  string | null
  decided_at:          string | null
  created_at:          string
}

export interface EntityLinkSuggestionEnriched extends EntityLinkSuggestionRow {
  document_title: string | null
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function fetchPendingSuggestions(hotelId: string): Promise<EntityLinkSuggestionEnriched[]> {
  const { data, error } = await supabase
    .from('entity_link_suggestions')
    .select('*, document:documents(title)')
    .eq('hotel_id', hotelId)
    .eq('status', 'pending')
    .order('confidence', { ascending: false })
    .order('created_at', { ascending: false })
    .overrideTypes<Array<EntityLinkSuggestionRow & { document: { title: string | null } | null }>, { merge: false }>()
  if (error) throw new Error(error.message)
  return data.map((r) => ({ ...r, document_title: r.document?.title ?? null }))
}

export async function fetchSuggestionsForDocument(documentId: string): Promise<EntityLinkSuggestionRow[]> {
  const { data, error } = await supabase
    .from('entity_link_suggestions')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .overrideTypes<EntityLinkSuggestionRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

// ─── Auto-extract (calls the edge function) ─────────────────────────────────

export interface AutoExtractResponse {
  inserted:    number
  considered?: number
  threshold?:  number
  tokens_used?: number
  message?:    string
}

export async function autoExtractEntityLinks(documentId: string, threshold?: number): Promise<AutoExtractResponse> {
  const result = await supabase.functions.invoke<AutoExtractResponse>('entity-extract', {
    body: { document_id: documentId, threshold },
  }) as { data: AutoExtractResponse | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Error('entity-extract returned no data')
  return result.data
}

// ─── Decisions ──────────────────────────────────────────────────────────────

export interface ApproveSuggestionInput {
  id:          string
  hotelId:     string
  documentId:  string
  entityType:  EntityNodeType
  entityId:    string
  actorId:     string | null
}

/** Approves a suggestion by writing the describes_entity edge into
 *  relationship_edges, then marking the suggestion 'approved' with a
 *  pointer to the new edge. */
export async function approveSuggestion(input: ApproveSuggestionInput): Promise<void> {
  const { data: edge, error: edgeErr } = await supabase
    .from('relationship_edges')
    .insert({
      hotel_id:     input.hotelId,
      edge_type:    'describes_entity',
      source_type:  'document',
      source_id:    input.documentId,
      target_type:  input.entityType,
      target_id:    input.entityId,
      triggered_by: 'ai_proposal_accepted',
      actor_id:     input.actorId,
    })
    .select('id')
    .single() as unknown as { data: { id: string } | null; error: { message: string } | null }
  if (edgeErr) throw new Error(edgeErr.message)

  const { error: updateErr } = await supabase
    .from('entity_link_suggestions')
    .update({
      status:             'approved',
      resulting_edge_id:  edge?.id ?? null,
      decided_by_user_id: input.actorId,
      decided_at:         new Date().toISOString(),
    })
    .eq('id', input.id)
  if (updateErr) throw new Error(updateErr.message)
}

export async function rejectSuggestion(id: string, actorId: string | null): Promise<void> {
  const { error } = await supabase
    .from('entity_link_suggestions')
    .update({
      status:             'rejected',
      decided_by_user_id: actorId,
      decided_at:         new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

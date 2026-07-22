// Documents — typed file storage with provenance fields.
//
// Upload flow: client uploads bytes to the private 'documents' bucket under
// `<hotel_id>/<uuid>-<filename>`, then writes a documents row pointing at
// that path. Reads happen via signed URLs scoped per request — never via
// public URLs because contracts / invoices are sensitive.

import { supabase } from '@/lib/supabase/client'

export type DocumentSource = 'upload' | 'email' | 'integration' | 'ocr-capture'
export type IngestionStage = 'raw' | 'ocr' | 'embedded' | 'contextualized' | 'linked'
export type Sensitivity = 'public' | 'internal' | 'confidential' | 'restricted'
export type PIIType = 'email' | 'phone' | 'credit_card' | 'iban'

export interface DocumentChunk {
  chunk_id:     string
  page:         number
  text_preview: string
}

export interface DocumentRow {
  id:                   string
  hotel_id:             string
  organization_id:      string | null
  title:                string
  mime_type:            string
  source:               DocumentSource
  ingestion_stage:      IngestionStage
  bucket_name:          string
  storage_path:         string
  size_bytes:           number
  page_count:           number | null
  chunks:               DocumentChunk[] | null
  sensitivity:          Sensitivity
  pii_types:            PIIType[]
  uploaded_by_user_id:  string
  created_at:           string
  updated_at:           string
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function fetchDocuments(hotelId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .overrideTypes<DocumentRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchDocument(id: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle<DocumentRow>()
  if (error) throw new Error(error.message)
  return data
}

/** Generates a short-lived signed URL operators can use to view/download
 *  the file in the browser. Expires in `expiresInSec` seconds. */
export async function createSignedDocumentUrl(
  storagePath: string,
  expiresInSec = 600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, expiresInSec)
  if (error) throw new Error(error.message)
  if (!data.signedUrl) throw new Error('No signed URL returned')
  return data.signedUrl
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export interface UploadDocumentInput {
  hotelId:        string
  organizationId?: string | null
  file:           File
  title?:         string
  source?:        DocumentSource
  /** Operator's base classification; the ingest scanner can raise it if it finds PII. */
  sensitivity?:   Sensitivity
  uploadedByUserId: string
}

export interface UploadDocumentResult {
  row:  DocumentRow
  path: string
}

/** Uploads bytes to the documents bucket, then inserts a row. Path layout:
 *    <hotel_id>/<uuid>-<safe-filename>
 *  Hotel-id prefix lets ops bulk-clean a tenant without touching others. */
export async function uploadDocument(input: UploadDocumentInput): Promise<UploadDocumentResult> {
  const id          = crypto.randomUUID()
  const safeName    = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${input.hotelId}/${id}-${safeName}`
  const title       = (input.title ?? input.file.name).trim()

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, input.file, {
      contentType: input.file.type || 'application/octet-stream',
      upsert:      false,
    })
  if (uploadError) throw new Error(uploadError.message)

  const { data, error: insertError } = await supabase
    .from('documents')
    .insert({
      hotel_id:            input.hotelId,
      organization_id:     input.organizationId ?? null,
      title,
      mime_type:           input.file.type || 'application/octet-stream',
      source:              input.source ?? 'upload',
      sensitivity:         input.sensitivity ?? 'internal',
      bucket_name:         'documents',
      storage_path:        storagePath,
      size_bytes:          input.file.size,
      uploaded_by_user_id: input.uploadedByUserId,
    })
    .select('*')
    .single<DocumentRow>()

  if (insertError) {
    // Best-effort cleanup: remove the orphaned blob if the row insert failed.
    await supabase.storage.from('documents').remove([storagePath]).catch(() => { /* ignore */ })
    throw new Error(insertError.message)
  }

  return { row: data, path: storagePath }
}

/** Reclassify a document. RLS gates this to users cleared for the doc's current
 *  level, so an under-cleared user can't lower a restricted doc to read it. */
export async function updateDocumentSensitivity(id: string, sensitivity: Sensitivity): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ sensitivity })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteDocument(id: string, storagePath: string): Promise<void> {
  const { error: removeError } = await supabase.storage.from('documents').remove([storagePath])
  if (removeError) throw new Error(removeError.message)

  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
  if (deleteError) throw new Error(deleteError.message)
}

// ─── Ingestion (Phase 16.b) ──────────────────────────────────────────────────

export interface IngestDocumentResponse {
  document_id: string
  chunks:      DocumentChunk[]
  page_count:  number
  tokens_used: number
  stage:       IngestionStage
}

/** Runs the document-ingest edge function: Anthropic vision OCR for pdf +
 *  jpeg/png/webp/gif. Persists chunks back to the row and lifts
 *  ingestion_stage from 'raw' to 'ocr'. Returns the parsed chunks for
 *  immediate inline rendering. */
export async function ingestDocument(documentId: string): Promise<IngestDocumentResponse> {
  const result = await supabase.functions.invoke<IngestDocumentResponse>('document-ingest', {
    body: { document_id: documentId },
  }) as { data: IngestDocumentResponse | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Error('document-ingest returned no data')
  return result.data
}

// ─── describes_entity edges (Phase 16.b) ────────────────────────────────────

export type EntityNodeType =
  | 'variant'
  | 'supplier'
  | 'purchase_order'
  | 'restock_request'
  | 'product'
  | 'hotel'
  | 'organization'
  | 'case'

export interface DescribesEntityEdgeRow {
  id:          string
  source_id:   string
  target_id:   string
  target_type: EntityNodeType
  created_at:  string
}

export async function linkDocumentToEntity(args: {
  documentId:  string
  entityType:  EntityNodeType
  entityId:    string
  hotelId:     string
  actorId:     string | null
}): Promise<void> {
  const { error } = await supabase
    .from('relationship_edges')
    .insert({
      hotel_id:     args.hotelId,
      edge_type:    'describes_entity',
      source_type:  'document',
      source_id:    args.documentId,
      target_type:  args.entityType,
      target_id:    args.entityId,
      triggered_by: 'user',
      actor_id:     args.actorId,
    })
  if (error) throw new Error(error.message)
}

export async function fetchDocumentEntityLinks(documentId: string): Promise<DescribesEntityEdgeRow[]> {
  const { data, error } = await supabase
    .from('relationship_edges')
    .select('id, source_id, target_id, target_type, created_at')
    .eq('source_type', 'document')
    .eq('source_id', documentId)
    .eq('edge_type', 'describes_entity')
    .order('created_at', { ascending: false })
    .overrideTypes<DescribesEntityEdgeRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export async function unlinkDocumentFromEntity(edgeId: string): Promise<void> {
  const { error } = await supabase
    .from('relationship_edges')
    .delete()
    .eq('id', edgeId)
  if (error) throw new Error(error.message)
}

// ─── Reverse document lineage (P10) ─────────────────────────────────────────
// Which documents reference an operational node (supplier/variant), and how:
//   'described' — an approved describes_entity edge (human-curated)
//   'mentioned' — auto-resolved via entity (resolved_to → mentions → chunk)
// Backed by the documents_referencing_node RPC (migration 206).

export interface ReferencingDocument {
  document_id:     string
  document_title:  string
  ingestion_stage: IngestionStage
  link_kind:       'described' | 'mentioned'
  page:            number | null
  snippet:         string | null
}

export async function fetchDocumentsForNode(
  hotelId:  string,
  nodeType: 'supplier' | 'variant',
  nodeId:   string,
): Promise<ReferencingDocument[]> {
  const { data, error } = await supabase.rpc('documents_referencing_node', {
    p_hotel_id:  hotelId,
    p_node_type: nodeType,
    p_node_id:   nodeId,
  }) as unknown as { data: ReferencingDocument[] | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data ?? []
}

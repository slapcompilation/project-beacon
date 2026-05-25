// Documents — typed file storage with provenance fields.
//
// Upload flow: client uploads bytes to the private 'documents' bucket under
// `<hotel_id>/<uuid>-<filename>`, then writes a documents row pointing at
// that path. Reads happen via signed URLs scoped per request — never via
// public URLs because contracts / invoices are sensitive.

import { supabase } from '@/lib/supabase/client'

export type DocumentSource = 'upload' | 'email' | 'integration' | 'ocr-capture'
export type IngestionStage = 'raw' | 'ocr' | 'embedded' | 'contextualized' | 'linked'

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

export async function deleteDocument(id: string, storagePath: string): Promise<void> {
  const { error: removeError } = await supabase.storage.from('documents').remove([storagePath])
  if (removeError) throw new Error(removeError.message)

  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
  if (deleteError) throw new Error(deleteError.message)
}

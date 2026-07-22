import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import {
  createSignedDocumentUrl,
  deleteDocument,
  fetchDocument,
  fetchDocumentEntityLinks,
  fetchDocuments,
  fetchDocumentsForNode,
  ingestDocument,
  linkDocumentToEntity,
  unlinkDocumentFromEntity,
  uploadDocument,
  updateDocumentSensitivity,
  type DocumentRow,
  type DocumentSource,
  type Sensitivity,
  type EntityNodeType,
} from './api'

export const documentKeys = {
  list:   (hotelId: string) => ['documents', 'list', hotelId] as const,
  detail: (id: string)      => ['documents', 'detail', id]    as const,
}

export function useDocuments() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: documentKeys.list(hotelId ?? ''),
    queryFn:  () => (hotelId ? fetchDocuments(hotelId) : Promise.resolve([] as DocumentRow[])),
    enabled:  !!hotelId,
    staleTime: 30_000,
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn:  () => fetchDocument(id),
    enabled:  !!id,
    staleTime: 30_000,
  })
}

export function useSignedDocumentUrl(storagePath: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'signed-url', storagePath ?? ''],
    queryFn:  () => (storagePath ? createSignedDocumentUrl(storagePath, 600) : Promise.resolve('')),
    enabled:  !!storagePath,
    // Signed URLs are short-lived; refresh every 5 minutes.
    staleTime: 5 * 60_000,
  })
}

export function useUploadDocument() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: async (args: { file: File; title?: string; source?: DocumentSource; sensitivity?: Sensitivity }) => {
      if (!hotelId || !userId) throw new Error('Missing context')
      return uploadDocument({
        hotelId,
        file:              args.file,
        title:             args.title,
        source:            args.source,
        sensitivity:       args.sensitivity,
        uploadedByUserId:  userId,
      })
    },
    onSuccess: () => {
      toast.success('Document uploaded')
      void qc.invalidateQueries({ queryKey: documentKeys.list(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteDocument() {
  const hotelId = useActiveHotelId()
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: (args: { id: string; storagePath: string }) =>
      deleteDocument(args.id, args.storagePath),
    onSuccess: () => {
      toast.success('Document deleted')
      void qc.invalidateQueries({ queryKey: documentKeys.list(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateDocumentSensitivity(documentId: string) {
  const hotelId = useActiveHotelId()
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: (sensitivity: Sensitivity) => updateDocumentSensitivity(documentId, sensitivity),
    onSuccess: () => {
      toast.success('Classification updated')
      void qc.invalidateQueries({ queryKey: documentKeys.detail(documentId) })
      void qc.invalidateQueries({ queryKey: documentKeys.list(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Ingestion + entity linking ──────────────────────────────────────────────

export function useIngestDocument(documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => ingestDocument(documentId),
    onSuccess: (res) => {
      toast.success(`Ingested ${String(res.page_count)} page(s) · ${String(res.tokens_used)} tokens`)
      void qc.invalidateQueries({ queryKey: documentKeys.detail(documentId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export const documentLinkKeys = {
  list: (documentId: string) => ['documents', 'entity-links', documentId] as const,
}

export function useDocumentEntityLinks(documentId: string) {
  return useQuery({
    queryKey: documentLinkKeys.list(documentId),
    queryFn:  () => fetchDocumentEntityLinks(documentId),
    enabled:  !!documentId,
    staleTime: 60_000,
  })
}

export function useLinkDocumentToEntity(documentId: string) {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: async (args: { entityType: EntityNodeType; entityId: string }) => {
      if (!hotelId) throw new Error('No active hotel')
      return linkDocumentToEntity({
        documentId,
        entityType: args.entityType,
        entityId:   args.entityId,
        hotelId,
        actorId:    userId,
      })
    },
    onSuccess: () => {
      toast.success('Linked')
      void qc.invalidateQueries({ queryKey: documentLinkKeys.list(documentId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUnlinkDocumentFromEntity(documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (edgeId: string) => unlinkDocumentFromEntity(edgeId),
    onSuccess: () => {
      toast.success('Unlinked')
      void qc.invalidateQueries({ queryKey: documentLinkKeys.list(documentId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// Reverse lineage: documents referencing a supplier/variant (P10).
export function useDocumentsForNode(nodeType: 'supplier' | 'variant', nodeId: string | undefined) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['documents-for-node', nodeType, nodeId, hotelId],
    queryFn:  () => (hotelId && nodeId
      ? fetchDocumentsForNode(hotelId, nodeType, nodeId)
      : Promise.resolve([])),
    enabled:  !!hotelId && !!nodeId,
    staleTime: 120_000,
  })
}

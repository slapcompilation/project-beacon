import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import {
  approveSuggestion,
  autoExtractEntityLinks,
  fetchPendingSuggestions,
  fetchSuggestionsForDocument,
  rejectSuggestion,
  type EntityLinkSuggestionEnriched,
  type EntityLinkSuggestionRow,
} from './api'

export const entityLinkKeys = {
  pending:    (hotelId: string)    => ['entity-links', 'pending',    hotelId] as const,
  byDocument: (documentId: string) => ['entity-links', 'by-document', documentId] as const,
}

export function usePendingEntityLinkSuggestions() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: entityLinkKeys.pending(hotelId ?? ''),
    queryFn:  () => (hotelId ? fetchPendingSuggestions(hotelId) : Promise.resolve([] as EntityLinkSuggestionEnriched[])),
    enabled:  !!hotelId,
    staleTime: 30_000,
  })
}

export function useSuggestionsForDocument(documentId: string) {
  return useQuery({
    queryKey: entityLinkKeys.byDocument(documentId),
    queryFn:  () => fetchSuggestionsForDocument(documentId),
    enabled:  !!documentId,
    staleTime: 30_000,
  })
}

export function useAutoExtractEntityLinks(documentId: string) {
  const hotelId = useActiveHotelId()
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: () => autoExtractEntityLinks(documentId),
    onSuccess: (res) => {
      toast.success(`${String(res.inserted)} suggestion(s) added`)
      void qc.invalidateQueries({ queryKey: entityLinkKeys.byDocument(documentId) })
      void qc.invalidateQueries({ queryKey: entityLinkKeys.pending(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useApproveSuggestion() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: async (row: EntityLinkSuggestionRow) => {
      if (!hotelId) throw new Error('Missing hotel context')
      return approveSuggestion({
        id:          row.id,
        hotelId,
        documentId:  row.document_id,
        entityType:  row.entity_type,
        entityId:    row.entity_id,
        actorId:     userId,
      })
    },
    onSuccess: (_void, row) => {
      toast.success('Link approved')
      void qc.invalidateQueries({ queryKey: entityLinkKeys.pending(hotelId ?? '') })
      void qc.invalidateQueries({ queryKey: entityLinkKeys.byDocument(row.document_id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRejectSuggestion() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: (row: EntityLinkSuggestionRow) => rejectSuggestion(row.id, userId),
    onSuccess: (_void, row) => {
      toast.success('Rejected')
      void qc.invalidateQueries({ queryKey: entityLinkKeys.pending(hotelId ?? '') })
      void qc.invalidateQueries({ queryKey: entityLinkKeys.byDocument(row.document_id) })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

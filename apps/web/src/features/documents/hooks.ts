import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import {
  createSignedDocumentUrl,
  deleteDocument,
  fetchDocument,
  fetchDocuments,
  uploadDocument,
  type DocumentRow,
  type DocumentSource,
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
    mutationFn: async (args: { file: File; title?: string; source?: DocumentSource }) => {
      if (!hotelId || !userId) throw new Error('Missing context')
      return uploadDocument({
        hotelId,
        file:              args.file,
        title:             args.title,
        source:            args.source,
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

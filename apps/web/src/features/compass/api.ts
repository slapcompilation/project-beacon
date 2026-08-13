// The folder tree and trash — Compass slice C1. Folders organize and never
// gate (the reading's load-bearing find); markings flow through the chain in
// the database; here we only carry rows.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface Folder {
  id: string
  parentFolderId: string | null
  name: string
  trashedAt: string | null
}

export interface FiledResource {
  kind: 'dataset' | 'restricted_view'
  id: string
  name: string
  folderId: string | null
  trashedAt: string | null
}

const keys = {
  folders: (p: string) => ['folders', p] as const,
  filed: (p: string) => ['filed-resources', p] as const,
}

export function useFolders(projectId: string | null) {
  return useQuery({
    queryKey: keys.folders(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async (): Promise<Folder[]> => {
      const { data, error } = await supabase.from('folders')
        .select('id, parent_folder_id, name, trashed_at')
        .eq('project_id', projectId ?? '').order('name')
      if (error) throw new Error(error.message)
      return (data as { id: string; parent_folder_id: string | null; name: string; trashed_at: string | null }[])
        .map((r) => ({ id: r.id, parentFolderId: r.parent_folder_id, name: r.name, trashedAt: r.trashed_at }))
    },
    staleTime: 15_000,
  })
}

export function useFiledResources(projectId: string | null) {
  return useQuery({
    queryKey: keys.filed(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async (): Promise<FiledResource[]> => {
      const [ds, rv] = await Promise.all([
        supabase.from('datasets').select('id, name, folder_id, trashed_at').eq('project_id', projectId ?? ''),
        supabase.from('restricted_views').select('id, name, folder_id, trashed_at').eq('project_id', projectId ?? ''),
      ])
      if (ds.error) throw new Error(ds.error.message)
      if (rv.error) throw new Error(rv.error.message)
      const row = (kind: FiledResource['kind']) =>
        (r: { id: string; name: string; folder_id: string | null; trashed_at: string | null }): FiledResource =>
          ({ kind, id: r.id, name: r.name, folderId: r.folder_id, trashedAt: r.trashed_at })
      type Raw = { id: string; name: string; folder_id: string | null; trashed_at: string | null }
      return [
        ...(ds.data as Raw[]).map(row('dataset')),
        ...(rv.data as Raw[]).map(row('restricted_view')),
      ]
    },
    staleTime: 15_000,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  void qc.invalidateQueries({ queryKey: keys.folders(projectId) })
  void qc.invalidateQueries({ queryKey: keys.filed(projectId) })
}

export function useCreateFolder(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { name: string; parentFolderId: string | null }) => {
      const { error } = await supabase.from('folders')
        .insert({ project_id: projectId, name: i.name, parent_folder_id: i.parentFolderId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(qc, projectId); toast.success('Folder created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Trash and restore are one timestamp: restore places it where it was. */
export function useSetTrashed(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { table: 'folders' | 'datasets' | 'restricted_views'; id: string; trashed: boolean }) => {
      const { error } = await supabase.from(i.table)
        .update({ trashed_at: i.trashed ? new Date().toISOString() : null })
        .eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, i) => { invalidate(qc, projectId); toast.success(i.trashed ? 'Moved to trash' : 'Restored in place') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useMoveToFolder(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { table: 'datasets' | 'restricted_views'; id: string; folderId: string | null }) => {
      const { error } = await supabase.from(i.table)
        .update({ folder_id: i.folderId }).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(qc, projectId) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function usePermanentDelete(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { table: 'folders' | 'datasets' | 'restricted_views'; id: string }) => {
      const { error } = await supabase.from(i.table).delete().eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(qc, projectId); toast.success('Permanently deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

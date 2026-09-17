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
  /** "You can add documentation to any folder" — markdown, the
   *  Add-description route (migration 676). NULL = none. */
  documentation: string | null
  trashedAt: string | null
}

export interface FiledResource {
  /** Whatever kind the index holds. NOT a union: `project_resources`'
   *  resource_kind is function-backed (`filesystem_resource_kinds()`), so
   *  gen:client asks it at runtime rather than emitting a closed set — and a
   *  fifteenth kind reaches this listing the day its table gains the trigger. */
  kind: string
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
        .select('id, parent_folder_id, name, documentation, trashed_at')
        .eq('project_id', projectId ?? '').order('name')
      if (error) throw new Error(error.message)
      return (data as { id: string; parent_folder_id: string | null; name: string; documentation: string | null; trashed_at: string | null }[])
        .map((r) => ({ id: r.id, parentFolderId: r.parent_folder_id, name: r.name, documentation: r.documentation, trashedAt: r.trashed_at }))
    },
    staleTime: 15_000,
  })
}

export function useFiledResources(projectId: string | null) {
  return useQuery({
    queryKey: keys.filed(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async (): Promise<FiledResource[]> => {
      // One read of the index, where there used to be one fetch per kind
      // hand-written here — datasets and restricted_views, with the other
      // twelve kinds that carry a folder_id invisible because nobody added a
      // third branch. 812 made `project_resources` the index Foundry publishes
      // (identity and placement, no payload) and put a trigger on every table
      // that carries placement, so this is now a single select.
      const { data, error } = await supabase
        .from('project_resources')
        .select('resource_kind, resource_id, name, folder_id, trashed_at')
        .eq('project_id', projectId ?? '')
        .order('name')
      if (error) throw new Error(error.message)
      return (data as {
        resource_kind: string; resource_id: string; name: string | null
        folder_id: string | null; trashed_at: string | null
      }[]).map((r) => ({
        kind: r.resource_kind,
        id: r.resource_id,
        name: r.name ?? r.resource_id,
        folderId: r.folder_id,
        trashedAt: r.trashed_at,
      }))
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
    // A folder is a container, not an indexed resource, so it keeps its own
    // update; everything else goes through the owning table by kind.
    mutationFn: async (i: { kind: string; id: string; trashed: boolean }) => {
      if (i.kind === 'folder') {
        const { error } = await supabase.from('folders')
          .update({ trashed_at: i.trashed ? new Date().toISOString() : null })
          .eq('id', i.id)
        if (error) throw new Error(error.message)
        return
      }
      const { error } = await supabase.rpc('set_filesystem_resource_trashed', {
        p_kind: i.kind, p_id: i.id, p_trashed: i.trashed,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, i) => { invalidate(qc, projectId); toast.success(i.trashed ? 'Moved to trash' : 'Restored in place') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
export function useMoveToFolder(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { kind: string; id: string; folderId: string | null }) => {
      const { error } = await supabase.rpc('move_filesystem_resource', {
        p_kind: i.kind, p_id: i.id, p_folder: i.folderId,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(qc, projectId) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
export function usePermanentDelete(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { kind: string; id: string }) => {
      if (i.kind === 'folder') {
        const { error } = await supabase.from('folders').delete().eq('id', i.id)
        if (error) throw new Error(error.message)
        return
      }
      const { error } = await supabase.rpc('delete_filesystem_resource', {
        p_kind: i.kind, p_id: i.id,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(qc, projectId); toast.success('Permanently deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSetFolderDocumentation(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id: string; documentation: string | null }) => {
      const { error } = await supabase.from('folders')
        .update({ documentation: i.documentation }).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(qc, projectId); toast.success('Description saved') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}


/** The Activity log: "a running view of changes made throughout the Project
 *  and is only visible at the Project level" — so this hook takes a project
 *  and nothing narrower. Written by 641's triggers; the daily retention job
 *  keeps the last month, so no client-side windowing is needed. */
export interface ActivityRow {
  id: string
  actor: string | null
  action: string
  resourceKind: string
  resourceName: string | null
  occurredAt: string
}

export function useProjectActivity(projectId: string | null) {
  return useQuery({
    queryKey: ['compass', 'activity', projectId],
    enabled: projectId !== null,
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase.from('project_activity')
        .select('id, actor, action, resource_kind, resource_name, occurred_at')
        .eq('project_id', projectId ?? '')
        .order('occurred_at', { ascending: false }).limit(100)
      if (error) throw new Error(error.message)
      return (data as { id: string; actor: string | null; action: string; resource_kind: string; resource_name: string | null; occurred_at: string }[])
        .map((r) => ({ id: r.id, actor: r.actor, action: r.action,
          resourceKind: r.resource_kind, resourceName: r.resource_name,
          occurredAt: r.occurred_at }))
    },
  })
}

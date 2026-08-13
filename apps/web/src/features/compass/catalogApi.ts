// The catalog layer's hooks: tags ("categorization and discovery... not
// security"), collections ("curated data for a given topic, audience, or
// purpose"), and Promoted status.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface TagCategory { id: string; name: string }
export interface TagRow { id: string; categoryId: string; name: string }
export interface Collection { id: string; name: string; description: string | null }
export interface CuratedResource {
  kind: 'project' | 'folder' | 'dataset' | 'restricted_view'
  id: string
  name: string
  promoted: boolean
  tags: string[]
}

const keys = {
  categories: ['tag-categories'] as const,
  tags: ['tags'] as const,
  collections: ['collections'] as const,
  contents: (c: string) => ['collection-contents', c] as const,
  files: ['catalog-files'] as const,
}

export function useTagCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: async (): Promise<TagCategory[]> => {
      const { data, error } = await supabase.from('tag_categories').select('id, name').order('name')
      if (error) throw new Error(error.message)
      return data as TagCategory[]
    },
    staleTime: 30_000,
  })
}

export function useTags() {
  return useQuery({
    queryKey: keys.tags,
    queryFn: async (): Promise<TagRow[]> => {
      const { data, error } = await supabase.from('tags').select('id, category_id, name').order('name')
      if (error) throw new Error(error.message)
      return (data as { id: string; category_id: string; name: string }[])
        .map((r) => ({ id: r.id, categoryId: r.category_id, name: r.name }))
    },
    staleTime: 30_000,
  })
}

export function useCreateTagCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('tag_categories').insert({ name })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.categories }); toast.success('Tag category created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { categoryId: string; name: string }) => {
      const { error } = await supabase.from('tags').insert({ category_id: i.categoryId, name: i.name })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.tags }); toast.success('Tag added') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "You cannot undo delete actions, and the category or tag will be removed
 *  from all resources." */
export function useDeleteTagEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { table: 'tag_categories' | 'tags'; id: string }) => {
      const { error } = await supabase.from(i.table).delete().eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries(); toast.success('Deleted — removed from all resources') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useCollections() {
  return useQuery({
    queryKey: keys.collections,
    queryFn: async (): Promise<Collection[]> => {
      const { data, error } = await supabase.from('collections')
        .select('id, name, description').order('name')
      if (error) throw new Error(error.message)
      return data as Collection[]
    },
    staleTime: 30_000,
  })
}

export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { name: string; description: string }) => {
      const { error } = await supabase.from('collections')
        .insert({ name: i.name, description: i.description || null })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.collections }); toast.success('Collection created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useAddToCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { collectionId: string; kind: CuratedResource['kind']; resourceId: string }) => {
      const { error } = await supabase.from('collection_resources')
        .insert({ collection_id: i.collectionId, resource_kind: i.kind, resource_id: i.resourceId })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, i) => { void qc.invalidateQueries({ queryKey: keys.contents(i.collectionId) }); toast.success('Added to collection') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The catalog's file list: datasets and restricted views with their tags
 *  and Promoted status; promoted first, the documented boost. */
export function useCatalogFiles() {
  return useQuery({
    queryKey: keys.files,
    queryFn: async (): Promise<CuratedResource[]> => {
      const [ds, rv, rt, tg] = await Promise.all([
        supabase.from('datasets').select('id, name, promoted').is('trashed_at', null),
        supabase.from('restricted_views').select('id, name, promoted'),
        supabase.from('resource_tags').select('tag_id, resource_kind, resource_id'),
        supabase.from('tags').select('id, name'),
      ])
      for (const r of [ds, rv, rt, tg]) if (r.error) throw new Error(r.error.message)
      const tagName = new Map((tg.data as { id: string; name: string }[]).map((t) => [t.id, t.name]))
      const tagsOf = (kind: string, id: string) =>
        (rt.data as { tag_id: string; resource_kind: string; resource_id: string }[])
          .filter((r) => r.resource_kind === kind && r.resource_id === id)
          .map((r) => tagName.get(r.tag_id) ?? '')
      const rows: CuratedResource[] = [
        ...(ds.data as { id: string; name: string; promoted: boolean }[])
          .map((r) => ({ kind: 'dataset' as const, id: r.id, name: r.name, promoted: r.promoted, tags: tagsOf('dataset', r.id) })),
        ...(rv.data as { id: string; name: string; promoted: boolean }[])
          .map((r) => ({ kind: 'restricted_view' as const, id: r.id, name: r.name, promoted: r.promoted, tags: tagsOf('restricted_view', r.id) })),
      ]
      return rows.sort((a, b) => Number(b.promoted) - Number(a.promoted) || a.name.localeCompare(b.name))
    },
    staleTime: 15_000,
  })
}

export function useCollectionContents(collectionId: string | null) {
  return useQuery({
    queryKey: keys.contents(collectionId ?? ''),
    enabled: !!collectionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('collection_resources')
        .select('resource_kind, resource_id').eq('collection_id', collectionId ?? '')
      if (error) throw new Error(error.message)
      return data as { resource_kind: CuratedResource['kind']; resource_id: string }[]
    },
    staleTime: 15_000,
  })
}

/** The context-menu Change status → Promoted, as a toggle. */
export function useSetPromoted() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { table: 'datasets' | 'restricted_views' | 'projects' | 'folders'; id: string; promoted: boolean }) => {
      const { error } = await supabase.from(i.table).update({ promoted: i.promoted }).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: keys.files })
      toast.success(i.promoted ? 'Promoted — recommended for all users' : 'Status removed')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

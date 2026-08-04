// The Applications portal, as data. W4 of docs/WORKSHOP-PLAN.md.
//
// Foundry's split, kept: a COLLECTION is a section of the portal; a TAG is a
// filterable label on a card. Promotion is its own resource pointing at a
// module, so un-promoting removes the listing and leaves the module alone.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface PromotedApp {
  promotionId:        string
  collectionApiName:  string
  collectionTitle:    string
  collectionPosition: number
  moduleApiName:      string
  /** Where the module actually is. */
  moduleVersion:      number
  /** What the portal publishes — the pin. */
  publishedVersion:   number
  name:               string
  icon:               string
  description:        string
  thumbnailUrl:       string | null
  tags:               string[]
  ownerEmail:         string | null
  hotelId:            string | null
}

interface Row {
  promotion_id: string; collection_api_name: string; collection_title: string
  collection_position: number; module_api_name: string; module_version: number
  published_version: number; name: string; icon: string; description: string
  thumbnail_url: string | null; tags: string[]; owner_email: string | null
  hotel_id: string | null
}

export async function fetchPromotedApps(): Promise<PromotedApp[]> {
  // The RPC is a string to PostgREST, so its return type is `any` — narrow at
  // the boundary rather than letting it leak into the portal.
  const result = await supabase.rpc('get_promoted_apps') as unknown as {
    data: Row[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []).map((r) => ({
    promotionId: r.promotion_id,
    collectionApiName: r.collection_api_name,
    collectionTitle: r.collection_title,
    collectionPosition: r.collection_position,
    moduleApiName: r.module_api_name,
    moduleVersion: r.module_version,
    publishedVersion: r.published_version,
    name: r.name, icon: r.icon, description: r.description,
    thumbnailUrl: r.thumbnail_url, tags: r.tags,
    ownerEmail: r.owner_email, hotelId: r.hotel_id,
  }))
}

export function usePromotedApps() {
  return useQuery({ queryKey: ['promoted-apps'], queryFn: fetchPromotedApps, staleTime: 60_000 })
}

export interface CollectionRow { id: string; api_name: string; title: string; position: number }

export function useAppCollections(enabled = true) {
  return useQuery({
    queryKey: ['app-collections'],
    enabled,
    queryFn: async (): Promise<CollectionRow[]> => {
      const { data, error } = await supabase
        .from('app_collections').select('id, api_name, title, position').order('position')
      if (error) throw new Error(error.message)
      return data as CollectionRow[]
    },
  })
}

export interface PromoteInput {
  moduleId:      string
  moduleVersion: number
  collectionId:  string
  name:          string
  icon:          string
  description:   string
  tags:          string[]
  ownerUserId:   string
  hotelId:       string | null
  /** Required since migration 332 — Foundry needs one to promote. */
  thumbnailUrl:  string
}

/** Promote, or re-point an existing promotion at a newer version — Foundry's
 *  "change the resource that a promotion references to release in a controlled
 *  manner". One promotion per module, so this upserts. */
export function usePromoteModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: PromoteInput) => {
      const { error } = await supabase.from('app_promotions').upsert({
        module_id: i.moduleId, module_version: i.moduleVersion,
        collection_id: i.collectionId, name: i.name, icon: i.icon,
        description: i.description, tags: i.tags,
        owner_user_id: i.ownerUserId, hotel_id: i.hotelId,
        thumbnail_url: i.thumbnailUrl,
      }, { onConflict: 'module_id,organization_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['promoted-apps'] }) },
  })
}

export function useUnpromote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (promotionId: string) => {
      const { error } = await supabase.from('app_promotions').delete().eq('id', promotionId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['promoted-apps'] }) },
  })
}

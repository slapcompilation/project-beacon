// The Ontology — the container everything else in the ontology belongs to.
//
// "value types are associated with a space in the platform. A space can hold a
// single ontology." (object-link-types/value-types-overview) So the drop-down
// "to select between different Ontologies" in Ontology Manager's top-left is a
// SPACE picker, and every object type's Overview names its one in an `Ontology:`
// field.
//
// A space must also serve the caller's organization before an ontology can live
// in it — migration 414, found because an ontology created in an unattached
// space is readable by nobody.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { createSpace } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'

export interface Ontology {
  id: string
  rid: string
  apiName: string
  label: string
  description: string
  spaceId: string
  /** `/Production-3d5c4b` — the first element of every resource path below it. */
  spacePath: string
  spaceName: string
}

interface OntologyRow {
  id: string; rid: string; api_name: string; label: string; description: string
  space_id: string
  spaces: { name: string; path: string } | null
}

const SELECT = 'id, rid, api_name, label, description, space_id, spaces(name, path)'

const rowTo = (r: OntologyRow): Ontology => ({
  id: r.id, rid: r.rid, apiName: r.api_name, label: r.label,
  description: r.description, spaceId: r.space_id,
  spacePath: r.spaces?.path ?? '', spaceName: r.spaces?.name ?? '',
})

export function useOntologies() {
  return useQuery({
    queryKey: ['ontologies'],
    queryFn: async (): Promise<Ontology[]> => {
      const { data, error } = await supabase.from('ontologies').select(SELECT).order('label')
      if (error) throw new Error(error.message)
      return (data as unknown as OntologyRow[]).map(rowTo)
    },
    staleTime: 60_000,
  })
}

/** Spaces this organization is attached to and that hold no ontology yet — the
 *  only places a new one can go, since a space holds exactly one. */
export function useAvailableSpaces() {
  return useQuery({
    queryKey: ['spaces', 'without-ontology'],
    queryFn: async (): Promise<{ id: string; name: string; path: string }[]> => {
      const { data, error } = await supabase
        .from('spaces').select('id, name, path, ontologies(id)').order('name')
      if (error) throw new Error(error.message)
      return (data as unknown as { id: string; name: string; path: string; ontologies: unknown[] }[])
        .filter((s) => s.ontologies.length === 0)
        .map(({ id, name, path }) => ({ id, name, path }))
    },
    staleTime: 60_000,
  })
}

export function useCreateSpace() {
  const qc = useQueryClient()
  return useMutation({
    // One call, not two. Inserting the space and then attaching the organization
    // is refused at the first step: `insert … returning id` makes Postgres apply
    // the SELECT policy too, and that policy reads through `space_organizations`
    // — a row that cannot exist yet. Migration 424.
    mutationFn: (name: string) => client(createSpace).applyAction({ p_name: name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['spaces', 'without-ontology'] })
      toast.success('Space created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useCreateOntology() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { spaceId: string; apiName: string; label: string; description: string }) => {
      const { error } = await supabase.from('ontologies').insert({
        space_id: i.spaceId, api_name: i.apiName, label: i.label, description: i.description,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ontologies'] })
      void qc.invalidateQueries({ queryKey: ['spaces', 'without-ontology'] })
      toast.success('Ontology created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

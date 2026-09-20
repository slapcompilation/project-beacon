// The Security policies section of an object type's Security tab.
//
// "Navigate to the **Security** tab of the object type." then "Select **Create**
// under the **Security policies** section to override data source policies with
// object security policies." (object-permissioning/object-security-policies)
//
// The engine is migrations 821-830; nothing here decides anything. Three states,
// read off the captures rather than invented:
//
//   no policy        one row per datasource, a grey `Datasource policy` tag, Create
//   object policy    the same row, a blue `Object security policy` tag, edit + delete
//   property policy  a named row beneath it, `N Properties`, edit + delete
//
// The object policy's row keeps the datasource's name and link because it
// OVERRODE that datasource's policy — the name is not its key. There is exactly
// one object policy per type (object_security_policies.object_type_id is UNIQUE),
// which is why the list offers only "Add property security policy".

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface PolicyRow {
  id: string
  name: string
  /** The dataset this row is named after, when the policy overrode a datasource. */
  datasetName: string | null
  organizations: number
  markings: number
  /** null on the object policy, which covers "All properties". */
  propertyCount: number | null
}

export interface SecurityPoliciesView {
  /** One per backing datasource, shown only while no object policy exists. */
  datasources: { id: string; label: string; organizations: number }[]
  objectPolicy: PolicyRow | null
  propertyPolicies: PolicyRow[]
}

/** A marking in a policy's Access requirements, with the state the row shows. */
export interface InheritedMarking {
  markingId: string
  name: string
  datasourceId: string
  datasourceLabel: string
  stopped: boolean
}

type PolicyKind = 'object' | 'property'

const stopsTable = (kind: PolicyKind) =>
  kind === 'object' ? 'object_policy_marking_stops' : 'property_policy_marking_stops'
const addsTable = (kind: PolicyKind) =>
  kind === 'object' ? 'object_policy_marking_adds' : 'property_policy_marking_adds'

/** Surfaces the database's refusal rather than a message of our own — the
 *  namespaced errors (Markings:OrganizationMarkingNotSupported,
 *  Markings:CannotMutatePolicyControl, Policies:ObjectPolicyRequired) already say
 *  what went wrong and why. */
const refuse = (e: unknown) => {
  toast.error(e instanceof Error ? e.message : String(e))
  throw e
}

export function useSecurityPolicies(typeId: string) {
  return useQuery({
    queryKey: ['security-policies', typeId],
    queryFn: async (): Promise<SecurityPoliciesView> => {
      const [ds, obj, props] = await Promise.all([
        supabase
          .from('object_type_datasources')
          .select('id, allowed_organizations, datasets(name), restricted_views(name)')
          .eq('object_type_id', typeId),
        supabase
          .from('object_security_policies')
          .select('id, name')
          .eq('object_type_id', typeId)
          .maybeSingle(),
        supabase
          .from('property_security_policies')
          .select('id, name, property_security_policy_properties(property_id)')
          .eq('object_type_id', typeId)
          .order('created_at'),
      ])

      const datasources = ((ds.data ?? []) as unknown as {
        id: string
        allowed_organizations: string[] | null
        datasets: { name: string } | null
        restricted_views: { name: string } | null
      }[]).map((d) => ({
        id: d.id,
        label: d.datasets?.name ?? d.restricted_views?.name ?? 'datasource',
        organizations: d.allowed_organizations?.length ?? 0,
      }))

      const orgs = datasources.reduce((n, d) => n + d.organizations, 0)
      const countMarkings = async (fn: string, id: string) => {
        // rpc() is untyped here, so the cast is at the boundary rather than
        // spread through the caller.
        const res = (await supabase.rpc(fn, { p_policy: id })) as { data: string[] | null }
        return (res.data ?? []).length
      }

      const o = obj.data as unknown as { id: string; name: string } | null
      const objectPolicy: PolicyRow | null = o
        ? {
            id: o.id,
            name: o.name,
            datasetName: datasources[0]?.label ?? null,
            organizations: orgs,
            markings: await countMarkings('object_policy_markings', o.id),
            propertyCount: null,
          }
        : null

      const rows = (props.data ?? []) as unknown as {
        id: string
        name: string
        property_security_policy_properties: { property_id: string }[]
      }[]
      const propertyPolicies = await Promise.all(
        rows.map(async (p) => ({
          id: p.id,
          name: p.name,
          datasetName: null,
          organizations: orgs,
          markings: await countMarkings('property_policy_markings', p.id),
          propertyCount: p.property_security_policy_properties.length,
        })),
      )

      return { datasources, objectPolicy, propertyPolicies }
    },
  })
}

function useInvalidate(typeId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['security-policies', typeId] })
    void qc.invalidateQueries({ queryKey: ['policy-markings'] })
  }
}

/** Step 2: Create, which overrides the datasource policies. One click — the
 *  capture shows a plain button, not a dialog. It is named after the datasource
 *  it overrode, which is what the row then displays. */
export function useCreateObjectPolicy(typeId: string) {
  const done = useInvalidate(typeId)
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('object_security_policies')
        .insert({ object_type_id: typeId, name })
      if (error) refuse(error)
    },
    onSuccess: done,
  })
}

export function useDeleteObjectPolicy(typeId: string) {
  const done = useInvalidate(typeId)
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('object_security_policies').delete().eq('id', id)
      if (error) refuse(error)
    },
    onSuccess: done,
  })
}

/** Step 7: a name and a selection of properties. The primary key cannot be a
 *  member and a property belongs to at most one policy; both are refused by the
 *  database (826) and the refusal is what the toast shows. */
export function useCreatePropertyPolicy(typeId: string) {
  const done = useInvalidate(typeId)
  return useMutation({
    mutationFn: async ({ name, propertyIds }: { name: string; propertyIds: string[] }) => {
      const { data, error } = await supabase
        .from('property_security_policies')
        .insert({ object_type_id: typeId, name })
        .select('id')
        .single()
      if (error) refuse(error)
      const policyId = (data as unknown as { id: string }).id
      if (propertyIds.length) {
        const { error: e2 } = await supabase
          .from('property_security_policy_properties')
          .insert(propertyIds.map((p) => ({
            policy_id: policyId, object_type_id: typeId, property_id: p,
          })))
        if (e2) refuse(e2)
      }
    },
    onSuccess: done,
  })
}

export function useDeletePropertyPolicy(typeId: string) {
  const done = useInvalidate(typeId)
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('property_security_policies').delete().eq('id', id)
      if (error) refuse(error)
    },
    onSuccess: done,
  })
}

/** The Access requirements screen: every marking a datasource contributes, with
 *  the state the row shows — `Inherited` with Stop inheriting, or `Removed` with
 *  Start inheriting. The baseline is computed per datasource because a stop is
 *  recorded per source: "If multiple backing datasets have the same marking
 *  applied, the marking must be listed for each backing dataset or it will still
 *  be inherited." (api/datasets-v2-resources-views-add-backing-datasets) */
export function usePolicyMarkings(kind: PolicyKind, policyId: string | null, typeId: string) {
  return useQuery({
    enabled: !!policyId,
    queryKey: ['policy-markings', kind, policyId],
    queryFn: async (): Promise<{ inherited: InheritedMarking[]; added: { markingId: string; name: string }[] }> => {
      const { data: ds } = await supabase
        .from('object_type_datasources')
        .select('id, datasets(name), restricted_views(name)')
        .eq('object_type_id', typeId)

      const sources = ((ds ?? []) as unknown as {
        id: string; datasets: { name: string } | null; restricted_views: { name: string } | null
      }[]).map((d) => ({ id: d.id, label: d.datasets?.name ?? d.restricted_views?.name ?? 'datasource' }))

      const [{ data: stopRows }, { data: addRows }] = await Promise.all([
        supabase.from(stopsTable(kind)).select('datasource_id, marking_id').eq('policy_id', policyId),
        supabase.from(addsTable(kind)).select('marking_id, markings(name)').eq('policy_id', policyId),
      ])
      const stopped = new Set(
        ((stopRows ?? []) as unknown as { datasource_id: string; marking_id: string }[])
          .map((s) => `${s.datasource_id}:${s.marking_id}`),
      )

      const inherited: InheritedMarking[] = []
      for (const s of sources) {
        const res = (await supabase.rpc('datasource_markings', { p_datasource: s.id })) as { data: string[] | null }
        const ids = res.data ?? []
        if (!ids.length) continue
        const { data: names } = await supabase.from('markings').select('id, name').in('id', ids)
        for (const m of (names ?? []) as unknown as { id: string; name: string }[]) {
          inherited.push({
            markingId: m.id, name: m.name,
            datasourceId: s.id, datasourceLabel: s.label,
            stopped: stopped.has(`${s.id}:${m.id}`),
          })
        }
      }

      const added = ((addRows ?? []) as unknown as { marking_id: string; markings: { name: string } | null }[])
        .map((a) => ({ markingId: a.marking_id, name: a.markings?.name ?? '?' }))

      return { inherited, added }
    },
  })
}

export function useSetInheriting(kind: PolicyKind, typeId: string) {
  const done = useInvalidate(typeId)
  return useMutation({
    mutationFn: async (
      { policyId, datasourceId, markingId, stop }:
      { policyId: string; datasourceId: string; markingId: string; stop: boolean },
    ) => {
      if (stop) {
        const { error } = await supabase.from(stopsTable(kind)).insert({
          policy_id: policyId, object_type_id: typeId,
          datasource_id: datasourceId, marking_id: markingId,
        })
        if (error) refuse(error)
      } else {
        const { error } = await supabase.from(stopsTable(kind)).delete()
          .eq('policy_id', policyId).eq('datasource_id', datasourceId).eq('marking_id', markingId)
        if (error) refuse(error)
      }
    },
    onSuccess: done,
  })
}

/** "further customized to add new mandatory controls" — a control no datasource
 *  supplied. An organization marking is refused here by the database, mirroring
 *  the api's own OrganizationMarkingNotSupported. */
export function useAddPolicyMarking(kind: PolicyKind, typeId: string) {
  const done = useInvalidate(typeId)
  return useMutation({
    mutationFn: async ({ policyId, markingId }: { policyId: string; markingId: string }) => {
      const { error } = await supabase.from(addsTable(kind))
        .insert({ policy_id: policyId, marking_id: markingId })
      if (error) refuse(error)
    },
    onSuccess: done,
  })
}

export function useRemovePolicyMarking(kind: PolicyKind, typeId: string) {
  const done = useInvalidate(typeId)
  return useMutation({
    mutationFn: async ({ policyId, markingId }: { policyId: string; markingId: string }) => {
      const { error } = await supabase.from(addsTable(kind)).delete()
        .eq('policy_id', policyId).eq('marking_id', markingId)
      if (error) refuse(error)
    },
    onSuccess: done,
  })
}

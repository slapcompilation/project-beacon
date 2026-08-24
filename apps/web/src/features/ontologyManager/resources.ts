// What Ontology Manager's chrome counts, searches and links to.
//
// One derived inventory feeds both the sidebar counts and the ⌘K search, so a
// resource kind cannot be countable and unfindable. Every kind here is
// ontology-scoped in the database — object_types, link_types, shared_properties
// and ontology_interfaces each carry a NOT NULL ontology_id — so the counts are
// scoped too. An unscoped count claims another ontology's resources as this
// one's, which is the whole reason the switcher exists.

import { useMemo, type CSSProperties } from 'react'
import type { IconName } from '@blueprintjs/icons'
import type { ObjectTypeDef } from '@beacon/ontology'
import { useAppStore } from '@/stores/app.store'
import { useOntologies, type Ontology } from '@/features/ontologies/api'
import { useObjectTypes, useLinkTypes } from '@/features/objectTypes/hooks'
import { rowToObjectType } from '@/features/objectTypes/api'
import { useBranchChanges } from '@/features/branching/api'
import { overlayRows } from '@/features/branching/overlay'
import { useSharedProperties } from '@/features/objectTypes/sharedProperties'
import { useInterfaces } from '@/features/interfaces/hooks'
import { useActionTypes } from '@/features/actionTypes/api'
import { useFunctions } from '@/features/functions/api'

export type OmaKind = 'Object type' | 'Shared property' | 'Link type' | 'Action type' | 'Interface' | 'Function'

export interface OmaResource {
  key: string
  kind: OmaKind
  label: string
  apiName: string
  /** Everything the search matches on, lowercased: name, API name, RID, aliases. */
  terms: string
  path: string
  icon: IconName
}

/** The `Resources` group, in the screenshot's order minus the entries nothing
 *  backs (those are named in OmaLayout's header comment). `rule` marks where
 *  oma-discover-view.png draws a divider — its second group is
 *  `Value types, Functions`, and we have the second of the two. */
/** The tile colour, handed to CSS as a custom property so one rule can serve
 *  every type. `icon_color` is NOT NULL in the database, so the fallback only
 *  covers a draft that has not been saved yet. */
export function tileStyle(t: { iconColor?: string }): CSSProperties {
  return { '--tile': t.iconColor } as CSSProperties
}

export const RESOURCE_NAV: {
  kind: OmaKind; label: string; icon: IconName; path: string; rule?: true
}[] = [
  { kind: 'Object type', label: 'Object types', icon: 'cube', path: '/ontology/object-types' },
  { kind: 'Shared property', label: 'Shared Properties', icon: 'globe', path: '/ontology/shared-properties' },
  { kind: 'Link type', label: 'Link types', icon: 'arrows-horizontal', path: '/ontology/link-types' },
  { kind: 'Action type', label: 'Action types', icon: 'take-action', path: '/ontology/action-types' },
  { kind: 'Interface', label: 'Interfaces', icon: 'inheritance', path: '/ontology/interfaces' },
  { kind: 'Function', label: 'Functions', icon: 'function', path: '/ontology/functions', rule: true },
]

const ICON_OF: Record<OmaKind, IconName> =
  Object.fromEntries(RESOURCE_NAV.map((r) => [r.kind, r.icon])) as Record<OmaKind, IconName>

/** Where an object type's detail lives. The id travels in the URL so a card, a
 *  search hit and a shared link all land on the same open type. */
export const typePath = (id: string) => `/ontology/object-types?type=${id}`

/** The ontology OMA is pointed at. The id is session state; the row is server
 *  state, so it is resolved here rather than stored. */
export function useOmaOntology(): { ontology: Ontology | null; isLoading: boolean } {
  const id = useAppStore((s) => s.omaOntologyId)
  const { data: ontologies = [], isLoading } = useOntologies()
  return { ontology: ontologies.find((o) => o.id === id) ?? ontologies.at(0) ?? null, isLoading }
}

/** That ontology's object types. An object type's API name is only unique
 *  within one, so this is the only list any OMA page should show. */
export function useOmaTypes(): { types: ObjectTypeDef[]; isLoading: boolean } {
  const { ontology } = useOmaOntology()
  const { data: rows = [], isLoading } = useObjectTypes()
  const branchId = useAppStore((s) => s.omaBranchId)
  const { data: changes = [] } = useBranchChanges(branchId)
  const types = useMemo(() => {
    const mine = rows.filter((r) => r.ontology_id === ontology?.id)
    // On a branch, the list shows the branch's version: 461's overlay
    // composed over main. Created rows carry empty sections until the merge.
    const composed = branchId === null ? mine : overlayRows(mine, changes, 'object_type', {
      ontology_id: ontology?.id ?? '', object_type_properties: [], version: 0, status: 'experimental',
      visibility: 'normal', icon: 'cube', icon_color: '#2D72D2', description: '',
      plural_label: '', point_of_contact: null, contributors: [], track_edit_history: false,
      deprecation_reason: null, deprecation_deadline: null, replaced_by: null,
    } as Partial<typeof mine[number]>)
    return composed.map(rowToObjectType)
  }, [rows, ontology?.id, branchId, changes])
  return { types, isLoading }
}

export function useOmaResources(): OmaResource[] {
  const { ontology } = useOmaOntology()
  const { data: typeRows = [] } = useObjectTypes()
  const { data: shared } = useSharedProperties()
  const { data: linkRows } = useLinkTypes()
  const { data: ifaceRows } = useInterfaces()
  const { data: fnRows = [] } = useFunctions(ontology?.id ?? null)
  const oid = ontology?.id ?? null
  // Already scoped by the query — action_types.ontology_id is NOT NULL.
  const { data: actionRows } = useActionTypes(oid)

  return useMemo(() => {
    const res = (kind: OmaKind, key: string, label: string, apiName: string, path: string, extra = ''): OmaResource =>
      ({ key, kind, label, apiName, path, icon: ICON_OF[kind], terms: `${label} ${apiName} ${extra}`.toLowerCase() })
    return [
      ...typeRows.filter((r) => r.ontology_id === oid).map((r) =>
        res('Object type', `ot:${r.id}`, r.label, r.api_name, typePath(r.id),
          `${r.rid ?? ''} ${(r.aliases ?? []).join(' ')}`)),
      ...shared.filter((s) => s.ontologyId === oid).map((s) =>
        res('Shared property', `sp:${s.id}`, s.label, s.apiName, '/ontology/shared-properties')),
      ...linkRows.filter((l) => l.ontology_id === oid).map((l) =>
        res('Link type', `lt:${l.id}`, l.label, l.api_name, '/ontology/link-types')),
      ...actionRows.map((a) =>
        res('Action type', `at:${a.id}`, a.label, a.api_name, '/ontology/action-types')),
      ...ifaceRows.filter((i) => i.ontology_id === oid).map((i) =>
        res('Interface', `if:${i.id}`, i.label, i.api_name, '/ontology/interfaces', i.rid ?? '')),
      ...fnRows.filter((f) => f.ontology_id === oid).map((f) =>
        res('Function', `fn:${f.id}`, f.display_name, f.api_name, '/ontology/functions')),
    ]
  }, [typeRows, shared, linkRows, actionRows, ifaceRows, fnRows, oid])
}

export const countOf = (resources: OmaResource[], kind: OmaKind) =>
  resources.reduce((n, r) => (r.kind === kind ? n + 1 : n), 0)

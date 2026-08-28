// Section ① of Foundry's object type Overview, which the page names outright:
// "1. Object type metadata" (ontology-manager/overview). Two columns divided by
// a rule — metadata left, a status panel right, with ID and RID below a second
// rule. Field order and every label come from the annotated screenshot and are
// confirmed independently by the course material; see
// readings/object-type-overview.md §2 and §4.
//
// This card is why 415's and 422's columns exist at all. Until it, plural_label,
// point_of_contact, contributors and track_edit_history were stored and read by
// nothing.
import { HTMLSelect, Icon, Tag } from '@blueprintjs/core'
import { useQuery } from '@tanstack/react-query'
import type { ObjectTypeDef, OntologyVisibility } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { indexPhase, useIndexStatuses } from '@/features/objectTypes/indexing'
import { useSetObjectTypeStatus } from '@/features/objectTypes/hooks'

/** auth.users is not exposed to PostgREST; `users` is, with id and email. The
 *  same follow-up read the project members list does, for the same reason. */
function usePeople(ids: string[]) {
  const key = [...new Set(ids)].sort()
  return useQuery({
    queryKey: ['users', key],
    enabled: key.length > 0,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data } = await supabase.from('users').select('id, email').in('id', key)
      return new Map((data as { id: string; email: string }[] | null ?? []).map((u) => [u.id, u.email]))
    },
  })
}

function Person({ id, label }: { id: string; label: string | undefined }) {
  const name = label ?? id.slice(0, 8)
  // Foundry draws initials in a chip — "HB" beside Point of contact.
  const initials = (label ?? '?').replace(/@.*/, '').split(/[.\-_ ]/)
    .map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase()
  return <Tag minimal round title={name}>{initials || name}</Tag>
}

/** The two-column shell: metadata left, a status panel right, ID and RID below
 *  a rule. Shared with the link type view, which draws the same card
 *  (readings/link-type-view.md Decision 2). */
export function MetaShell(
  { left, right, identity }:
  { left: React.ReactNode; right: React.ReactNode; identity: React.ReactNode },
) {
  return (
    <div className="oma-meta">
      <dl className="oma-meta-fields">{left}</dl>
      <div className="oma-meta-side">
        <dl className="oma-meta-fields">{right}</dl>
        <div className="oma-rule" />
        <dl className="oma-meta-fields">{identity}</dl>
      </div>
    </div>
  )
}

export function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground flex items-center gap-1">
        {label}
        {help !== undefined && <Icon icon="help" size={12} title={help} />}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

export function MetadataCard(
  { type, ontologyName, status }:
  { type: ObjectTypeDef; ontologyName: string; status: React.ReactNode },
) {
  const people = usePeople([
    ...(type.pointOfContact !== null && type.pointOfContact !== undefined ? [type.pointOfContact] : []),
    ...(type.contributors ?? []),
  ])
  const { data: indexes } = useIndexStatuses()
  const phase = indexPhase(indexes?.get(type.id))
  const setStatus = useSetObjectTypeStatus()
  const contributors = type.contributors ?? []

  return (
    <MetaShell
      left={<>
        <Row label="Plural name">{type.pluralLabel || <span className="text-muted-foreground">—</span>}</Row>
        <Row label="Description">{type.description || <span className="text-muted-foreground">—</span>}</Row>
        <Row label="Aliases" help="Alternative names (synonyms) for the object type, usable as search terms.">
          {(type.aliases ?? []).length > 0
            ? <span className="flex flex-wrap gap-1">{(type.aliases ?? []).map((a) => <Tag key={a} minimal>{a}</Tag>)}</span>
            : <span className="text-muted-foreground">None</span>}
        </Row>
        <Row label="Point of contact" help="Who to ask about this object type.">
          {type.pointOfContact !== null && type.pointOfContact !== undefined
            ? <Person id={type.pointOfContact} label={people.data?.get(type.pointOfContact)} />
            : <span className="text-muted-foreground">None</span>}
        </Row>
        <Row label="Contributors" help="Who else works on this object type.">
          {contributors.length > 0
            ? <span className="flex flex-wrap gap-1">
                {contributors.map((c) => <Person key={c} id={c} label={people.data?.get(c)} />)}
              </span>
            : <span className="text-muted-foreground">None</span>}
        </Row>
        <Row label="Ontology">{ontologyName}</Row>
        <Row label="API name"><span className="font-mono truncate">{type.apiName}</span></Row>
      </>}
      right={<>
          <Row label="Status">{status}</Row>
          <Row label="Visibility">
            <HTMLSelect minimal value={type.visibility ?? 'normal'}
              onChange={(e) => {
                setStatus.mutate({
                  id: type.id, status: type.status ?? 'experimental',
                  visibility: e.currentTarget.value as OntologyVisibility, deprecation: null,
                })
              }}>
              <option value="prominent">Prominent</option>
              <option value="normal">Normal</option>
              <option value="hidden">Hidden</option>
            </HTMLSelect>
          </Row>
          {/* The course shows a NEW type with no Index status row at all — it
              appears once there is an index to have a status. */}
          {phase !== 'none' && (
            <Row label="Index status">
              {phase === 'ready' ? <Tag minimal>Indexed</Tag>
                : phase === 'refreshing' ? <Tag minimal intent="warning">Indexed · refreshing</Tag>
                : phase === 'failed' ? <Tag minimal intent="danger">Index failed</Tag>
                : <Tag minimal intent="primary">Indexing</Tag>}
            </Row>
          )}
          <Row label="Edits">
            <Tag minimal>{type.trackEditHistory === true ? 'Enabled' : 'Disabled'}</Tag>
          </Row>
      </>}
      identity={<>
        {/* Foundry's ID is a slug distinct from the API name. Ours is the uuid —
            the identifier we actually have, rather than the API name twice. */}
        <Row label="ID"><span className="font-mono truncate">{type.id}</span></Row>
        {/* "RID 'Set on save'" — the course, on a type not yet saved. */}
        <Row label="RID"><span className="font-mono truncate">{type.rid ?? 'Set on save'}</span></Row>
      </>}
    />
  )
}

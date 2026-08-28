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
import { HTMLSelect, Icon, Tag, TagInput } from '@blueprintjs/core'
import { useQuery } from '@tanstack/react-query'
import type { ObjectTypeDef, OntologyVisibility } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { indexPhase, useIndexStatuses } from '@/features/objectTypes/indexing'
import { useSetObjectTypeStatus, useUpdateObjectType } from '@/features/objectTypes/hooks'
import { useUsers } from '@/features/users/api'
import { useTypeGroups, useTypeGroupOps } from '@/features/objectTypes/groups'

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
  const { data: users = [] } = useUsers()
  const update = useUpdateObjectType()
  const { data: groups = [] } = useTypeGroups(type.ontologyId ?? null)
  const groupOps = useTypeGroupOps(type.ontologyId ?? '')
  // One patch shape for the trio: the full identity travels (children are
  // replaced wholesale, so the properties must ride along); the delta overlays.
  const patch = (delta: { aliases?: string[]; pointOfContact?: string | null; contributors?: string[] }) => {
    update.mutate({ id: type.id, label: type.label, icon: type.icon || 'cube',
      description: type.description, properties: type.properties, ...delta })
  }

  return (
    <MetaShell
      left={<>
        <Row label="Plural name">{type.pluralLabel || <span className="text-muted-foreground">—</span>}</Row>
        <Row label="Description">{type.description || <span className="text-muted-foreground">—</span>}</Row>
        {/* Writable since 725 — each edit STAGES, like every ontology edit;
            the top bar's Save lands it. */}
        <Row label="Aliases" help="Alternative names (synonyms) for the object type, usable as search terms.">
          <TagInput values={type.aliases ?? []} placeholder="Add an alias…"
            onChange={(vals) => { patch({ aliases: vals.map(String) }) }} />
        </Row>
        <Row label="Point of contact" help="Who to ask about this object type.">
          <HTMLSelect value={type.pointOfContact ?? ''}
            onChange={(e) => { patch({ pointOfContact: e.currentTarget.value || null }) }}>
            <option value="">None</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </HTMLSelect>
        </Row>
        <Row label="Contributors" help="Who else works on this object type.">
          <span className="flex flex-wrap items-center gap-1">
            {contributors.map((c) => (
              <Tag key={c} minimal onRemove={() => {
                patch({ contributors: contributors.filter((x) => x !== c) })
              }}>{people.data?.get(c) ?? c}</Tag>
            ))}
            <HTMLSelect value=""
              onChange={(e) => {
                const id = e.currentTarget.value
                if (id && !contributors.includes(id)) patch({ contributors: [...contributors, id] })
              }}>
              <option value="">Add…</option>
              {users.filter((u) => !contributors.includes(u.id))
                .map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </HTMLSelect>
          </span>
        </Row>
        {/* The Groups metadata field (object-type-metadata) — its writer at
            last (F6.6): membership here, sections on the Explorer home. */}
        <Row label="Groups" help="Object type groups — the Explorer home renders one section per group.">
          <span className="flex flex-wrap items-center gap-1">
            {groups.filter((g) => g.memberIds.includes(type.id)).map((g) => (
              <Tag key={g.id} minimal onRemove={() => {
                groupOps.removeMember.mutate({ groupId: g.id, objectTypeId: type.id })
              }}>{g.name}</Tag>
            ))}
            <HTMLSelect value=""
              onChange={(e) => {
                const v = e.currentTarget.value
                if (v === '__new__') {
                  const name = window.prompt('New group name')
                  if (name?.trim()) groupOps.create.mutate(name)
                } else if (v) {
                  groupOps.addMember.mutate({ groupId: v, objectTypeId: type.id })
                }
              }}>
              <option value="">Add…</option>
              {groups.filter((g) => !g.memberIds.includes(type.id))
                .map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              <option value="__new__">+ New group…</option>
            </HTMLSelect>
          </span>
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

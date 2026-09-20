// The Security policies section, and the Access requirements dialog behind its
// pencil. Rendered from three captures on object-permissioning/object-security-policies:
// osp-override-datasource-policy (no policy), osp-add-property-security-policy
// (object policy created) and osp-object-security-policy-properties (a property
// policy beneath it).
//
// The tag colour carries the state: a datasource's policy is a plain tag, a
// created policy is a blue one. The object policy's row is named after the
// datasource it overrode and keeps its link; a property policy's name is free
// text and is not a link.

import { useState } from 'react'
import { Button, Callout, Dialog, DialogBody, DialogFooter, Icon, InputGroup, Intent, Tag } from '@blueprintjs/core'
import { primaryKeyOf, type ObjectTypeDef } from '@beacon/ontology'
import { useMarkings } from '@/features/markings/api'
import {
  useSecurityPolicies, useCreateObjectPolicy, useDeleteObjectPolicy,
  useCreatePropertyPolicy, useDeletePropertyPolicy,
  usePolicyMarkings, useSetInheriting, useAddPolicyMarking, useRemovePolicyMarking,
  type PolicyRow,
} from '@/features/objectTypes/securityPolicies'

type Editing = { kind: 'object' | 'property'; id: string; name: string } | null

/** The counts beside a row: an office-building glyph for organizations and a
 *  shield for markings, each omitted at zero as the captures show. */
function Counts({ organizations, markings }: { organizations: number; markings: number }) {
  return (
    <span className="flex items-center gap-3 text-xs">
      {organizations > 0 && (
        <span className="flex items-center gap-1"><Icon icon="office" size={12} />{organizations}</span>
      )}
      {markings > 0 && (
        <span className="flex items-center gap-1"><Icon icon="shield" size={12} />{markings}</span>
      )}
    </span>
  )
}

function PolicyLine({
  row, tag, intent, onEdit, onDelete,
}: {
  row: PolicyRow
  tag: string
  intent: Intent
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded border p-3">
      {row.datasetName ? (
        <span className="flex items-center gap-2">
          <Icon icon="th" size={14} intent={Intent.PRIMARY} />
          <span className="text-sm text-primary">{row.datasetName}</span>
        </span>
      ) : (
        <span className="text-sm">{row.name}</span>
      )}
      <span className="flex-1" />
      <Counts organizations={row.organizations} markings={row.markings} />
      <Tag minimal intent={intent}>{tag}</Tag>
      <span className="text-xs underline">
        {row.propertyCount === null ? 'All properties' : `${row.propertyCount} Properties`}
      </span>
      <Button variant="minimal" size="small" icon="edit" onClick={onEdit} aria-label={`Edit ${row.name}`} />
      <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER} onClick={onDelete} aria-label={`Delete ${row.name}`} />
    </div>
  )
}

export function SecurityPoliciesCard({ type }: { type: ObjectTypeDef }) {
  const { data } = useSecurityPolicies(type.id)
  const createObject = useCreateObjectPolicy(type.id)
  const deleteObject = useDeleteObjectPolicy(type.id)
  const deleteProperty = useDeletePropertyPolicy(type.id)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)

  if (!data) return null
  const { datasources, objectPolicy, propertyPolicies } = data

  return (
    <div className="rounded border">
      <div className="flex items-center gap-2 border-b p-3">
        <Icon icon="eye-open" size={14} />
        <h3 className="text-sm font-semibold">Security policies</h3>
      </div>
      <div className="space-y-3 p-3">
        <p className="text-xs text-muted-foreground">
          Policies can be customized to control who can access data on a conditional basis.
        </p>

        {!objectPolicy && datasources.length === 0 && (
          <Callout intent={Intent.NONE} className="text-xs">
            This object type has no backing datasource, so there is nothing to override yet.
          </Callout>
        )}

        {/* No policy: one row per datasource, and the Create that overrides them. */}
        {!objectPolicy && datasources.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded border p-3">
            <span className="flex items-center gap-2">
              <Icon icon="th" size={14} intent={Intent.PRIMARY} />
              <span className="text-sm text-primary">{d.label}</span>
            </span>
            <span className="flex-1" />
            <Counts organizations={d.organizations} markings={0} />
            <Tag minimal>Datasource policy</Tag>
            <span className="text-xs underline">All properties</span>
            <Button
              size="small"
              loading={createObject.isPending}
              onClick={() => { createObject.mutate(d.label); }}
            >
              Create
            </Button>
          </div>
        ))}

        {objectPolicy && (
          <>
            <PolicyLine
              row={objectPolicy}
              tag="Object security policy"
              intent={Intent.PRIMARY}
              onEdit={() => { setEditing({ kind: 'object', id: objectPolicy.id, name: objectPolicy.name }); }}
              onDelete={() => { deleteObject.mutate(objectPolicy.id); }}
            />
            {propertyPolicies.map((p) => (
              <PolicyLine
                key={p.id}
                row={p}
                tag="Property security policy"
                intent={Intent.PRIMARY}
                onEdit={() => { setEditing({ kind: 'property', id: p.id, name: p.name }); }}
                onDelete={() => { deleteProperty.mutate(p.id); }}
              />
            ))}
            <Button variant="minimal" size="small" icon="plus" intent={Intent.PRIMARY} onClick={() => { setAdding(true); }}>
              Add property security policy
            </Button>
          </>
        )}
      </div>

      {adding && (
        <PropertyPolicyDialog type={type} onClose={() => { setAdding(false); }} />
      )}
      {editing && (
        <AccessRequirementsDialog
          type={type}
          kind={editing.kind}
          policyId={editing.id}
          policyName={editing.name}
          onClose={() => { setEditing(null); }}
        />
      )}
    </div>
  )
}

/** Step 7's screen: a policy name and a selection of properties. The primary key
 *  is not offered, because it "cannot be a member of any property security
 *  policy" — the database refuses it too, and this is the half that stops a user
 *  reaching for it. */
function PropertyPolicyDialog({ type, onClose }: { type: ObjectTypeDef; onClose: () => void }) {
  const create = useCreatePropertyPolicy(type.id)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  // The primary key is not offered: it "cannot be a member of any property
  // security policy", which follows from the null failure mode — nulling a
  // primary key would leave a row with no identity. primaryKeyOf is the
  // canonical accessor; the shape carries no flag to read.
  const pk = primaryKeyOf(type)
  const eligible = type.properties.filter((p) => p.key !== pk?.key)

  return (
    <Dialog isOpen onClose={onClose} title="Compose property security policy">
      <DialogBody>
        <p className="mb-3 text-xs text-muted-foreground">
          A property security policy is a combination of rules that describe which properties can be
          seen by different people.
        </p>
        <label className="mb-1 block text-xs font-semibold">Policy name</label>
        <InputGroup value={name} onChange={(e) => { setName(e.currentTarget.value); }} placeholder="hide PII properties" />
        <label className="mb-1 mt-3 block text-xs font-semibold">Properties</label>
        <div className="flex flex-wrap gap-2">
          {eligible.map((p) => (
            <Tag
              key={p.key}
              interactive
              minimal={!picked.includes(p.key)}
              intent={picked.includes(p.key) ? Intent.PRIMARY : Intent.NONE}
              onClick={() =>
                { setPicked((s) => (s.includes(p.key) ? s.filter((x) => x !== p.key) : [...s, p.key])); }
              }
            >
              {p.label}
            </Tag>
          ))}
          {eligible.length === 0 && (
            <span className="text-xs text-muted-foreground">
              This object type has no property other than its primary key.
            </span>
          )}
        </div>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button variant="minimal" onClick={onClose}>Cancel</Button>
            <Button
              intent={Intent.PRIMARY}
              disabled={!name.trim() || picked.length === 0}
              loading={create.isPending}
              onClick={() =>
                { create.mutate({ name: name.trim(), propertyIds: picked }, { onSuccess: onClose }); }
              }
            >
              Add property security policy
            </Button>
          </>
        }
      />
    </Dialog>
  )
}

/** The Access requirements screen behind the pencil — the Markings slot only.
 *  Each inherited marking shows `Inherited` with Stop inheriting, or `Removed`
 *  with Start inheriting, per datasource, because a stop is recorded per source.
 *
 *  The Granular policy and Organizations slots of the same dialog are not built:
 *  the granular composer is its own arc, and no capture of the Organizations
 *  sub-screen exists in the mirror. */
function AccessRequirementsDialog({
  type, kind, policyId, policyName, onClose,
}: {
  type: ObjectTypeDef
  kind: 'object' | 'property'
  policyId: string
  policyName: string
  onClose: () => void
}) {
  const { data } = usePolicyMarkings(kind, policyId, type.id)
  const setInheriting = useSetInheriting(kind, type.id)
  const addMarking = useAddPolicyMarking(kind, type.id)
  const removeMarking = useRemovePolicyMarking(kind, type.id)
  const all = useMarkings()
  const [picking, setPicking] = useState(false)

  const addedIds = new Set((data?.added ?? []).map((a) => a.markingId))

  return (
    <Dialog isOpen onClose={onClose} title={`Compose ${kind} security policy — ${policyName}`}>
      <DialogBody>
        <h4 className="text-sm font-semibold">Access requirements</h4>
        <p className="mb-3 text-xs text-muted-foreground">Configure changes to access requirements</p>

        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold">Markings</span>
          <span className="text-xs text-muted-foreground">· All of</span>
          <span className="flex-1" />
          <Button variant="minimal" size="small" icon="plus" onClick={() => { setPicking((s) => !s); }}>Add</Button>
        </div>

        {picking && (
          <div className="mb-3 flex flex-wrap gap-2 rounded border p-2">
            {(all.data ?? [])
              .filter((m) => !addedIds.has(m.id))
              .map((m) => (
                <Tag
                  key={m.id}
                  interactive
                  minimal
                  onClick={() =>
                    { addMarking.mutate({ policyId, markingId: m.id }, { onSuccess: () => { setPicking(false); } }); }
                  }
                >
                  {m.name}
                </Tag>
              ))}
          </div>
        )}

        <div className="space-y-2">
          {(data?.inherited ?? []).map((m) => (
            <div key={`${m.datasourceId}:${m.markingId}`} className="flex items-center gap-3 rounded border p-2">
              <Tag minimal icon="shield">{m.name}</Tag>
              <Tag minimal intent={m.stopped ? Intent.DANGER : Intent.NONE}>
                {m.stopped ? 'Removed' : 'Inherited'}
              </Tag>
              <span className="text-xs text-muted-foreground">from {m.datasourceLabel}</span>
              <span className="flex-1" />
              <Button
                size="small"
                onClick={() =>
                  { setInheriting.mutate({
                    policyId, datasourceId: m.datasourceId, markingId: m.markingId, stop: !m.stopped,
                  }); }
                }
              >
                {m.stopped ? 'Start inheriting' : 'Stop inheriting'}
              </Button>
            </div>
          ))}

          {(data?.added ?? []).map((a) => (
            <div key={a.markingId} className="flex items-center gap-3 rounded border p-2">
              <Tag minimal icon="shield">{a.name}</Tag>
              <Tag minimal intent={Intent.PRIMARY}>Added</Tag>
              <span className="flex-1" />
              <Button
                size="small"
                onClick={() => { removeMarking.mutate({ policyId, markingId: a.markingId }); }}
              >
                Remove
              </Button>
            </div>
          ))}

          {!data?.inherited.length && !data?.added.length && (
            <Callout intent={Intent.NONE} className="text-xs">
              No datasource of this object type carries a marking, so there is nothing to inherit yet.
            </Callout>
          )}
        </div>
      </DialogBody>
      <DialogFooter actions={<Button onClick={onClose}>Close</Button>} />
    </Dialog>
  )
}

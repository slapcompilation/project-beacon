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
import { PolicyComposer } from '@/features/restrictedViews/PolicyComposer'
import type { Policy } from '@/features/restrictedViews/api'
import {
  useSecurityPolicies, useCreateObjectPolicy, useDeleteObjectPolicy,
  useCreatePropertyPolicy, useDeletePropertyPolicy,
  usePolicyMarkings, useSetInheriting, useAddPolicyMarking, useRemovePolicyMarking,
  usePolicyFields, useSetPolicyGranular, POLICY_COMPARISONS,
  type PolicyRow,
} from '@/features/objectTypes/securityPolicies'

type Editing = { kind: 'object' | 'property'; row: PolicyRow } | null

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
              onEdit={() => { setEditing({ kind: 'object', row: objectPolicy }); }}
              onDelete={() => { deleteObject.mutate(objectPolicy.id); }}
            />
            {propertyPolicies.map((p) => (
              <PolicyLine
                key={p.id}
                row={p}
                tag="Property security policy"
                intent={Intent.PRIMARY}
                onEdit={() => { setEditing({ kind: 'property', row: p }); }}
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
        <ComposePolicyDialog
          type={type}
          kind={editing.kind}
          row={editing.row}
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

/** The Compose dialog, in the shape osp-permissions-ui-overview.png draws it:
 *  the landing view is an OVERVIEW of two columns — what the datasource demands,
 *  an arrow, and what the policy will demand instead — with the policy side's
 *  slots joined by AND and each manageable one carrying a Manage link to a
 *  breadcrumbed sub-view.
 *
 *  My first version opened straight onto the Markings slot and skipped the
 *  Overview. That hid the arrow, which is the one thing the capture is really
 *  saying: a policy REPLACES the datasource's requirements rather than adding
 *  to them.
 *
 *  ORGANIZATIONS IS NOT BUILT, and the reason I first gave for that was wrong
 *  twice over. I wrote that no capture of its sub-view exists and that the only
 *  published organization removal is per pipeline input. A post-build
 *  reconciliation falsified both:
 *
 *    · step 3 of the page says "You have the option to add a granular policy and
 *      edit the organization and markings", and the Configure mandatory controls
 *      section enumerates organizations as one of the three kinds the two
 *      operations (add, remove-inherited) range over;
 *    · the evidence I used was two CROPS. osp-stop-inheriting-markings.png is
 *      2004x600 and osp-add-marking-property-security-policy.png is 1998x602,
 *      against the same dialog at 2002x1392 in osp-permissions-ui-overview.png.
 *      They end in grey canvas. I asserted what the images do not show.
 *
 *  It is UNBUILT, not unmanageable, and it is blocked on something real: the two
 *  permissions that gate the operations — Apply organization and Expand access —
 *  do not exist anywhere in this platform yet.
 *
 *  The second half of that old sentence was false as built too: an inherited
 *  organization marking does NOT currently reach the policy, because
 *  datasource_markings reads resource_markings and nothing mints an organization
 *  marking into it. Measured: zero. */
function ComposePolicyDialog({
  type, kind, row, onClose,
}: {
  type: ObjectTypeDef
  kind: 'object' | 'property'
  row: PolicyRow
  onClose: () => void
}) {
  const [view, setView] = useState<'overview' | 'markings' | 'granular'>('overview')

  return (
    <Dialog isOpen onClose={onClose} title={`Compose ${kind} security policy`} style={{ width: 760 }}>
      <DialogBody>
        {view !== 'overview' && (
          <div className="mb-3 flex items-center gap-1 text-xs">
            <Button variant="minimal" size="small" onClick={() => { setView('overview'); }}>Overview</Button>
            <Icon icon="chevron-right" size={11} />
            <span>{view === 'markings' ? 'Access requirements' : 'Compose granular policy'}</span>
          </div>
        )}

        {view === 'overview' && <PolicyOverview type={type} row={row} onManage={setView} />}
        {view === 'markings' && <MarkingsSlot type={type} kind={kind} policyId={row.id} />}
        {view === 'granular' && <GranularSlot type={type} kind={kind} row={row} />}
      </DialogBody>
      <DialogFooter actions={<Button onClick={onClose}>Close</Button>} />
    </Dialog>
  )
}

function Slot({ title, manage, children }: {
  title: string
  manage?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="flex-1" />
        {manage && (
          // Named by slot: two Manage buttons with the same accessible name
          // are ambiguous to anyone not looking at the column.
          <Button variant="minimal" size="small" onClick={manage} aria-label={`Manage ${title}`}>
            Manage
          </Button>
        )}
      </div>
      <div className="px-3 py-2 text-xs">{children}</div>
    </div>
  )
}

const And = () => <p className="py-1 text-center text-xs text-muted-foreground">AND</p>

/** The two columns and the arrow between them. */
function PolicyOverview({ type, row, onManage }: {
  type: ObjectTypeDef
  row: PolicyRow
  onManage: (v: 'markings' | 'granular') => void
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-1">
        <h4 className="mb-2 text-sm font-semibold">Datasource access requirements</h4>
        <Slot title="Viewer permissions">
          <span className="flex items-center gap-2">
            <Icon icon="th" size={13} intent={Intent.PRIMARY} />
            {row.datasetName ?? 'the backing datasource'}
          </span>
        </Slot>
        <And />
        {/* allowed_organizations is "the organizations permitted on any mandatory
            control property of this datasource" — the legal VALUES, not an access
            requirement. Counting it here said the wrong thing, so it says nothing
            until the real requirement is read. */}
        <Slot title="Organizations">
          <span className="text-muted-foreground">Not read yet</span>
        </Slot>
        <And />
        <Slot title="Markings">Inherited from the datasource</Slot>
      </div>

      <div className="flex items-center"><Icon icon="arrow-right" /></div>

      <div className="flex-1 space-y-1">
        <h4 className="mb-2 text-sm font-semibold">Policy access requirements</h4>
        <Slot title="Viewer permissions">
          <span className="flex items-center gap-2">
            <Icon icon="cube" size={13} intent={Intent.PRIMARY} />
            {type.label}
          </span>
        </Slot>
        <And />
        <Slot title="Granular policy" manage={() => { onManage('granular'); }}>
          {row.policy ? `${String(row.policy.rules.length)} rules` : 'None'}
        </Slot>
        <And />
        <Slot title="Organizations">
          <span className="text-muted-foreground">Not configured</span>
        </Slot>
        <And />
        <Slot title="Markings" manage={() => { onManage('markings'); }}>
          {row.markings || 'None'}
        </Slot>
      </div>
    </div>
  )
}

/** The Granular policy sub-view. The composer is the one restricted views use —
 *  same grammar, same validator, same compiler (483) — narrowed to the four
 *  comparisons an object policy allows, and given the marking condition as its
 *  own affordance rather than a ninth entry in the operator list. */
function GranularSlot({ type, kind, row }: {
  type: ObjectTypeDef
  kind: 'object' | 'property'
  row: PolicyRow
}) {
  const { data: fields = [] } = usePolicyFields(type.id)
  const save = useSetPolicyGranular(kind, type.id)
  const [draft, setDraft] = useState<Policy | null>(row.policy)

  const markingFields = fields.filter((f) => f.type === 'MARKING')

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">Compose granular policy</h4>
        <p className="text-xs text-muted-foreground">
          A granular policy is a combination of rules that describe what rows can be seen by
          different people.
        </p>
      </div>

      {draft ? (
        <PolicyComposer
          policy={draft}
          columns={fields}
          comparisons={POLICY_COMPARISONS}
          fieldLabel="Properties"
          markingFields={markingFields}
          onChange={setDraft}
        />
      ) : (
        <Callout intent={Intent.NONE} className="text-xs">
          None. This policy filters no rows until it has one.
        </Callout>
      )}

      {markingFields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          This object type has no mandatory control property, so a marking condition has
          nothing to compare against.
        </p>
      )}

      <div className="flex gap-2">
        {!draft && (
          <Button size="small" icon="add" onClick={() => { setDraft({ match: 'all', rules: [] }); }}>
            Add a granular policy
          </Button>
        )}
        {draft && (
          <>
            <Button
              size="small"
              intent={Intent.PRIMARY}
              loading={save.isPending}
              disabled={draft.rules.length === 0}
              onClick={() => { save.mutate({ policyId: row.id, policy: draft }); }}
            >
              Confirm changes
            </Button>
            {/* The only way back to None: the database refuses a rules-empty
                policy (Policies:MalformedPolicy), so clearing the composer is
                not the same as removing the arm. */}
            <Button
              size="small"
              intent={Intent.DANGER}
              variant="minimal"
              onClick={() => {
                setDraft(null)
                save.mutate({ policyId: row.id, policy: null })
              }}
            >
              Remove granular policy
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/** The Markings slot: each inherited marking shows Inherited with Stop
 *  inheriting, or Removed with Start inheriting, PER DATASOURCE, because a stop
 *  is recorded per source. */
function MarkingsSlot({ type, kind, policyId }: {
  type: ObjectTypeDef
  kind: 'object' | 'property'
  policyId: string
}) {
  const { data } = usePolicyMarkings(kind, policyId, type.id)
  const setInheriting = useSetInheriting(kind, type.id)
  const addMarking = useAddPolicyMarking(kind, type.id)
  const removeMarking = useRemovePolicyMarking(kind, type.id)
  const all = useMarkings()
  const [picking, setPicking] = useState(false)

  const addedIds = new Set((data?.added ?? []).map((a) => a.markingId))

  return (
    <div>
      <h4 className="text-sm font-semibold">Access requirements</h4>
      <p className="mb-3 text-xs text-muted-foreground">Configure changes to access requirements</p>

      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold">Markings</span>
        <span className="text-xs text-muted-foreground">· All of</span>
        <span className="flex-1" />
        <Button size="small" variant="minimal" icon="plus" onClick={() => { setPicking((v) => !v); }}>Add</Button>
      </div>

      {picking && (
        <div className="mb-3 flex flex-wrap gap-2 rounded border p-2">
          {(all.data ?? [])
            .filter((m) => !addedIds.has(m.id))
            .map((m) => (
              <Tag key={m.id} interactive minimal
                onClick={() => {
                  addMarking.mutate({ policyId, markingId: m.id }, { onSuccess: () => { setPicking(false) } })
                }}>
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
            <Button size="small"
              onClick={() => {
                setInheriting.mutate({
                  policyId, datasourceId: m.datasourceId, markingId: m.markingId, stop: !m.stopped,
                })
              }}>
              {m.stopped ? 'Start inheriting' : 'Stop inheriting'}
            </Button>
          </div>
        ))}

        {(data?.added ?? []).map((a) => (
          <div key={a.markingId} className="flex items-center gap-3 rounded border p-2">
            <Tag minimal icon="shield">{a.name}</Tag>
            <Tag minimal intent={Intent.PRIMARY}>Added</Tag>
            <span className="flex-1" />
            <Button size="small" onClick={() => { removeMarking.mutate({ policyId, markingId: a.markingId }) }}>
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
    </div>
  )
}

// An interface's own page, per iatc-config-page.png: Overview · Properties ·
// Extensions · Link type constraints · Action type constraints. Permissions
// and History are the screenshot's remaining entries, omitted by name —
// nothing backs them yet.

import { useState } from 'react'
import {
  Button, Checkbox, HTMLSelect, Icon, InputGroup, Intent, Tab, Tabs, Tag,
} from '@blueprintjs/core'
import { toCamel, type ObjectTypeDef } from '@beacon/ontology'
import { useStageClauses, useStageMetadata, useImplementations } from './hooks'
import type { ActionConstraintRow, InterfaceRow } from './api'
import { ActionConstraintDialog } from './ActionConstraintDialog'

export function InterfaceDetail({ row, all, types }: {
  row: InterfaceRow
  all: InterfaceRow[]
  types: ObjectTypeDef[]
}) {
  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex items-center gap-2">
        <Icon icon="layers" size={15} className="text-violet-500" />
        <h2 className="text-sm font-semibold">{row.label}</h2>
        <span className="font-mono text-xs text-muted-foreground">{row.api_name}</span>
      </div>
      <Tabs id={`iface-${row.id}`} vertical animate={false} renderActiveTabPanelOnly>
        <Tab id="overview" title="Overview" icon="desktop" panel={<OverviewTab row={row} types={types} />} />
        <Tab id="properties" title="Properties" icon="th-list" panel={<PropertiesTab row={row} />} />
        <Tab id="extensions" title="Extensions" icon="flow-branch" panel={<ExtensionsTab row={row} all={all} />} />
        <Tab id="links" title="Link type constraints" icon="link" panel={<LinkConstraintsTab row={row} all={all} types={types} />} />
        <Tab id="actions" title="Action type constraints" icon="take-action" panel={<ActionConstraintsTab row={row} />} />
      </Tabs>
    </section>
  )
}

function OverviewTab({ row, types }: { row: InterfaceRow; types: ObjectTypeDef[] }) {
  const { data: impls = [] } = useImplementations()
  const stage = useStageMetadata()
  const implementers = impls.filter((i) => i.interface_id === row.id)
    .map((i) => types.find((t) => t.id === i.object_type_id)?.label ?? '?')
  return (
    <div className="space-y-2 text-xs">
      {/* interface-metadata's own fields, writable at last (F6.8) — each edit
          stages through the session like every ontology edit. */}
      <div className="flex flex-wrap items-center gap-2">
        <HTMLSelect value={row.icon}
          onChange={(e) => { stage.mutate({ id: row.id, patch: { icon: e.currentTarget.value } }) }}>
          {['layers', 'cube', 'diagram-tree', 'inheritance', 'shapes', 'globe'].map((ic) => (
            <option key={ic} value={ic}>{ic}</option>
          ))}
        </HTMLSelect>
        <HTMLSelect value={row.status}
          onChange={(e) => { stage.mutate({ id: row.id, patch: { status: e.currentTarget.value } }) }}>
          {['experimental', 'active', 'example', 'deprecated'].map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </HTMLSelect>
        {/* "Searchable interfaces are limited to 50 implementing object
            types, whereas non-searchable interfaces are limited to 1,000.
            By default, the `Facility` interface will be searchable." */}
        <Checkbox checked={row.searchable} label="Searchable" className="!mb-0"
          title="Searchable: 50-implementer cap, whole-interface loads; non-searchable: 1,000"
          onChange={(e) => { stage.mutate({ id: row.id, patch: { searchable: e.currentTarget.checked } }) }} />
      </div>
      <InputGroup size="small" placeholder="Description" value={row.description}
        onChange={(e) => { stage.mutate({ id: row.id, patch: { description: e.currentTarget.value } }) }} />
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Implemented by</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {implementers.length === 0 && <span className="text-muted-foreground">No object type implements this interface yet.</span>}
          {implementers.map((l) => <Tag key={l} minimal icon="cube">{l}</Tag>)}
        </div>
      </div>
    </div>
  )
}

function PropertiesTab({ row }: { row: InterfaceRow }) {
  return (
    <div className="space-y-1 text-xs">
      {row.interface_properties.length === 0 && (
        <p className="text-muted-foreground">An interface with no properties promises nothing.</p>
      )}
      {[...row.interface_properties].sort((a, b) => a.position - b.position).map((p) => (
        <div key={p.property_id} className="flex items-center gap-2">
          <span className="font-medium w-40">{p.display_name}</span>
          <code className="text-xs text-muted-foreground">{p.property_id}</code>
          <Tag minimal>{p.base_type}</Tag>
          {p.required && <Tag minimal intent={Intent.WARNING}>Required</Tag>}
          {p.pk_constraint !== 'none' && (
            <Tag minimal>pk: {p.pk_constraint}</Tag>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-1">
        Properties are edited where the interface is created — the list page's form.
      </p>
    </div>
  )
}

function ExtensionsTab({ row, all }: { row: InterfaceRow; all: InterfaceRow[] }) {
  const stage = useStageClauses()
  const parents = row.extensions.map((e) => e.parent_interface_id)
  const nameOf = (id: string) => all.find((i) => i.id === id)?.label ?? '?'
  const setParents = (next: string[]) => { stage.mutate({ id: row.id, patch: { extends: next } }) }
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {parents.map((p) => (
          <Tag key={p} minimal
            onRemove={() => { setParents(parents.filter((x) => x !== p)) }}>
            {nameOf(p)}
          </Tag>
        ))}
        <HTMLSelect value="" onChange={(e) => {
          const v = e.currentTarget.value
          if (v) setParents([...parents, v])
        }}>
          <option value="">Extend…</option>
          {all.filter((i) => i.id !== row.id && !parents.includes(i.id)
            && !i.extensions.some((x) => x.parent_interface_id === row.id))
            .map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </HTMLSelect>
      </div>
      <p className="text-muted-foreground">
        An interface inherits the properties and action type constraints of the interface it
        extends; deeper cycles and name collisions are refused when the save applies.
      </p>
    </div>
  )
}

function LinkConstraintsTab({ row, all, types }: {
  row: InterfaceRow; all: InterfaceRow[]; types: ObjectTypeDef[]
}) {
  const stage = useStageClauses()
  const [linkName, setLinkName] = useState('')
  const [cardinality, setCardinality] = useState<'ONE' | 'MANY'>('ONE')
  const [target, setTarget] = useState('')
  const nameOf = (id: string | null) =>
    all.find((i) => i.id === id)?.label ?? types.find((t) => t.id === id)?.label ?? '?'

  const add = () => {
    const [kind, id] = target.split(':')
    stage.mutate({ id: row.id, patch: { link_constraints: [
      ...row.interface_link_constraints,
      { api_name: toCamel(linkName), display_name: linkName.trim(), required: true, cardinality,
        target_kind: kind as 'interface' | 'object_type',
        target_interface_id: kind === 'interface' ? id : null,
        target_object_type_id: kind === 'object_type' ? id : null },
    ] } }, { onSuccess: () => { setLinkName(''); setTarget('') } })
  }
  const drop = (apiName: string) => {
    stage.mutate({ id: row.id, patch: {
      link_constraints: row.interface_link_constraints.filter((c) => c.api_name !== apiName) } })
  }

  return (
    <div className="space-y-1.5 text-xs">
      {row.interface_link_constraints.map((c) => (
        <div key={c.api_name} className="flex items-center gap-2">
          <Icon icon="link" size={11} className="text-violet-500" />
          <span>{c.display_name}</span>
          <Tag minimal>{c.cardinality}</Tag>
          <span className="text-muted-foreground">→ {nameOf(c.target_interface_id ?? c.target_object_type_id)}</span>
          <Button variant="minimal" size="small" icon="cross" onClick={() => { drop(c.api_name) }} />
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <InputGroup size="small" placeholder="Link name" value={linkName}
          onChange={(e) => { setLinkName(e.currentTarget.value) }} style={{ width: 140 }} />
        <HTMLSelect value={cardinality} onChange={(e) => { setCardinality(e.currentTarget.value as 'ONE' | 'MANY') }}>
          <option value="ONE">ONE</option>
          <option value="MANY">MANY</option>
        </HTMLSelect>
        <HTMLSelect value={target} onChange={(e) => { setTarget(e.currentTarget.value) }}>
          <option value="">Target…</option>
          <optgroup label="Interfaces">
            {all.map((i) => <option key={i.id} value={`interface:${i.id}`}>{i.label}</option>)}
          </optgroup>
          <optgroup label="Object types">
            {types.map((t) => <option key={t.id} value={`object_type:${t.id}`}>{t.label}</option>)}
          </optgroup>
        </HTMLSelect>
        <Button size="small" icon="add" disabled={!linkName.trim() || !target} onClick={add} />
      </div>
    </div>
  )
}

function ActionConstraintsTab({ row }: { row: InterfaceRow }) {
  const stage = useStageClauses()
  const [editing, setEditing] = useState<ActionConstraintRow | 'new' | null>(null)
  const drop = (apiName: string) => {
    stage.mutate({ id: row.id, patch: {
      action_constraints: row.interface_action_constraints
        .filter((c) => c.api_name !== apiName)
        .map(({ interface_action_parameter_constraints: _x, ...keep }) => keep) } })
  }
  return (
    <div className="space-y-1.5 text-xs">
      {row.interface_action_constraints.map((c) => (
        <div key={c.api_name} className="flex items-center gap-2">
          <Icon icon="take-action" size={11} className="text-violet-500" />
          <button type="button" className="hover:underline" onClick={() => { setEditing(c) }}>
            {c.display_name}
          </button>
          {(c.interface_action_parameter_constraints?.length ?? 0) > 0 && (
            <Tag minimal>
              {c.interface_action_parameter_constraints?.length} parameter{c.interface_action_parameter_constraints?.length === 1 ? '' : 's'}
            </Tag>
          )}
          <Tag minimal>{c.required ? 'Required' : 'Optional'}</Tag>
          <Button variant="minimal" size="small" icon="cross" onClick={() => { drop(c.api_name) }} />
        </div>
      ))}
      <Button size="small" variant="minimal" icon="add" onClick={() => { setEditing('new') }}>Create new</Button>
      {editing !== null && (
        <ActionConstraintDialog row={row}
          existing={editing === 'new' ? null : editing}
          onClose={() => { setEditing(null) }} />
      )}
    </div>
  )
}

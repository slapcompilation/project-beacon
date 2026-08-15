// The Object Explorer home — "an orientation hub where one can start exploring
// objects" (readings/object-explorer.md §2). The screenshot's shape: the
// "Explore your data" headline, the global search bar, object type groups as
// card sections with an "Other" group for the ungrouped, a count badge per
// card, and a preview panel with Start exploring.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Drawer, Icon, InputGroup, Menu, MenuDivider, MenuItem, Popover, Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useObjectTypes } from '@/features/objectTypes/hooks'
import type { ObjectTypeRow } from '@/features/objectTypes/api'
import { useGlobalSearch, useIndexCounts, useSavedSets, useTypeGroups } from './api'

const typeIcon = (t: ObjectTypeRow): IconName => (t.icon || 'cube') as IconName

export default function ExplorerHome() {
  const navigate = useNavigate()
  const { data: types = [] } = useObjectTypes()
  const { data: groups = [] } = useTypeGroups()
  const { data: counts = [] } = useIndexCounts()
  const { data: savedSets = [] } = useSavedSets()
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<ObjectTypeRow | null>(null)
  const { data: hits = [] } = useGlobalSearch(query)

  // "No hidden object or property types will be displayed ... anywhere in
  // Object Explorer."
  const visible = useMemo(
    () => types.filter((t) => t.visibility !== 'hidden'),
    [types])
  const countOf = (id: string) =>
    counts.find((c) => c.object_type_id === id && c.state === 'COMPLETED')?.object_count ?? null

  // Configured groups first; every ungrouped visible type lands in "Other".
  const sections = useMemo(() => {
    const grouped = new Set<string>()
    const named = groups.map((g) => {
      const members = g.object_type_group_members
        .map((m) => visible.find((t) => t.id === m.object_type_id))
        .filter((t): t is ObjectTypeRow => t !== undefined)
      members.forEach((t) => grouped.add(t.id))
      return { name: g.name, types: members }
    }).filter((s) => s.types.length > 0)
    const other = visible.filter((t) => !grouped.has(t.id))
    return other.length > 0 && named.length > 0
      ? [...named, { name: 'Other', types: other }]
      : named.length > 0 ? named : [{ name: 'All object types', types: other }]
  }, [groups, visible])

  const typeMatches = query.trim() === '' ? [] : visible.filter((t) =>
    t.label.toLowerCase().includes(query.toLowerCase())
    || t.api_name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="explorer-page">
      <h1 className="explorer-headline">Explore your data</h1>
      <p className="explorer-sub">Select an object type from the list below to explore or view results.</p>

      <Popover
        isOpen={query.trim() !== ''}
        autoFocus={false}
        enforceFocus={false}
        minimal
        fill
        placement="bottom-start"
        content={
          <Menu className="explorer-search-menu">
            {typeMatches.slice(0, 5).map((t) => (
              <MenuItem key={t.id} icon={typeIcon(t)} text={t.label}
                label={`${countOf(t.id) ?? '–'}`}
                onClick={() => { void navigate(`/explorer/${t.id}`) }} />
            ))}
            {typeMatches.length > 0 && hits.length > 0 && <MenuDivider />}
            {hits.map((h) => (
              <MenuItem key={`${h.object_type_id}:${h.primary_key}`} icon="document"
                text={h.title} label={h.object_type_label}
                onClick={() => { void navigate(`/explorer/${h.object_type_id}`) }} />
            ))}
            {typeMatches.length === 0 && hits.length === 0 && (
              <MenuItem disabled text="No matching object types or objects" />
            )}
          </Menu>
        }>
        <InputGroup size="large" leftIcon="search" className="explorer-search"
          placeholder="Search object types and properties..."
          value={query} onChange={(e) => { setQuery(e.currentTarget.value) }} />
      </Popover>

      {savedSets.length > 0 && (
        <section className="explorer-group">
          <h2 className="explorer-group-title">
            My Explorations & Lists <Tag minimal round>{savedSets.length}</Tag>
          </h2>
          <div className="explorer-card-grid">
            {savedSets.map((set) => (
              <button key={set.id} type="button" className="explorer-card"
                onClick={() => { void navigate(`/explorer/saved/${set.id}`) }}>
                <span className="app-tile" style={{ background: '#7961db1f' }}>
                  <Icon icon={set.set_kind === 'list' ? 'th-list' : 'search-template'} size={18} color="#7961db" />
                </span>
                <span className="explorer-card-name">{set.name}</span>
                <Tag minimal>{set.set_kind === 'list' ? 'List' : 'Exploration'}</Tag>
              </button>
            ))}
          </div>
        </section>
      )}

      {sections.map((s) => (
        <section key={s.name} className="explorer-group">
          <h2 className="explorer-group-title">
            {s.name} <Tag minimal round>{s.types.length}</Tag>
          </h2>
          <div className="explorer-card-grid">
            {s.types.map((t) => (
              <button key={t.id} type="button" className="explorer-card"
                onClick={() => { void navigate(`/explorer/${t.id}`) }}>
                <span className="app-tile" style={{ background: '#7961db1f' }}>
                  <Icon icon={typeIcon(t)} size={18} color="#7961db" />
                </span>
                <span className="explorer-card-name">{t.label}</span>
                {countOf(t.id) !== null && <Tag minimal round>{countOf(t.id)}</Tag>}
                <Button variant="minimal" size="small" icon="info-sign" title="Preview"
                  onClick={(e) => { e.stopPropagation(); setPreview(t) }} />
              </button>
            ))}
          </div>
        </section>
      ))}

      <Drawer isOpen={preview !== null} onClose={() => { setPreview(null) }}
        size="380px" title={preview?.label}>
        {preview && <TypePreview type={preview} onExplore={() => {
          void navigate(`/explorer/${preview.id}`)
        }} />}
      </Drawer>
    </div>
  )
}

/** The quick view: description, visibility, properties with their key tags,
 *  Start exploring (home_object_type_preview.png). */
function TypePreview({ type, onExplore }: { type: ObjectTypeRow; onExplore: () => void }) {
  const props = [...type.object_type_properties]
    .filter((p) => p.visibility !== 'hidden')
    .sort((a, b) => a.position - b.position)
  return (
    <div className="explorer-preview">
      {type.description && <p className="text-sm text-muted-foreground">{type.description}</p>}
      <div className="explorer-preview-row">
        <span className="explorer-preview-label">Visibility</span>
        <Tag minimal>{type.visibility}</Tag>
      </div>
      <div>
        <span className="explorer-preview-label">Properties ({props.length})</span>
        <div className="mt-1 space-y-1">
          {props.map((p) => (
            <div key={p.property_id} className="flex items-center gap-2 text-sm">
              <span>{p.display_name}</span>
              {p.is_title_key && <Tag minimal className="!text-[10px]">Title</Tag>}
              {p.is_primary_key && <Tag minimal intent="primary" className="!text-[10px]">Primary key</Tag>}
            </div>
          ))}
        </div>
      </div>
      <Button intent="primary" fill icon="arrow-right" onClick={onExplore}>
        Start exploring
      </Button>
    </div>
  )
}

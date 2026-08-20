// Where a property's values come from — the Source tab of the property editor.
//
// The source model is a closed set of three with published definitions, and it
// is not specific to media; it was only ever screenshotted on the media page:
//
//   Source type
//   ◉ Datasource — Back this property with a dataset, restricted view or stream
//   ○ User edits — Back this property exclusively with edits from user inputs
//   ○ Linked objects — Use a property from another object type
//   — object-link-types/images/media-reference-source.png
//
// Ours offered two of the three, under labels nobody published. `linked_objects`
// has existed since 576 with no way to select it, and `user_input` could be
// selected but never named the datasource it must be permissioned to — so the
// editor could produce a row the database refuses.
//
// The derived panel is `configure-derived-property-aggregation.png` field for
// field: hop rows carrying the link and the object type it reaches, then
// Aggregation, Property and Limit. Which of the last two appear is read from
// `derived_aggregations()` rather than hardcoded — Count needs no property, the
// collects take a limit, and the database already says so.

import { Button, Callout, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon, InputGroup, Radio, RadioGroup, Tag } from '@blueprintjs/core'
import type { PropertyDef, LinkTypeDef, ObjectTypeDef } from '@beacon/ontology'
import { useObjectTypeDatasources, useMediaBindings, useSetMediaBinding } from './hooks'
import { useDerivedAggregations } from './derived'

/** "up to 3 levels" counts LINKS, not object types. */
const MAX_HOPS = 3

export function PropertySourceDialog({ isOpen, onClose, objectTypeId, property, linkTypes, types, onChange }: {
  isOpen: boolean
  onClose: () => void
  /** Null while the type is being created — it has no datasources yet. */
  objectTypeId: string | null
  property: PropertyDef
  linkTypes: LinkTypeDef[]
  types: ObjectTypeDef[]
  onChange: (patch: Partial<PropertyDef>) => void
}) {
  const { data: sources = [] } = useObjectTypeDatasources(objectTypeId)
  const { data: aggregations = [] } = useDerivedAggregations()
  const { data: bindings = {} } = useMediaBindings(objectTypeId)
  const setBinding = useSetMediaBinding(objectTypeId ?? '')
  const mediaSources = sources.filter((s) => s.mediaSetViewRid)
  const source = property.source ?? 'column'
  const agg = aggregations.find((a) => a.name === property.derivedAggregation)

  // Each hop starts where the last one arrived; the first starts at this type.
  const hops = property.hops ?? []
  const startOf = (i: number): string | null => {
    if (i === 0) return objectTypeId
    const prev = linkTypes.find((l) => l.id === hops[i - 1])
    return prev ? prev.targetTypeId : null
  }
  const optionsFor = (i: number) => {
    const from = startOf(i)
    return from ? linkTypes.filter((l) => l.sourceTypeId === from) : []
  }
  const reached = (id: string) => {
    const link = linkTypes.find((l) => l.id === id)
    return types.find((t) => t.id === link?.targetTypeId) ?? null
  }
  const endType = hops.length > 0 ? reached(hops[hops.length - 1]) : null

  const setHop = (i: number, id: string) => {
    // Changing a hop invalidates everything after it — the chain no longer
    // arrives where those links start.
    onChange({ hops: [...hops.slice(0, i), id], derivedFromPropertyId: null })
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Source — ${property.label || 'property'}`}>
      <DialogBody>
        <RadioGroup label="Source type" selectedValue={source}
          onChange={(e) => {
            const next = e.currentTarget.value as PropertyDef['source']
            onChange({
              source: next,
              backingColumn: next === 'column' ? property.backingColumn ?? '' : null,
              datasourceId: next === 'linked_objects' ? null : property.datasourceId ?? null,
              ...(next === 'linked_objects' ? {} : { hops: [], derivedAggregation: null, derivedFromPropertyId: null, derivedLimit: null }),
            })
          }}>
          <Radio value="column" labelElement={
            <span><b>Datasource</b> — Back this property with a dataset, restricted view or stream</span>} />
          <Radio value="user_input" labelElement={
            <span><b>User edits</b> — Back this property exclusively with edits from user inputs</span>} />
          <Radio value="linked_objects" labelElement={
            <span><b>Linked objects</b> — Use a property from another object type</span>} />
        </RadioGroup>

        {source !== 'linked_objects' && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data</p>
            {/* Edit-only properties "must be permissioned to one of the datasets
                backing the object type" — required, not decoration: the CHECK
                refuses a user_input property with no datasource. */}
            <HTMLSelect fill value={property.datasourceId ?? ''}
              onChange={(e) => { onChange({ datasourceId: e.currentTarget.value || null }) }}>
              <option value="">
                {property.isPrimaryKey ? 'Every datasource — it is the primary key' : 'Which backing datasource…'}
              </option>
              {sources.filter((s) => !s.mediaSetViewRid).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.restrictedViewId ? s.restrictedViewName : `${s.datasetName} · ${s.branchName}`}
                </option>
              ))}
            </HTMLSelect>
            {source === 'column' && (
              <InputGroup placeholder="Backing column" value={property.backingColumn ?? ''}
                onValueChange={(v) => { onChange({ backingColumn: v }) }} className="font-mono" />
            )}
            {source === 'user_input' && sources.length === 0 && (
              <Callout intent="warning" className="!text-xs">
                An edit-only property must be permissioned to one of the datasets backing
                this object type, and this type has none yet.
              </Callout>
            )}
          </div>
        )}

        {source === 'linked_objects' && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Linked objects</p>
              <Tag minimal className="!text-[10px]">Read only</Tag>
            </div>
            <Callout intent="none" className="!text-xs">
              Properties derived from a linked object, or traversed across multiple linked
              objects, are read only and cannot be edited by functions or actions.
            </Callout>

            {[...hops, ''].slice(0, MAX_HOPS).map((hop, i) => {
              const options = optionsFor(i)
              if (options.length === 0 && hop === '') return null
              return (
                <div key={i} className="flex items-center gap-2">
                  <Icon icon="link" size={12} className="text-violet-500" />
                  <HTMLSelect fill value={hop}
                    onChange={(e) => { setHop(i, e.currentTarget.value) }}>
                    <option value="">{i === 0 ? 'Select your first link type…' : 'Add linked object…'}</option>
                    {options.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label} [{types.find((t) => t.id === l.targetTypeId)?.label ?? '?'}]
                      </option>
                    ))}
                  </HTMLSelect>
                  {hop !== '' && i === hops.length - 1 && (
                    <Button variant="minimal" size="small" icon="cross"
                      onClick={() => { onChange({ hops: hops.slice(0, i), derivedFromPropertyId: null }) }} />
                  )}
                </div>
              )
            })}
            {hops.length >= MAX_HOPS && (
              <p className="text-[11px] text-muted-foreground">Up to 3 levels — the chain is full.</p>
            )}

            <HTMLSelect fill value={property.derivedAggregation ?? ''}
              onChange={(e) => { onChange({ derivedAggregation: e.currentTarget.value || null, derivedLimit: null }) }}>
              <option value="">Aggregation…</option>
              {aggregations.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
            </HTMLSelect>

            {/* "For Count aggregation, you do not need to select a property as
                objects are automatically counted." */}
            {agg?.needsProperty && (
              <HTMLSelect fill value={property.derivedFromPropertyId ?? ''}
                onChange={(e) => { onChange({ derivedFromPropertyId: e.currentTarget.value || null }) }}>
                <option value="">Property…</option>
                {(endType?.properties ?? []).map((p) => (
                  <option key={p.id ?? p.key} value={p.id ?? ''}>{p.label}</option>
                ))}
              </HTMLSelect>
            )}
            {agg?.takesLimit && (
              <InputGroup type="number" placeholder="Limit (default 10)"
                value={property.derivedLimit?.toString() ?? ''}
                onValueChange={(v) => { onChange({ derivedLimit: v === '' ? null : Number(v) }) }} />
            )}
          </div>
        )}
        {/* A media reference property is still backed the ordinary way — it
            reads a media reference column — and separately names the media set
            view its references point into. Two bindings, not one, which is why
            `media_property_problems()` reports a media property with no source
            even when its column is fine. */}
        {property.type === 'media_reference' && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Media source
            </p>
            {property.id === undefined
              ? <Callout intent="none" className="!text-xs">
                  Save the property first — a media source is bound to the property row.
                </Callout>
              : mediaSources.length === 0
                ? <Callout intent="warning" className="!text-xs">
                    This object type has no media source yet. Add one under Datasources,
                    naming the media set and the view its items live in.
                  </Callout>
                : <HTMLSelect fill value={bindings[property.id] ?? ''}
                    onChange={(e) => {
                      setBinding.mutate({ propertyId: property.id as string,
                                          datasourceId: e.currentTarget.value || null })
                    }}>
                    <option value="">Not bound — the references resolve to nothing</option>
                    {mediaSources.map((m) => (
                      <option key={m.id} value={m.id}>{m.mediaSetViewRid}</option>
                    ))}
                  </HTMLSelect>}
          </div>
        )}
      </DialogBody>
      <DialogFooter actions={<Button intent="primary" onClick={onClose}>Done</Button>} />
    </Dialog>
  )
}

// The Time series panel of the Capabilities tab.
//
// Built from `capabilities-time-series-properties-panel.png`, which is the
// newest of the four captures of this panel: an inner card titled "Time series
// properties" with a count badge and `+ Add property`, then a table of
// PROPERTY NAME / TIME SERIES SYNC / BASE FORMATTER, the default row carrying a
// `Default` tag inline after its name and the formatter column reading
// `No formatting`. Two older captures show the same panel under a different
// name and without the tag; the reading dates all four and says which won.
//
// What it deliberately does NOT draw:
//   Analyze          — opens Quiver against the series, and our Quiver page
//                      creates analyses without plotting a TSP.
//   The dialog's step 3 — a two-card radio, "Standard time series property" vs
//                      "Sensor object type [Advanced]" (the step-3 capture is
//                      time-series-setup-sensor-object-type-setup-dialog.png;
//                      an earlier version of this comment cited the step 1 and
//                      2 captures by mistake). Its terminal write must land the
//                      toggle AND one Sensor link entry in one transaction, or
//                      the type saves straight into a violation. The
//                      Capabilities section below is the complete path, and it
//                      is where Foundry's own walkthrough turns the toggle on.
//   Primary Sensor Link — "This will only appear if you still have old versions
//                      of Quiver accessible in your Foundry instance", and it
//                      is absent from the newer capture entirely.
//
// 783 made the sensor branch real: the Sensor object type section below, and
// the info icon that replaces the base formatter for one.
//
// The formatter popover is measured off time-series-setup-time-series-formatting.png:
// a muted uppercase header carrying the master toggle, then `Internal
// Interpolation` with a select and NO toggle of its own, then `Units` WITH one.
// The constant-or-property choice is drawn as Foundry's one PROSE-documented
// form of that control - "Add constant" / "Add reference" from
// conditional-formatting - rather than the unlabelled caret the capture shows,
// because no page names what that caret opens.

import { useState } from 'react'
import {
  Button, Callout, Checkbox, Collapse, Dialog, DialogBody, DialogFooter,
  HTMLSelect, Icon, InputGroup, Intent, NonIdealState, Popover, Spinner, Switch, Tag,
} from '@blueprintjs/core'
import type { ObjectTypeDef } from '@beacon/ontology'
import { useDatasets } from '@/features/datasets/api'
import { useDatasetFields, useLinkTypes } from './hooks'
import {
  useSensorLinks, useSetIsSensor, useSaveSensorLink, useRemoveSensorLink,
} from './sensors'
import {
  useTimeSeriesProperties, useTimeSeriesSyncs, useCreateTimeSeriesSync,
  useDesignateTimeSeriesProperty, useSetDefaultTimeSeriesProperty,
  useReleaseTimeSeriesProperty, useSetTimeSeriesFormatting,
  type FormatterOperand, type TimeSeriesProperty,
} from './timeSeries'

/** A long timestamp column carries its unit; a timestamp one is already one. */
const UNITS = ['SECONDS', 'MILLISECONDS', 'MICROSECONDS', 'NANOSECONDS']

/** The five interpolation members the page enumerates. LINEAR is "Only
 *  applicable to numerical time series"; the stored token is SCREAMING_CASE and
 *  every Foundry UI spells it Title Case, both being the page's own. */
const INTERPOLATION = ['LINEAR', 'NEAREST', 'PREVIOUS', 'NEXT', 'NONE']
const titleOf = (t: string) => t.charAt(0) + t.slice(1).toLowerCase()

export function TimeSeriesPanel({ type }: { type: ObjectTypeDef }) {
  const { data: rows, isLoading } = useTimeSeriesProperties(type.id)
  const setDefault = useSetDefaultTimeSeriesProperty(type.id)
  const release = useReleaseTimeSeriesProperty(type.id)
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)

  if (isLoading || rows === undefined) return <Spinner size={20} />

  return (
    <section className="rounded border">
      <button type="button" className="flex w-full items-center gap-2 p-3 text-left"
        onClick={() => { setOpen(!open) }}>
        <Icon icon="timeline-line-chart" size={15} className="text-violet-500" />
        <span className="text-sm font-semibold">Time series</span>
        <span className="text-xs text-muted-foreground">
          set existing object type properties as time series
        </span>
        <Icon icon={open ? 'chevron-up' : 'chevron-down'} size={13} className="ml-auto" />
      </button>

      <Collapse isOpen={open}>
        <div className="border-t p-3">
          <div className="rounded border">
            <div className="flex items-center gap-2 p-3">
              <span className="text-sm font-semibold">Time series properties</span>
              <Tag minimal round>{rows.length}</Tag>
              <Button className="ml-auto" icon="plus" size="small" variant="outlined" intent={Intent.PRIMARY}
                onClick={() => { setAdding(true) }}>
                Add property
              </Button>
            </div>

            {rows.length === 0
              ? (
                <div className="border-t p-3">
                  <NonIdealState icon="timeline-line-chart"
                    title="Get started using one or more properties from this object type in time series workflows"
                    description="Choose an existing string property that holds series IDs, and the sync that indexes them."
                    action={<Button icon="plus" intent={Intent.PRIMARY}
                      onClick={() => { setAdding(true) }}>Get started</Button>} />
                </div>
              )
              : (
                <table className="w-full border-t text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="p-2 text-left font-medium uppercase tracking-widest">Property name</th>
                      <th className="p-2 text-left font-medium uppercase tracking-widest">Time series sync</th>
                      <th className="p-2 text-left font-medium uppercase tracking-widest">Base formatter</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">
                          <span className="font-medium">{r.displayName}</span>
                          {r.isDefault && <Tag minimal className="ml-2">Default</Tag>}
                          {r.itemType !== null && (
                            <Tag minimal className="ml-2">
                              {r.itemType === 'string' ? 'Categorical'
                                : r.itemType === 'double' ? 'Numerical' : r.itemType}
                            </Tag>
                          )}
                        </td>
                        <td className="p-2">
                          {r.syncName === null
                            ? <span className="text-muted-foreground">Bound to no sync</span>
                            : <span className="flex items-center gap-1">
                                <Icon icon="document" size={12} />{r.syncName}
                              </span>}
                        </td>
                        <td className="p-2">
                          <BaseFormatter type={type} row={r} />
                        </td>
                        <td className="p-2 text-right">
                          {!r.isDefault && (
                            <Button variant="minimal" size="small" onClick={() => { setDefault.mutate(r.id) }}>
                              Set as default
                            </Button>
                          )}
                          <Button variant="minimal" size="small" icon="trash" title="Remove"
                            onClick={() => {
                              release.mutate({ propertyId: r.id, datasourceId: r.datasourceId })
                            }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>

          <SensorObjectType type={type} tsps={rows} />
        </div>
      </Collapse>

      <AddTimeSeriesProperty type={type} isOpen={adding} hasAny={rows.length > 0}
        onClose={() => { setAdding(false) }} />
    </section>
  )
}

function AddTimeSeriesProperty({ type, isOpen, hasAny, onClose }: {
  type: ObjectTypeDef
  isOpen: boolean
  /** The first time series property of an object type becomes its default
   *  without being asked, so the checkbox has nothing to decide yet. */
  hasAny: boolean
  onClose: () => void
}) {
  const { data: syncs = [] } = useTimeSeriesSyncs()
  const { data: datasets = [] } = useDatasets()
  const designate = useDesignateTimeSeriesProperty(type.id)
  const createSync = useCreateTimeSeriesSync()

  const [step, setStep] = useState(1)
  const [propertyId, setPropertyId] = useState('')
  const [asDefault, setAsDefault] = useState(false)
  const [syncId, setSyncId] = useState('')
  const [making, setMaking] = useState(false)
  const [datasetId, setDatasetId] = useState('')
  const [name, setName] = useState('')
  const [seriesCol, setSeriesCol] = useState('')
  const [timeCol, setTimeCol] = useState('')
  const [valueCol, setValueCol] = useState('')
  const [unit, setUnit] = useState('')
  const { data: fields = [] } = useDatasetFields(datasetId === '' ? null : datasetId)

  // "The primary key property of an object type cannot be selected as the time
  // series property", and "TSPs cannot be a primary key or title property".
  // Both are already refused by the database; the picker does not offer what
  // would be refused.
  const eligible = type.properties.filter(
    (p) => p.type === 'string' && (p.source ?? 'column') === 'column'
      && p.isPrimaryKey !== true && p.isTitleKey !== true && p.id !== undefined)

  // A TIMESTAMP column is already a timestamp; a long one names its unit.
  const timeField = fields.find((f) => f.name === timeCol)
  const needsUnit = timeField !== undefined && !timeField.type.toUpperCase().startsWith('TIMESTAMP')

  const close = () => {
    onClose(); setStep(1); setPropertyId(''); setAsDefault(false); setSyncId('')
    setMaking(false); setDatasetId(''); setName(''); setSeriesCol(''); setTimeCol('')
    setValueCol(''); setUnit('')
  }

  return (
    <Dialog isOpen={isOpen} onClose={close} title="Time series property setup">
      <DialogBody>
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Select existing property</p>
            <p className="text-xs text-muted-foreground">
              Select an existing object type property with series IDs to set as
              time series property.
            </p>
            <HTMLSelect fill value={propertyId}
              onChange={(e) => { setPropertyId(e.currentTarget.value) }}>
              <option value="">Object type property…</option>
              {eligible.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </HTMLSelect>
            {eligible.length === 0 && (
              <Callout intent="warning" className="!text-xs">
                A time series property is an existing string property that holds
                series IDs. This object type has none that is backed by a column
                and is neither its primary key nor its title key.
              </Callout>
            )}
            <Checkbox checked={!hasAny || asDefault} disabled={!hasAny}
              onChange={(e) => { setAsDefault(e.currentTarget.checked) }}
              labelElement={<span>
                <b>Set as default time series property</b>
                <span className="block text-xs text-muted-foreground">
                  This allows other applications to automatically configure and
                  display this property.{!hasAny && ' The first one always is.'}
                </span>
              </span>} />
          </div>
        )}

        {step === 2 && !making && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Add time series syncs</p>
            <p className="text-xs text-muted-foreground">
              A time series sync indexes the rows of the time series dataset by
              series ID. A dataset may also be selected and it will be indexed
              as a time series sync.
            </p>
            <HTMLSelect fill value={syncId} onChange={(e) => { setSyncId(e.currentTarget.value) }}>
              <option value="">Select a time series sync…</option>
              {syncs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </HTMLSelect>
            <Button size="small" variant="outlined" icon="plus" onClick={() => { setMaking(true) }}>
              Choose file…
            </Button>
            <Callout className="!text-xs">
              One sync per property. Foundry allows several, and reaching them
              needs a column of qualified series IDs, which the reader does not
              parse yet — so a second binding is refused rather than resolved
              against whichever sync answers first.
            </Callout>
          </div>
        )}

        {step === 2 && making && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Index a dataset as a time series sync</p>
            <InputGroup placeholder="Sync name" value={name}
              onValueChange={(v) => { setName(v) }} />
            <HTMLSelect fill value={datasetId} onChange={(e) => {
              setDatasetId(e.currentTarget.value); setSeriesCol(''); setTimeCol(''); setValueCol('')
            }}>
              <option value="">Choose a dataset…</option>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </HTMLSelect>
            {/* The glossary's three columns, in its order. */}
            {([['Series ID', seriesCol, setSeriesCol],
               ['Timestamp', timeCol, setTimeCol],
               ['Value', valueCol, setValueCol]] as const).map(([label, value, set]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-24 text-xs text-muted-foreground">{label}</span>
                <HTMLSelect fill value={value} disabled={datasetId === ''}
                  onChange={(e) => { set(e.currentTarget.value) }}>
                  <option value="">Column…</option>
                  {fields.map((f) => (
                    <option key={f.name} value={f.name}>{f.name} · {f.type}</option>
                  ))}
                </HTMLSelect>
              </div>
            ))}
            {needsUnit && (
              <div className="flex items-center gap-2">
                <span className="w-24 text-xs text-muted-foreground">Unit</span>
                <HTMLSelect fill value={unit} onChange={(e) => { setUnit(e.currentTarget.value) }}>
                  <option value="">A long timestamp names its unit…</option>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </HTMLSelect>
              </div>
            )}
          </div>
        )}
      </DialogBody>

      <DialogFooter actions={
        <>
          {step === 2 && (
            <Button onClick={() => { if (making) { setMaking(false) } else { setStep(1) } }}>Back</Button>
          )}
          {step === 1 && (
            <Button intent={Intent.PRIMARY} disabled={propertyId === ''}
              onClick={() => { setStep(2) }}>Next</Button>
          )}
          {step === 2 && making && (
            <Button intent={Intent.PRIMARY} loading={createSync.isPending}
              disabled={name.trim() === '' || seriesCol === '' || timeCol === '' || valueCol === ''
                || (needsUnit && unit === '')}
              onClick={() => {
                createSync.mutate({
                  datasetId, name, seriesIdColumn: seriesCol, timestampColumn: timeCol,
                  valueColumn: valueCol, timestampUnit: needsUnit ? unit : null,
                }, { onSuccess: (id) => { setSyncId(id); setMaking(false) } })
              }}>
              Index dataset
            </Button>
          )}
          {step === 2 && !making && (
            <Button intent={Intent.PRIMARY} disabled={syncId === ''} loading={designate.isPending}
              onClick={() => {
                designate.mutate({ propertyId, syncId, setDefault: asDefault },
                  { onSuccess: close })
              }}>
              Add property
            </Button>
          )}
        </>
      } />
    </Dialog>
  )
}

/** The BASE FORMATTER cell: an amber `No formatting` tag when unset and a blue
 *  `Time series formatting` tag when set, each opening the same popover. */
function BaseFormatter({ type, row }: { type: ObjectTypeDef; row: TimeSeriesProperty }) {
  const save = useSetTimeSeriesFormatting(type.id)
  const on = row.interpolation !== null || row.units !== null

  // For a sensor object type Foundry withholds this control rather than
  // refusing its value, and substitutes an explanation. Withholding is why no
  // precedence rule is needed: the two editors cannot both be used.
  if (type.isSensor === true) {
    return (
      <Icon icon="info-sign" size={14} className="text-muted-foreground"
        title="Set the units and interpolation in the Sensor object type configuration below." />
    )
  }

  // "point to other `string` properties on this object type" - and not to the
  // time series property itself.
  const targets = type.properties.filter(
    (p) => p.type === 'string' && p.id !== undefined && p.id !== row.id)

  const set = (patch: { interpolation?: FormatterOperand | null; units?: FormatterOperand | null }) => {
    save.mutate({
      propertyId: row.id,
      interpolation: patch.interpolation !== undefined ? patch.interpolation : row.interpolation,
      units: patch.units !== undefined ? patch.units : row.units,
    })
  }

  return (
    <Popover placement="bottom-start" content={
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Time series formatting
          </span>
          <Switch checked={on} className="mb-0"
            onChange={() => { set({ interpolation: null, units: null }) }} />
        </div>

        <p className="text-xs font-medium">Internal Interpolation</p>
        <OperandField operand={row.interpolation} targets={targets}
          choices={INTERPOLATION} labelOf={titleOf}
          onChange={(o) => { set({ interpolation: o }) }} />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Units</span>
          <Switch checked={row.units !== null} className="mb-0"
            onChange={(e) => {
              set({ units: e.currentTarget.checked ? { constant: { value: '' } } : null })
            }} />
        </div>
        {row.units !== null && (
          <OperandField operand={row.units} targets={targets}
            onChange={(o) => { set({ units: o }) }} />
        )}
      </div>
    }>
      <Tag interactive minimal intent={on ? Intent.PRIMARY : Intent.WARNING} endIcon="caret-down">
        {on ? 'Time series formatting' : 'No formatting'}
      </Tag>
    </Popover>
  )
}

/** One operand: a constant, or a reference to a string property. The two
 *  choices are named the way conditional-formatting names them, which is the
 *  only form of this control any page writes down. */
function OperandField({ operand, targets, onChange, choices, labelOf }: {
  operand: FormatterOperand | null
  targets: ObjectTypeDef['properties']
  onChange: (o: FormatterOperand | null) => void
  /** A closed set renders a select. Units have no published set, so no choices
   *  and a free-text input - the page promises a standard set it never prints. */
  choices?: string[]
  labelOf?: (v: string) => string
}) {
  const isRef = operand !== null && 'propertyType' in operand
  const constant = operand !== null && 'constant' in operand ? operand.constant.value : ''
  const ref = isRef ? operand.propertyType.propertyApiName : ''

  return (
    <div className="space-y-1">
      {isRef
        ? (
          <HTMLSelect fill value={ref}
            onChange={(e) => {
              onChange(e.currentTarget.value === ''
                ? null
                : { propertyType: { propertyApiName: e.currentTarget.value } })
            }}>
            <option value="">Choose a property...</option>
            {targets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </HTMLSelect>
        )
        : choices !== undefined
          ? (
            <HTMLSelect fill value={constant}
              onChange={(e) => {
                onChange(e.currentTarget.value === ''
                  ? null
                  : { constant: { value: e.currentTarget.value } })
              }}>
              <option value="">Default for this series type...</option>
              {choices.map((c) => (
                <option key={c} value={c}>{labelOf ? labelOf(c) : c}</option>
              ))}
            </HTMLSelect>
          )
          : (
            <InputGroup value={constant} placeholder="Custom unit"
              onValueChange={(v) => { onChange({ constant: { value: v } }) }} />
          )}
      <Button variant="minimal" size="small"
        onClick={() => {
          onChange(isRef ? { constant: { value: '' } } : { propertyType: { propertyApiName: '' } })
        }}>
        {isRef ? 'Add constant' : 'Add reference'}
      </Button>
    </div>
  )
}

/** The Sensor object type section — "Record time series data for a linked
 *  object type". Built from sensor-object-om-configuration.png, the newer of
 *  the two captures: it has no Primary Sensor Link. */
function SensorObjectType({ type, tsps }: { type: ObjectTypeDef; tsps: TimeSeriesProperty[] }) {
  const { data: links } = useLinkTypes()
  const { data: entries = [] } = useSensorLinks(type.id)
  const setSensor = useSetIsSensor(type.id)
  const save = useSaveSensorLink(type.id)
  const remove = useRemoveSensorLink(type.id)
  const on = type.isSensor === true

  // "at least one link type which links this sensor object type to a root
  // object type" — either side, so both directions are offered.
  const eligible = links.filter(
    (l) => l.source_object_type_id === type.id || l.target_object_type_id === type.id)
  const names = type.properties.filter((p) => p.type === 'string' && p.id !== undefined)

  return (
    <section className="mt-3 rounded border">
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Sensor object type</p>
          <p className="text-xs text-muted-foreground">
            Record time series data for a linked object type.
          </p>
        </div>
        <Switch checked={on} className="mb-0"
          onChange={(e) => { setSensor.mutate(e.currentTarget.checked) }} />
      </div>

      {on && (
        <div className="space-y-3 border-t p-3">
          <div>
            <p className="text-xs font-medium">Sensor link</p>
            <p className="text-xs text-muted-foreground">
              Identify the link to allow root objects to link to the time series
              data of sensor objects.
            </p>
          </div>

          {entries.length === 0 && (
            <Callout intent="warning" className="text-xs">
              A sensor object type records data for a linked object type, and this
              one configures no sensor link yet.
            </Callout>
          )}

          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <HTMLSelect value={e.linkTypeId}
                onChange={(ev) => {
                  save.mutate({ id: e.id, linkTypeId: ev.currentTarget.value,
                    sensorNamePropertyId: e.sensorNamePropertyId })
                }}>
                {eligible.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </HTMLSelect>
              <span className="text-xs text-muted-foreground">Sensor name</span>
              <HTMLSelect value={e.sensorNamePropertyId}
                onChange={(ev) => {
                  save.mutate({ id: e.id, linkTypeId: e.linkTypeId,
                    sensorNamePropertyId: ev.currentTarget.value })
                }}>
                {names.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </HTMLSelect>
              <Button variant="minimal" size="small" icon="trash"
                onClick={() => { remove.mutate(e.id) }} />
            </div>
          ))}

          <Button size="small" variant="outlined" icon="plus"
            disabled={eligible.length === 0 || names.length === 0}
            onClick={() => {
              const used = new Set(entries.map((e) => e.linkTypeId))
              const next = eligible.find((l) => !used.has(l.id))
              if (next !== undefined && names[0]?.id !== undefined) {
                save.mutate({ linkTypeId: next.id, sensorNamePropertyId: names[0].id })
              }
            }}>
            Add new entry
          </Button>

          <div className="border-t pt-3">
            <p className="text-xs font-medium">Is categorical?</p>
            <p className="text-xs text-muted-foreground">
              Select a boolean property to indicate whether each sensor has
              categorical time series data.
            </p>
            <HTMLSelect fill disabled value=""
              title="TimeSeries:MultiSyncNotBuilt — a per-series boolean only decides anything for a property backed by several syncs of mixed kinds, and one sync per property is enforced.">
              <option value="">Only for a property backed by several syncs</option>
            </HTMLSelect>
          </div>

          {tsps.length > 1 && (
            <Callout intent="warning" className="text-xs">
              A sensor object type has one time series property, and this one has
              {' '}{tsps.length}.
            </Callout>
          )}
        </div>
      )}
    </section>
  )
}

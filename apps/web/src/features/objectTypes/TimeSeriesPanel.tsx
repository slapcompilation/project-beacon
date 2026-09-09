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
// Three things it deliberately does NOT draw, each because nothing is behind it:
//   Analyze          — opens Quiver against the series, and our Quiver page
//                      creates analyses without plotting a TSP.
//   Sensor object type — step 3 of Foundry's dialog. Not built, so the dialog
//                      has two steps and says so rather than showing a dead one.
//   Time series formatting — the BASE FORMATTER cell is a live dropdown in
//                      Foundry. Interpolation and units are unbuilt (774 named
//                      them), so the cell shows the state that is actually
//                      true of every row and does nothing.

import { useState } from 'react'
import {
  Button, Callout, Checkbox, Collapse, Dialog, DialogBody, DialogFooter,
  HTMLSelect, Icon, InputGroup, Intent, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import type { ObjectTypeDef } from '@beacon/ontology'
import { useDatasets } from '@/features/datasets/api'
import { useDatasetFields } from './hooks'
import {
  useTimeSeriesProperties, useTimeSeriesSyncs, useCreateTimeSeriesSync,
  useDesignateTimeSeriesProperty, useSetDefaultTimeSeriesProperty,
  useReleaseTimeSeriesProperty,
} from './timeSeries'

/** A long timestamp column carries its unit; a timestamp one is already one. */
const UNITS = ['SECONDS', 'MILLISECONDS', 'MICROSECONDS', 'NANOSECONDS']

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
                          <Tag minimal intent={Intent.WARNING}>No formatting</Tag>
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

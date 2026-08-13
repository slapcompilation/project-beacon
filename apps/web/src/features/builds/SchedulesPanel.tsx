// The schedules sidebar of Data Lineage — "Schedules can be edited, managed,
// and updated in the schedule sidebar of the Data lineage application."
// Create takes a target, a trigger (a time instant, a dataset-updated event,
// or all/any of both), pause resets observation, and the history shows the
// three documented outcomes.

import { useState } from 'react'
import {
  Button, Card, Checkbox, HTMLSelect, Icon, InputGroup, Intent, Switch, Tag,
} from '@blueprintjs/core'
import { useDatasets } from '@/features/datasets/api'
import {
  useCreateSchedule, useDeleteSchedule, useScheduleRuns, useSchedules,
  useSetSchedulePaused, type ScheduleTrigger,
} from './api'

const OUTCOME_INTENT = {
  Succeeded: Intent.SUCCESS, Ignored: Intent.NONE, Failed: Intent.DANGER,
} as const

export function SchedulesPanel() {
  const { data: schedules = [] } = useSchedules()
  const setPaused = useSetSchedulePaused()
  const del = useDeleteSchedule()
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="time" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Schedules</span>
        <Tag minimal className="!text-[10px]">{schedules.length}</Tag>
        <Button variant="minimal" size="small" icon="add" className="ml-auto"
          onClick={() => { setCreating(!creating) }} />
      </div>

      {creating && <CreateSchedule onDone={() => { setCreating(false) }} />}

      {schedules.length === 0 && !creating ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          No schedules. A schedule runs builds on a trigger to keep data flowing.
        </p>
      ) : (
        <ul className="divide-y divide-border/30">
          {schedules.map((s) => (
            <li key={s.id} className="px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <button type="button" className="font-medium truncate flex-1 text-left"
                  onClick={() => { setOpenId(openId === s.id ? null : s.id) }}>
                  {s.name}
                </button>
                <Tag minimal className="!text-[9px]">{describeTrigger(s.trigger)}</Tag>
                <Switch checked={!s.paused} className="!m-0"
                  title={s.paused ? 'Paused — all observed events were forgotten.' : 'Running'}
                  onChange={() => { setPaused.mutate({ id: s.id, paused: !s.paused }) }} />
                <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER}
                  onClick={() => { del.mutate(s.id) }} />
              </div>
              {openId === s.id && <RunHistory scheduleId={s.id} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function describeTrigger(t: ScheduleTrigger): string {
  if (t.type === 'time') return t.cron ?? 'time'
  if (t.type === 'event') return 'on update'
  return `${t.type} of ${String(t.triggers?.length ?? 0)}`
}

function RunHistory({ scheduleId }: { scheduleId: string }) {
  const { data: runs = [] } = useScheduleRuns(scheduleId)
  if (runs.length === 0) {
    return <p className="mt-1 text-[11px] text-muted-foreground">Never run.</p>
  }
  return (
    <ul className="mt-1 space-y-0.5">
      {runs.map((r) => (
        <li key={r.id} className="flex items-center gap-2 text-[11px]">
          <Tag minimal intent={OUTCOME_INTENT[r.outcome]} className="!text-[9px]">{r.outcome}</Tag>
          <span className="text-muted-foreground">{new Date(r.ranAt).toLocaleString()}</span>
          {r.error && <span className="text-muted-foreground truncate">{r.error}</span>}
        </li>
      ))}
    </ul>
  )
}

function CreateSchedule({ onDone }: { onDone: () => void }) {
  const create = useCreateSchedule()
  const { data: datasets = [] } = useDatasets()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [buildType, setBuildType] = useState<'single' | 'full'>('single')
  const [useTime, setUseTime] = useState(true)
  const [cron, setCron] = useState('0 9 * * *')
  const [timezone, setTimezone] = useState('UTC')
  const [useEvent, setUseEvent] = useState(false)
  const [eventDataset, setEventDataset] = useState('')
  const [combine, setCombine] = useState<'and' | 'or'>('or')

  const submit = () => {
    const parts: ScheduleTrigger[] = []
    if (useTime) parts.push({ type: 'time', cron: cron.trim(), timezone: timezone.trim() })
    if (useEvent && eventDataset) parts.push({ type: 'event', event: 'data_updated', dataset_id: eventDataset })
    const trigger = parts.length === 1 ? parts[0] : { type: combine, triggers: parts }
    create.mutate(
      { name: name.trim(), targetDatasetIds: [target], buildType, trigger },
      { onSuccess: onDone })
  }

  return (
    <div className="px-3 py-2 space-y-2 border-b border-border">
      <InputGroup size="small" value={name} placeholder="Schedule name"
        onChange={(e) => { setName(e.currentTarget.value) }} />
      <div className="flex items-center gap-2">
        <HTMLSelect value={target} onChange={(e) => { setTarget(e.currentTarget.value) }}>
          <option value="">Target dataset…</option>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </HTMLSelect>
        <HTMLSelect value={buildType} onChange={(e) => { setBuildType(e.currentTarget.value as 'single' | 'full') }}>
          <option value="single">Single build</option>
          <option value="full">Full build (include upstream)</option>
        </HTMLSelect>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Checkbox checked={useTime} className="!m-0" label="At time"
          onChange={(e) => { setUseTime(e.currentTarget.checked) }} />
        {useTime && (
          <>
            <InputGroup size="small" className="w-28 font-mono" value={cron}
              onChange={(e) => { setCron(e.currentTarget.value) }} />
            <InputGroup size="small" className="w-32" value={timezone}
              onChange={(e) => { setTimezone(e.currentTarget.value) }} />
          </>
        )}
        <Checkbox checked={useEvent} className="!m-0" label="When dataset updates"
          onChange={(e) => { setUseEvent(e.currentTarget.checked) }} />
        {useEvent && (
          <HTMLSelect value={eventDataset} onChange={(e) => { setEventDataset(e.currentTarget.value) }}>
            <option value="">Watch…</option>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </HTMLSelect>
        )}
        {useTime && useEvent && (
          <HTMLSelect value={combine} onChange={(e) => { setCombine(e.currentTarget.value as 'and' | 'or') }}>
            <option value="or">Any of these triggers</option>
            <option value="and">All of these triggers</option>
          </HTMLSelect>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="small" intent={Intent.PRIMARY} icon="tick" loading={create.isPending}
          disabled={!name.trim() || !target || (!useTime && !(useEvent && eventDataset))}
          onClick={submit}>
          Save schedule
        </Button>
        <Button variant="minimal" size="small" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

// The transform on a dataset: declared inputs (the InputSpecs), one SQL
// SELECT as the logic, publish as the JobSpec, and Build now. Each input is
// visible to the logic as a CTE named by its api_name over its current
// master view — the placeholder says so, because nothing else would.

import { useEffect, useState } from 'react'
import { Button, Card, HTMLSelect, Icon, Intent, Tag, TextArea } from '@blueprintjs/core'
import { useDatasets } from '@/features/datasets/api'
import {
  useAddDatasetInput, useDatasetInputs, useJobSpec, useJobSpecFresh,
  usePublishJobSpec, useRemoveDatasetInput, useRunBuild,
} from './api'

export function TransformCard({ datasetId }: { datasetId: string }) {
  const { data: spec } = useJobSpec(datasetId)
  const { data: fresh } = useJobSpecFresh(spec?.id ?? null)
  const { data: inputs = [] } = useDatasetInputs(datasetId)
  const { data: datasets = [] } = useDatasets()
  const addInput = useAddDatasetInput(datasetId)
  const removeInput = useRemoveDatasetInput(datasetId)
  const publish = usePublishJobSpec(datasetId)
  const run = useRunBuild()
  const [logic, setLogic] = useState('')
  const [pickedInput, setPickedInput] = useState('')

  useEffect(() => { setLogic(spec?.logicSql ?? '') }, [spec?.logicSql])

  const inputChoices = datasets.filter((d) =>
    d.id !== datasetId && !inputs.some((i) => i.inputDatasetId === d.id))

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="function" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Transform</span>
        {spec && <Tag minimal className="!text-[10px]">v{spec.version}</Tag>}
        {spec && (
          <Tag minimal intent={fresh ? Intent.SUCCESS : Intent.WARNING} className="!text-[10px]"
            title={fresh
              ? 'Inputs and logic are unchanged since the last build; a build would be skipped.'
              : 'Inputs or logic changed since the last build.'}>
            {fresh ? 'fresh' : 'stale'}
          </Tag>
        )}
        <span className="text-[11px] text-muted-foreground/70 ml-1">
          One SQL SELECT over the declared inputs computes this dataset.
        </span>
      </div>

      <div className="px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inputs</span>
          {inputs.map((i) => (
            <Tag key={i.inputDatasetId} minimal onRemove={() => { removeInput.mutate(i.inputDatasetId) }}>
              {i.name} <span className="font-mono text-[10px] opacity-60">{i.apiName}</span>
            </Tag>
          ))}
          <HTMLSelect minimal value={pickedInput} onChange={(e) => { setPickedInput(e.currentTarget.value) }}>
            <option value="">Add input…</option>
            {inputChoices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </HTMLSelect>
          {pickedInput && (
            <Button size="small" icon="add"
              onClick={() => { addInput.mutate(pickedInput, { onSuccess: () => { setPickedInput('') } }) }} />
          )}
        </div>

        <TextArea fill rows={4} className="font-mono !text-xs" value={logic}
          placeholder={inputs.length > 0
            ? `SELECT … FROM ${inputs[0].apiName} …`
            : 'Declare an input first; each input is a table named by its api name.'}
          onChange={(e) => { setLogic(e.currentTarget.value) }} />

        <div className="flex items-center gap-2">
          <Button size="small" icon="upload" loading={publish.isPending}
            disabled={logic.trim() === '' || inputs.length === 0}
            onClick={() => { publish.mutate(logic.trim()) }}>
            {spec ? 'Publish new logic' : 'Publish JobSpec'}
          </Button>
          {spec && (
            <>
              <Button size="small" icon="play" intent={Intent.PRIMARY} loading={run.isPending}
                onClick={() => { run.mutate({ targets: [datasetId] }) }}>
                Build
              </Button>
              <Button size="small" variant="outlined" loading={run.isPending}
                title="Ignore staleness information when running the build."
                onClick={() => { run.mutate({ targets: [datasetId], force: true }) }}>
                Force build
              </Button>
              <Button size="small" variant="outlined" loading={run.isPending}
                title="Build all target datasets and all upstream datasets of this target."
                onClick={() => { run.mutate({ targets: [datasetId], buildType: 'full' }) }}>
                Build with upstream
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

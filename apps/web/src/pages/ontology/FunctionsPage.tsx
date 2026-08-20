// Functions — the resource page the engine has been waiting for.
//
// The layout is the Functions helper, `tsv2-functions-helper-run.png`: a list on
// the left carrying each function's version, and on the right the selected one
// with `Inputs` above `Output`. Its version picker, `Deployed` selector and
// `Evals` link are not built — we have one runtime and no evals — and the
// **Live Preview** half of its toggle is not built either, for a reason rather
// than an omission: our runner resolves a *published* version, so there is no
// uncommitted-code path to preview.
//
// Nothing here re-implements a versioning rule. `guard_function_version` decides
// whether a version may be published — forward, immutable, and major-bumped when
// the signature breaks past 1.0.0 — and this page shows what it says.

import { useMemo, useState } from 'react'
import {
  Button, Callout, Card, HTMLSelect, InputGroup, Intent, NonIdealState,
  Spinner, Tab, Tabs, Tag, TextArea,
} from '@blueprintjs/core'
import { toCamel } from '@beacon/ontology'
import { useObjectTypes } from '@/features/objectTypes/hooks'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { useOmaOntology } from '@/features/ontologyManager/resources'
import {
  useFunctions, useFunctionVersions, useCreateFunction, usePublishVersion,
  useRunFunction, versionString, type Signature, type FunctionVersion,
} from '@/features/functions/api'

/** The base types a parameter may take, as the signature's own vocabulary. */
const PARAM_TYPES = ['string', 'Integer', 'Long', 'Float', 'Double', 'Boolean', 'Date', 'Timestamp']

export default function FunctionsPage() {
  const { ontology, isLoading } = useOmaOntology()
  const ontologyId = ontology?.id ?? null
  const { data: functions = [] } = useFunctions(ontologyId)
  const [selected, setSelected] = useState<string | null>(null)
  const current = functions.find((f) => f.id === selected) ?? null

  if (isLoading) return <Spinner size={20} />
  if (!ontology) return <NoOntologyCallout />

  return (
    <section className="space-y-3 p-4">
      <header className="flex items-center gap-2">
        <h1 className="text-base font-semibold">Functions</h1>
        <Tag minimal round className="tabular-nums">{functions.length}</Tag>
      </header>

      <Callout intent="none" icon="info-sign" className="!text-xs">
        A function is versioned code run in an isolate. Every ontology read it makes is
        performed with <strong>your</strong> permissions, so it sees what you see.
      </Callout>

      <div className="flex flex-wrap items-start gap-3">
        <div className="w-64 shrink-0 space-y-2">
          <FunctionList functions={functions} selected={selected} onSelect={setSelected} />
          <NewFunction ontologyId={ontologyId} onCreated={setSelected} />
        </div>
        <div className="min-w-[420px] flex-1">
          {current
            ? <FunctionDetail key={current.id} ontologyId={ontologyId}
                fn={current} />
            : <NonIdealState icon="function" title="No function selected"
                description="Pick one to see its versions, publish a new one, or run it." />}
        </div>
      </div>
    </section>
  )
}

function FunctionList({ functions, selected, onSelect }: {
  functions: { id: string; api_name: string; display_name: string }[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  if (functions.length === 0) {
    return <p className="text-xs text-muted-foreground">No functions in this ontology yet.</p>
  }
  return (
    <div className="rounded border">
      {functions.map((f) => (
        <button key={f.id} type="button"
          onClick={() => { onSelect(f.id) }}
          className={`flex w-full items-center gap-2 border-b px-2 py-1.5 text-left text-xs last:border-b-0 ${
            selected === f.id ? 'bg-blue-50 font-semibold' : ''}`}>
          <span className="flex-1 font-mono">{f.api_name}</span>
          <LatestTag functionId={f.id} />
        </button>
      ))}
    </div>
  )
}

/** The list in the helper carries each function's version beside its name. */
function LatestTag({ functionId }: { functionId: string }) {
  const { data: versions = [] } = useFunctionVersions(functionId)
  const latest = versions.at(0)
  return latest
    ? <Tag minimal className="!text-[10px] tabular-nums">{versionString(latest)}</Tag>
    : <Tag minimal intent={Intent.WARNING} className="!text-[10px]">unpublished</Tag>
}

function NewFunction({ ontologyId, onCreated }: {
  ontologyId: string | null; onCreated: (id: string) => void
}) {
  const create = useCreateFunction(ontologyId)
  const [label, setLabel] = useState('')
  const apiName = toCamel(label)
  return (
    <Card className="space-y-2 !p-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        New function
      </span>
      <InputGroup size="small" placeholder="Display name" value={label}
        onValueChange={setLabel} />
      {label && <Tag minimal className="font-mono !text-[10px]">{apiName}</Tag>}
      <Button size="small" icon="add" disabled={!apiName || !ontologyId} loading={create.isPending}
        onClick={() => {
          create.mutate({ apiName, displayName: label.trim(), description: '' },
            { onSuccess: (id) => { onCreated(id); setLabel('') } })
        }}>Create</Button>
    </Card>
  )
}

function FunctionDetail({ ontologyId, fn }: {
  ontologyId: string | null
  fn: { id: string; api_name: string; display_name: string }
}) {
  const { data: versions = [] } = useFunctionVersions(fn.id)
  const latest = versions.at(0) ?? null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold">{fn.api_name}</span>
        {latest && <Tag minimal className="tabular-nums">{versionString(latest)}</Tag>}
      </div>

      <Tabs id="fn" animate={false}>
        <Tab id="run" title="Run" icon="play" panel={
          <RunPanel ontologyId={ontologyId} apiName={fn.api_name} latest={latest} />} />
        <Tab id="publish" title="Publish" icon="upload" panel={
          <PublishPanel functionId={fn.id} latest={latest} />} />
        <Tab id="versions" title={`Versions (${versions.length})`} icon="history" panel={
          <VersionList versions={versions} />} />
      </Tabs>
    </div>
  )
}

/** Inputs come from the signature, which is why an unpublished function cannot
 *  be run: there is no signature to build a form from. */
function RunPanel({ ontologyId, apiName, latest }: {
  ontologyId: string | null; apiName: string; latest: FunctionVersion | null
}) {
  const run = useRunFunction(ontologyId)
  const [inputs, setInputs] = useState<Record<string, string>>({})

  if (!latest) {
    return <Callout intent={Intent.WARNING} className="!text-xs">
      Publish a version first — only a published version runs.
    </Callout>
  }
  const params = latest.signature.parameters
  const missing = params.some((p) => p.required && !(inputs[p.name] ?? '').trim())

  return (
    <div className="space-y-2">
      <div className="rounded border">
        <p className="border-b bg-neutral-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest">
          Inputs
        </p>
        <div className="space-y-2 p-2">
          {params.length === 0
            ? <p className="text-xs text-muted-foreground">This function has no inputs.</p>
            : params.map((p) => (
                <label key={p.name} className="flex items-center gap-2 text-xs">
                  <span className="w-40 font-mono">{p.name}</span>
                  <Tag minimal className="!text-[10px]">{p.type}</Tag>
                  <InputGroup size="small" className="flex-1"
                    placeholder={p.required ? 'required' : 'optional'}
                    value={inputs[p.name] ?? ''}
                    onValueChange={(v) => { setInputs({ ...inputs, [p.name]: v }) }} />
                </label>
              ))}
          <Button intent={Intent.PRIMARY} size="small" icon="play" disabled={missing}
            loading={run.isPending}
            onClick={() => {
              // The signature says what each input IS; the form only has text.
              const typed: Record<string, unknown> = Object.fromEntries(
                params.map((p): [string, unknown] => {
                  const raw = inputs[p.name] ?? ''
                  if (raw === '') return [p.name, null]
                  if (['Integer', 'Long', 'Float', 'Double'].includes(p.type)) return [p.name, Number(raw)]
                  if (p.type === 'Boolean') return [p.name, raw === 'true']
                  return [p.name, raw]
                }))
              run.mutate({ apiName, inputs: typed, version: versionString(latest) })
            }}>Run</Button>
        </div>
      </div>

      {run.data && (
        <div className="rounded border">
          <p className="flex items-center gap-2 border-b bg-neutral-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest">
            Output
            <span className="flex-1" />
            <span className="font-normal normal-case tracking-normal text-neutral-500">
              Ran in {(run.data.ms / 1000).toFixed(2)} seconds
            </span>
          </p>
          <div className="p-2">
            {run.data.error
              // The isolate's failures are namespaced — Functions:TimeLimitExceeded,
              // Functions:UserFacingError — so they are shown as they arrive.
              ? <Callout intent={Intent.DANGER} className="!text-xs">
                  <span className="font-mono">{run.data.error}</span>
                  {run.data.detail && <p className="mt-1 font-mono text-[11px]">{run.data.detail}</p>}
                </Callout>
              : <pre className="overflow-x-auto text-xs">{JSON.stringify(run.data.value, null, 2)}</pre>}
          </div>
        </div>
      )}
    </div>
  )
}

function PublishPanel({ functionId, latest }: {
  functionId: string; latest: FunctionVersion | null
}) {
  const publish = usePublishVersion(functionId)
  const { data: types = [] } = useObjectTypes()
  const [source, setSource] = useState(latest?.source ?? 'export default function f() {\n  return 42\n}\n')
  const [returns, setReturns] = useState(latest?.signature.returns ?? 'Integer')
  const [params, setParams] = useState<Signature['parameters']>(latest?.signature.parameters ?? [])
  const [imports, setImports] = useState<string[]>(latest?.imports.object_types ?? [])

  // "Patches are used to signal backwards compatible bug fixes… Minor versions…
  // do not require consumers' adjustments… Major versions… breaking changes."
  const bumps = useMemo(() => {
    const b = latest ?? { major: 0, minor: 0, patch: 0 }
    return [
      { kind: 'patch', v: [b.major, b.minor, b.patch + 1] as const },
      { kind: 'minor', v: [b.major, b.minor + 1, 0] as const },
      { kind: 'major', v: [b.major + 1, 0, 0] as const },
    ]
  }, [latest])
  const [bump, setBump] = useState('minor')
  const chosen = bumps.find((b) => b.kind === bump) ?? bumps[1]

  return (
    <div className="space-y-2">
      <TextArea fill rows={10} value={source} onChange={(e) => { setSource(e.currentTarget.value) }}
        className="!font-mono !text-xs" />

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Returns</span>
          <HTMLSelect value={returns} onChange={(e) => { setReturns(e.currentTarget.value) }}>
            {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </HTMLSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Version</span>
          <HTMLSelect value={bump} onChange={(e) => { setBump(e.currentTarget.value) }}>
            {bumps.map((b) => (
              <option key={b.kind} value={b.kind}>{b.kind} — {b.v.join('.')}</option>
            ))}
          </HTMLSelect>
        </label>
        <Button intent={Intent.PRIMARY} icon="upload" loading={publish.isPending}
          onClick={() => {
            publish.mutate({
              major: chosen.v[0], minor: chosen.v[1], patch: chosen.v[2],
              source, signature: { parameters: params, returns }, objectTypes: imports,
            })
          }}>Publish {chosen.v.join('.')}</Button>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inputs</span>
        {params.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <InputGroup size="small" placeholder="name" value={p.name} className="font-mono"
              onValueChange={(v) => { setParams(params.map((x, j) => (j === i ? { ...x, name: v } : x))) }} />
            <HTMLSelect value={p.type}
              onChange={(e) => { setParams(params.map((x, j) => (j === i ? { ...x, type: e.currentTarget.value } : x))) }}>
              {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </HTMLSelect>
            <Button variant="minimal" size="small" icon="cross"
              onClick={() => { setParams(params.filter((_, j) => j !== i)) }} />
          </div>
        ))}
        <Button variant="minimal" size="small" icon="add"
          onClick={() => { setParams([...params, { name: '', type: 'string', required: true }]) }}>
          Add input
        </Button>
      </div>

      {/* "the host answers three read operations and nothing else, and only for
          object types the published version declared as imports" — so an
          undeclared type is unreadable, not merely unlisted. */}
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Declared object types
        </span>
        <p className="text-[11px] text-muted-foreground">
          The isolate may read these and nothing else.
        </p>
        <div className="flex flex-wrap gap-1">
          {types.map((t) => (
            <Tag key={t.id} interactive minimal={!imports.includes(t.id)}
              intent={imports.includes(t.id) ? Intent.PRIMARY : Intent.NONE}
              className="!text-[10px]"
              onClick={() => {
                setImports(imports.includes(t.id)
                  ? imports.filter((x) => x !== t.id) : [...imports, t.id])
              }}>{t.api_name}</Tag>
          ))}
        </div>
      </div>
    </div>
  )
}

function VersionList({ versions }: { versions: FunctionVersion[] }) {
  if (versions.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing published yet.</p>
  }
  return (
    <div className="space-y-1">
      {versions.map((v) => (
        <div key={v.id} className="rounded border px-2 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold tabular-nums">{versionString(v)}</span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(v.published_at).toLocaleString()}
            </span>
            <span className="flex-1" />
            <Tag minimal className="!text-[10px]">
              {v.signature.parameters.length} in → {v.signature.returns}
            </Tag>
          </div>
          {/* Recorded by 597 whether or not it blocked: at 0.x the check runs and
              the release stands, so the finding has to be visible somewhere. */}
          {v.breaking_changes.length > 0 && (
            <p className="mt-1 text-[11px] text-amber-700">
              Breaking: {v.breaking_changes.join('; ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

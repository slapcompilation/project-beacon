// Author an agent as data, see exactly what it compiles to, and test-run it.
//
// The compiled-prompt preview is free (pure function, no model call). The test
// run is NOT — it calls the real LLM, so it only ever happens on an explicit
// click and says so on the button.

import { useMemo, useState } from 'react'
import {
  Button, Callout, Card, Checkbox, HTMLSelect, Icon, InputGroup, Intent, NumericInput, Tag, TextArea,
} from '@blueprintjs/core'
import {
  AGENT_CADENCES, compileAgent, describeAuthoredAgent, validateAuthoredAgent,
  buildAuthoredAgentTools, runAuthoredAgent, toSlug,
  type AgentApproval, type AgentCadence, type AgentScope, type AuthoredAgentOutput, type ProcedureStep,
} from '@beacon/reality-graph'
import { toolDescriptors } from '@/features/agentStudio/registry'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'
import { AnthropicLLMClient } from '@/features/agents/anthropicLLM'
import { useAuthoredLogicTools } from '@/features/userTools/hooks'
import { useCreateUserAgent } from './hooks'

/** Only tools the runner can actually resolve are offered — a name the operator
 *  can pick is always a tool the model can call. */
const RUNNABLE = new Set(buildAuthoredAgentTools(makeSupabaseGraphReader()).keys())
const SHIPPED = toolDescriptors.filter((t) => RUNNABLE.has(t.name))
  .map((t) => ({ name: t.name, description: t.description, authored: false }))

export default function AgentComposer({ onDone }: { onDone: () => void }) {
  const create = useCreateUserAgent()
  const authored = useAuthoredLogicTools()

  // The org's own tools sit alongside the shipped ones — same registry the
  // runner builds, so what's offered is exactly what's callable.
  const pickable = useMemo(() => [
    ...SHIPPED,
    ...(authored.data ?? []).map((t) => ({ name: t.name, description: t.description, authored: true })),
  ], [authored.data])

  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [scope, setScope] = useState<AgentScope>('hotel')
  const [cadence, setCadence] = useState<AgentCadence>('daily')
  const [approval, setApproval] = useState<AgentApproval>('review')
  const [toolset, setToolset] = useState<string[]>([])
  const [procedure, setProcedure] = useState<ProcedureStep[]>([{ instruction: '' }])
  const [threshold, setThreshold] = useState(60)

  const [situation, setSituation] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ output: AuthoredAgentOutput; steps: number } | null>(null)

  const draft = {
    name, apiName: toSlug(name), purpose, scope, cadence, approval,
    toolset, procedure, clarificationThreshold: threshold / 100,
  }
  const errors = validateAuthoredAgent(draft, pickable.map((t) => t.name))
  const compiled = useMemo(() => (errors.length === 0 ? compileAgent(draft) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [errors.length, name, purpose, scope, toolset, procedure, threshold])

  async function testRun() {
    setRunning(true)
    setResult(null)
    try {
      const run = await runAuthoredAgent({
        def: draft,
        llm: new AnthropicLLMClient(),
        toolRegistry: buildAuthoredAgentTools(makeSupabaseGraphReader(), authored.data ?? []),
        situation: situation.trim() || 'Give a general assessment for this scope.',
      })
      setResult({ output: run.output, steps: run.trace.steps.length })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon="predictive-analysis" size={14} />
        <h3 className="text-sm font-semibold">New agent</h3>
        <Button size="small" variant="minimal" icon="cross" className="ml-auto" onClick={onDone} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Name">
          <InputGroup value={name} placeholder="Expiry watcher" style={{ width: 190 }}
            onChange={(e) => { setName(e.target.value) }} />
        </Field>
        <Field label="Scope">
          <HTMLSelect value={scope} onChange={(e) => { setScope(e.currentTarget.value as AgentScope) }}
            options={[{ value: 'hotel', label: 'hotel' }, { value: 'organization', label: 'organization' }]} />
        </Field>
        <Field label="Cadence">
          <HTMLSelect value={cadence} onChange={(e) => { setCadence(e.currentTarget.value as AgentCadence) }}
            options={AGENT_CADENCES.map((c) => ({ value: c.cadence, label: c.label }))} />
        </Field>
        <Field label="Output">
          <HTMLSelect value={approval} onChange={(e) => { setApproval(e.currentTarget.value as AgentApproval) }}
            options={[{ value: 'review', label: 'queue for review' }, { value: 'auto', label: 'auto-execute if gate allows' }]} />
        </Field>
        <Field label="Ask below">
          <div className="flex items-center gap-1">
            <NumericInput value={threshold} min={0} max={100} stepSize={5} style={{ width: 70 }} buttonPosition="none"
              onValueChange={(v) => { setThreshold(Math.round(Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0)))) }} />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </Field>
      </div>

      <Field label="Purpose — one sentence">
        <TextArea value={purpose} fill rows={2} placeholder="Flags perishable stock that will expire before it is consumed."
          onChange={(e) => { setPurpose(e.target.value) }} />
      </Field>

      <div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tools it may call</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 mt-1">
          {pickable.map((t) => (
            <Checkbox key={t.name} checked={toolset.includes(t.name)} className="!mb-1"
              onChange={() => {
                setToolset(toolset.includes(t.name) ? toolset.filter((x) => x !== t.name) : [...toolset, t.name])
              }}
              labelElement={
                <span className="text-xs">
                  <span className="font-mono">{t.name}</span>
                  {t.authored && <Tag minimal className="!text-[9px] mx-1">authored</Tag>}
                  <span className="text-muted-foreground">— {t.description.slice(0, 60)}…</span>
                </span>
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Procedure — one step at a time</span>
        {procedure.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}.</span>
            <HTMLSelect value={s.tool ?? ''} onChange={(e) => {
              const v = e.currentTarget.value
              setProcedure(procedure.map((x, j) => (j === i ? { ...x, tool: v || undefined } : x)))
            }} options={[{ value: '', label: 'no tool' }, ...toolset.map((t) => ({ value: t, label: t }))]} />
            <InputGroup fill value={s.instruction} placeholder="What to do at this step"
              onChange={(e) => { setProcedure(procedure.map((x, j) => (j === i ? { ...x, instruction: e.target.value } : x))) }} />
            <Button size="small" variant="minimal" icon="cross" disabled={procedure.length === 1}
              onClick={() => { setProcedure(procedure.filter((_, j) => j !== i)) }} />
          </div>
        ))}
        <Button size="small" variant="minimal" icon="add" onClick={() => { setProcedure([...procedure, { instruction: '' }]) }}>
          Add step
        </Button>
      </div>

      {name.trim() !== '' && errors.length > 0 && (
        <ul className="text-[11px] text-amber-600 list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}

      {compiled && (
        <>
          <p className="text-xs text-muted-foreground italic">{describeAuthoredAgent(draft)}</p>
          <details className="text-[11px]">
            <summary className="cursor-pointer text-muted-foreground">What this compiles to</summary>
            <pre className="mt-1 p-2 rounded bg-muted/40 whitespace-pre-wrap text-[10px] leading-snug max-h-64 overflow-auto">
              {compiled.systemPrompt}{'\n\n---\n\n'}{compiled.taskPrompt}
            </pre>
          </details>

          <Callout intent={Intent.NONE} icon="lab-test" className="!p-2">
            <div className="flex items-center gap-2 flex-wrap">
              <InputGroup value={situation} placeholder="Situation to test against" style={{ width: 260 }}
                onChange={(e) => { setSituation(e.target.value) }} />
              <Button size="small" icon="play" loading={running} onClick={() => { void testRun() }}>
                Test run
              </Button>
              <span className="text-[10px] text-muted-foreground">calls the real model — costs a request</span>
            </div>
            {result && (
              <div className="mt-2 text-[11px] space-y-1">
                <div className="flex items-center gap-2">
                  <Tag minimal intent={result.output.outcome === 'proposal' ? Intent.SUCCESS : result.output.outcome === 'clarification' ? Intent.WARNING : Intent.NONE}
                    className="!text-[10px]">{result.output.outcome}</Tag>
                  <span className="tabular-nums">confidence {Math.round(result.output.confidence * 100)}%</span>
                  <span className="text-muted-foreground">{result.steps} trace step(s)</span>
                </div>
                <p className="text-muted-foreground">{result.output.reasoning}</p>
              </div>
            )}
          </Callout>
        </>
      )}

      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} icon="floppy-disk" loading={create.isPending} disabled={errors.length > 0}
          onClick={() => {
            create.mutate({ ...draft, apiName: toSlug(name) }, { onSuccess: onDone })
          }}>
          Create agent
        </Button>
        {name.trim() !== '' && <span className="text-[11px] text-muted-foreground">api name: <code>{toSlug(name)}</code></span>}
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

// The Logic canvas, editable — for authored agents, whose procedure is data.
//
// #330 shipped the canvas as a VIEWER on shipped agents, and it has to stay one
// there: those blocks are `BlockDef`s in TypeScript with zod schemas, so editing
// them means generating code. Authored agents are the half that is data, and
// this is their editor.
//
// WHAT THIS DELIBERATELY DOES NOT ADD. Foundry's AIP Logic has six block types —
// Use LLM, Apply action, Execute function, Conditional, Loop, Create variable —
// and it EXECUTES them: a Conditional actually branches. Our procedure compiles
// into a numbered task prompt that an LLM follows (`compileAgent`), so a
// Conditional block here would become the sentence "if X then Y" and the model
// would decide. That is prose wearing a block's clothes — the dead vocabulary
// this codebase keeps deleting. Blocks arrive when the runtime executes them.
//
// So every step is Foundry's Use LLM block: a prompt, optionally a tool. What
// the canvas adds over the row form is the thing a list cannot show — the TYPED
// HANDOFF. Pick `forecast_consumption` on step 2 and step 3 is written knowing
// it will have `projectedUnits`, `basis` and `confidence` to work with.

import { Button, Callout, Card, HTMLSelect, Icon, Intent, Tag, TextArea } from '@blueprintjs/core'
import type { ProcedureStep } from '@beacon/reality-graph'
import { describeSchema, getToolDescriptor } from '@/features/agentStudio/registry'
import { cn } from '@/lib/utils'

export function LogicCanvasEditor({
  procedure, toolset, threshold, onChange,
}: {
  procedure: ProcedureStep[]
  /** The tools this agent may call. A step can only name one of these. */
  toolset: string[]
  /** Below this the agent must ask instead of proposing. */
  threshold: number
  onChange: (next: ProcedureStep[]) => void
}) {
  const set = (i: number, patch: Partial<ProcedureStep>) => {
    onChange(procedure.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }
  const move = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= procedure.length) return
    const next = [...procedure]
    const [moved] = next.splice(i, 1)
    next.splice(j, 0, moved)
    onChange(next)
  }

  return (
    <div className="space-y-0">
      {toolset.length === 0 && (
        <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs mb-2">
          Pick the agent's tools first — a step can only call a tool the agent is allowed to call.
        </Callout>
      )}

      {procedure.map((step, i) => {
        const tool = step.tool ? getToolDescriptor(step.tool) : undefined
        const returns = tool ? describeSchema(tool.outputSchema) : []
        return (
          <div key={i}>
            <BlockCard
              idx={i + 1}
              step={step}
              toolset={toolset}
              first={i === 0}
              last={i === procedure.length - 1}
              onlyStep={procedure.length === 1}
              onChange={(patch) => { set(i, patch) }}
              onMove={(d) => { move(i, d) }}
              onRemove={() => { onChange(procedure.filter((_, j) => j !== i)) }}
            />
            {/* The handoff. What the next step will have to work with — the one
                thing a list of instructions cannot tell an author. */}
            <Handoff fields={returns} toolName={step.tool} />
          </div>
        )
      })}

      {/* Appended by compileAgent, never authored. Showing it means an author
          can see where their procedure actually ends. */}
      <Card compact className="!border-dashed opacity-80">
        <div className="flex items-center gap-2">
          <Tag minimal round className="!text-[10px]">{procedure.length + 1}</Tag>
          <Icon icon="help" size={12} className="text-muted-foreground" />
          <span className="text-xs">
            If confidence is below <strong className="tabular-nums">{threshold.toFixed(2)}</strong>,
            call <code>request_clarification</code> instead of proposing.
          </span>
          <Tag minimal className="!text-[9px] ml-auto">always added</Tag>
        </div>
      </Card>

      <Button className="mt-2" size="small" variant="minimal" icon="add"
        onClick={() => { onChange([...procedure, { instruction: '' }]) }}>
        Add step
      </Button>
    </div>
  )
}

function BlockCard({
  idx, step, toolset, first, last, onlyStep, onChange, onMove, onRemove,
}: {
  idx: number
  step: ProcedureStep
  toolset: string[]
  first: boolean
  last: boolean
  onlyStep: boolean
  onChange: (patch: Partial<ProcedureStep>) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const empty = !step.instruction.trim()
  return (
    <Card compact className={cn('space-y-2', empty && '!border-amber-400/60')}>
      <div className="flex items-center gap-2">
        <Tag minimal round intent={Intent.PRIMARY} className="!text-[10px] tabular-nums">{idx}</Tag>
        <HTMLSelect value={step.tool ?? ''} className="!text-xs"
          onChange={(e) => { onChange({ tool: e.currentTarget.value || undefined }) }}>
          <option value="">No tool — reasoning only</option>
          {toolset.map((t) => <option key={t} value={t}>{t}</option>)}
        </HTMLSelect>
        <div className="ml-auto flex items-center gap-0.5">
          {/* Order is the meaning of a numbered procedure, so moving a step is
              a first-class control rather than cut-and-paste. */}
          <Button variant="minimal" size="small" icon="chevron-up" disabled={first}
            title="Move earlier" onClick={() => { onMove(-1) }} />
          <Button variant="minimal" size="small" icon="chevron-down" disabled={last}
            title="Move later" onClick={() => { onMove(1) }} />
          <Button variant="minimal" size="small" icon="cross" intent={Intent.DANGER}
            disabled={onlyStep} title="Remove step" onClick={onRemove} />
        </div>
      </div>
      <TextArea fill rows={2} value={step.instruction} className="!text-xs"
        placeholder={step.tool
          ? `What to do with what ${step.tool} returns`
          : 'What the agent should do at this step'}
        onChange={(e) => { onChange({ instruction: e.target.value }) }} />
    </Card>
  )
}

function Handoff({ fields, toolName }: { fields: { name: string; type: string }[]; toolName?: string }) {
  return (
    <div className="flex items-center gap-1.5 py-1 pl-4">
      <Icon icon="arrow-down" size={11} className="text-muted-foreground/50" />
      {fields.length === 0 ? (
        <span className="text-[10px] text-muted-foreground/70">
          {toolName ? 'returns nothing typed' : 'carries the reasoning forward'}
        </span>
      ) : (
        <>
          <span className="text-[10px] text-muted-foreground/70">next step has</span>
          {fields.slice(0, 4).map((f) => (
            <Tag key={f.name} minimal className="!text-[9px] font-mono" title={f.type}>{f.name}</Tag>
          ))}
          {fields.length > 4 && <span className="text-[10px] text-muted-foreground/70">+{fields.length - 4}</span>}
        </>
      )}
    </div>
  )
}

// The guided "Create a workflow" recipe — its own surface (/create-workflow), not
// the everyday Studio screen. Reached from a card at the bottom of Studio and from
// Applications. Six ordered steps mirroring the layer stack; each opens the Studio
// surface that does that job. Chips + labels read from the STUDIO_TABS registry.

import { useNavigate } from 'react-router-dom'
import { Icon } from '@blueprintjs/core'
import { STUDIO_TABS, type AipTab } from './AIPShell'

const RECIPE: { n: number; title: string; blurb: string; go: AipTab[] }[] = [
  {
    n: 1,
    title: 'Shape the data',
    blurb: 'Every workflow starts from the ontology — the typed nodes and named edges it reads. Decide which objects it touches; add types or computed properties if they don\'t exist yet.',
    go: ['ontology'],
  },
  {
    n: 2,
    title: 'Add the compute',
    blurb: 'The typed Logic Tools it calls to read, forecast, and score — deterministic, or model-backed behind the same signature once a baseline is beaten.',
    go: ['tools', 'objectives', 'forecast-lab'],
  },
  {
    n: 3,
    title: 'Declare the actions',
    blurb: 'The typed writes it may propose. Every mutation is a named Action with submission criteria and an immutable audit entry — never a raw write.',
    go: ['ontology'],
  },
  {
    n: 4,
    title: 'Compose the agent',
    blurb: 'Small blocks and a numbered procedure: it reads via tools, proposes typed actions, and emits a viewable trace. Entity extraction is always its own block.',
    go: ['agents'],
  },
  {
    n: 5,
    title: 'Set the guardrails',
    blurb: 'Principles steer it softly, constraints hard-gate submission, and policy sets the confidence threshold above which it runs unattended.',
    go: ['principles', 'constraints', 'policy'],
  },
  {
    n: 6,
    title: 'Prove it, then release',
    blurb: 'Green evals and calibration earn autonomy. Promote sandbox → staging → production; monitors fire its proposals into Decisions, where the operators live.',
    go: ['calibration', 'flywheel', 'monitors'],
  },
]

export default function CreateWorkflowGuide() {
  const navigate = useNavigate()
  const byId = new Map(STUDIO_TABS.map((t) => [t.id, t]))
  const chip = (id: AipTab) => {
    const t = byId.get(id)
    if (!t) return null
    return (
      <button
        key={id}
        type="button"
        onClick={() => { void navigate(`/mind?aip=${id}`) }}
        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium hover:bg-muted/50 hover:border-foreground/20 transition-colors"
      >
        <Icon icon={t.icon} size={11} className="text-violet-500" />
        {t.label}
      </button>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-4">
        <header>
          <h1 className="text-xl font-semibold">Create a workflow</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            The path from an idea to an agent running under a gate. Six steps, each opening the Studio
            tool that does it — in the order the layers stack.
          </p>
        </header>

        <ol className="space-y-3">
          {RECIPE.map((step, i) => (
            <li key={step.n} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[12px] font-bold text-violet-600 tabular-nums">
                  {step.n}
                </span>
                {i < RECIPE.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="pb-1">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-xs text-muted-foreground max-w-2xl mt-0.5">{step.blurb}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{step.go.map(chip)}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

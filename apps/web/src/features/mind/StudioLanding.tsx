// Studio landing (M3): 18 tabs told no story — this page tells it. It leads with
// a guided "Create a workflow" recipe (the linear front door), then the same
// capabilities grouped by the build → govern → prove → sandbox loop underneath
// (browse view). Cards + chips are generated from the SAME tab registry the rail
// uses (labels, icons, descriptions can't drift).

import { Card, Icon } from '@blueprintjs/core'
import { STUDIO_TABS, type AipTab } from './AIPShell'

// The recipe: how a workflow gets built here, in order. Each step maps to the
// Studio surface(s) that do that job. Grounded in the layer stack — data →
// compute → mutation → agent → govern → prove/run.
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

const STAGES: { title: string; blurb: string; ids: AipTab[] }[] = [
  {
    title: 'Build',
    blurb: 'Define what the system can do: agents composed of typed blocks, the tool registry they call, and the trained adapters behind eval gates.',
    ids: ['agents', 'tools', 'objectives', 'forecast-lab'],
  },
  {
    title: 'Govern',
    blurb: 'The rules every run obeys. Principles steer agents softly; constraints hard-gate action submission; policy sets the auto-execution thresholds.',
    ids: ['policy', 'constraints', 'principles'],
  },
  {
    title: 'Prove',
    blurb: 'Evidence it works — and the gates that consume it. Calibration feeds the trust budget, the flywheel shows the system learning, monitors fire proposals into Decisions, the ontology grows under review.',
    ids: ['calibration', 'flywheel', 'monitors', 'ontology', 'system-map'],
  },
  {
    title: 'Sandbox',
    blurb: 'Try without committing. Scenarios overlay the graph; action chains batch writes behind one commit boundary; tune the copilot here.',
    ids: ['scenarios', 'action-chains', 'copilot'],
  },
  {
    title: 'Knowledge — what agents cite',
    blurb: 'Ingested documents with page provenance, their suggested entity links, and curated answers served before any fresh LLM call.',
    ids: ['documents', 'entity-links', 'answers'],
  },
]

export default function StudioLanding({ onNavigate }: { onNavigate: (t: AipTab) => void }) {
  const byId = new Map(STUDIO_TABS.map((t) => [t.id, t]))
  const chip = (id: AipTab) => {
    const t = byId.get(id)
    if (!t) return null
    return (
      <button
        key={id}
        type="button"
        onClick={() => { onNavigate(id) }}
        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium hover:bg-muted/50 hover:border-foreground/20 transition-colors"
      >
        <Icon icon={t.icon} size={11} className="text-violet-500" />
        {t.label}
      </button>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-8">
        <header>
          <h1 className="text-xl font-semibold">Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Where the intelligence fabric is built, governed, and proven. Everything here feeds the
            loop the operators live in: what you <b>build</b> obeys what you <b>govern</b>, earns
            autonomy through what you <b>prove</b>, and lands in Decisions.
          </p>
        </header>

        {/* Front door: the guided recipe, in order. */}
        <section className="space-y-1">
          <h2 className="text-sm font-semibold">Create a workflow</h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            The path from an idea to an agent running under a gate. Six steps, each opening the tool that does it.
          </p>
          <ol className="mt-3 space-y-3">
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
        </section>

        {/* Browse view: the same tools grouped by the operating loop. */}
        <section className="space-y-4 border-t pt-6">
          <div>
            <h2 className="text-sm font-semibold">Or jump straight to a tool</h2>
            <p className="text-xs text-muted-foreground max-w-2xl">Every Studio surface, grouped by the loop it serves.</p>
          </div>
          {STAGES.map((stage) => (
            <section key={stage.title} className="space-y-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stage.title}</h3>
                <p className="text-xs text-muted-foreground max-w-2xl">{stage.blurb}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {stage.ids.map((id) => {
                  const t = byId.get(id)
                  if (!t) return null
                  return (
                    <Card key={id} interactive compact onClick={() => { onNavigate(id) }}>
                      <div className="flex items-center gap-2">
                        <Icon icon={t.icon} size={13} className="text-violet-500" />
                        <span className="text-sm font-semibold">{t.label}</span>
                      </div>
                      {t.desc && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{t.desc}</p>}
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </section>
      </div>
    </div>
  )
}

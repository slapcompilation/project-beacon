// Studio landing (M3): 18 tabs told no story — this page tells it. The loop is
// build → govern → prove → sandbox, with knowledge feeding the agents. Cards
// are generated from the SAME tab registry the rail uses (labels, icons,
// descriptions can't drift), and the thin tabs the rail no longer shows
// (Objectives, Scenarios, Action Chains, Copilot) live here.

import { Card, Icon } from '@blueprintjs/core'
import { STUDIO_TABS, type AipTab } from './AIPShell'

const STAGES: { title: string; blurb: string; ids: AipTab[] }[] = [
  {
    title: '1 · Build',
    blurb: 'Define what the system can do: agents composed of typed blocks, the tool registry they call, and the trained adapters behind eval gates.',
    ids: ['agents', 'tools', 'objectives', 'forecast-lab'],
  },
  {
    title: '2 · Govern',
    blurb: 'The rules every run obeys. Principles steer agents softly; constraints hard-gate action submission; policy sets the auto-execution thresholds.',
    ids: ['policy', 'constraints', 'principles'],
  },
  {
    title: '3 · Prove',
    blurb: 'Evidence it works — and the gates that consume it. Calibration feeds the trust budget, the flywheel shows the system learning, monitors fire proposals into Decisions, the ontology grows under review.',
    ids: ['calibration', 'flywheel', 'monitors', 'ontology', 'system-map'],
  },
  {
    title: '4 · Sandbox',
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
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Where the intelligence fabric is built, governed, and proven. Everything here feeds the
            loop the operators live in: what you <b>build</b> obeys what you <b>govern</b>, earns
            autonomy through what you <b>prove</b>, and lands in Decisions.
          </p>
        </header>

        {STAGES.map((stage) => (
          <section key={stage.title} className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold">{stage.title}</h2>
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
      </div>
    </div>
  )
}

// Studio landing: one card per destination, generated from the SAME registry the
// rail uses so labels and icons can't drift. Five applications over one ontology
// (docs/STUDIO-RESTRUCTURE.md) — each card lists the panels inside it, so the
// structure is legible before you click.

import { Card, Icon } from '@blueprintjs/core'
import { useNavigate } from 'react-router-dom'
import { DESTINATIONS, STUDIO_TABS, type AipTab } from './AIPShell'

export default function StudioLanding({ onNavigate }: { onNavigate: (t: AipTab) => void }) {
  const navigate = useNavigate()
  const byId = new Map(STUDIO_TABS.map((t) => [t.id, t]))
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            One ontology, and the applications that use it. The <b>Ontology Manager</b> defines the
            types everything else speaks; the rest read those types and propose typed Actions, which
            land in Decisions.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DESTINATIONS.map((d) => (
            <Card key={d.id} interactive className="!p-4" onClick={() => { onNavigate(d.panels[0]) }}>
              <div className="flex items-center gap-2">
                <Icon icon={d.icon} size={14} className="text-violet-500" />
                <span className="text-sm font-semibold">{d.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{d.desc}</p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
                {d.panels.map((p) => {
                  const t = byId.get(p)
                  if (!t) return null
                  return (
                    <button
                      key={p} type="button" title={t.desc}
                      onClick={(e) => { e.stopPropagation(); onNavigate(p) }}
                      className="text-[11px] text-muted-foreground hover:text-violet-500 hover:underline"
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>

        {/* New here? The guided path, on its own surface. */}
        <Card
          interactive
          className="!p-4 border-t-2 border-t-violet-500/40"
          onClick={() => { void navigate('/create-workflow') }}
        >
          <div className="flex items-center gap-2">
            <Icon icon="path" size={14} className="text-violet-500" />
            <span className="text-sm font-semibold">Create a workflow</span>
            <Icon icon="arrow-right" size={13} className="text-muted-foreground ml-auto" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug max-w-2xl">
            New to building here? A guided six-step path from idea to a gated, running agent — data → compute → actions → agent → guardrails → release.
          </p>
        </Card>
      </div>
    </div>
  )
}

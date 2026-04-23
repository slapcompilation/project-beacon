// Layer: Eye — Consolidated intelligence workspace
// Two surfaces only:
//   Copilot — AI synthesis, tool-calling, reasoning trace
//   Signals — Unified ranked feed of objects with active signals
//             (waste, stockout, incident, expiry, supplier risk — all as one)
// All analytical feature pages remain as utility routes accessible from
// within object pages; they are no longer primary navigation destinations.

import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import EyeCopilotPage from './EyeCopilotPage'
import UnifiedSignalsPage from './UnifiedSignalsPage'

const PANELS = [
  { id: 'copilot', label: 'Eye · Copilot' },
  { id: 'signals', label: 'Eye · Signals' },
] as const

type PanelId = typeof PANELS[number]['id']

export default function EyeWorkspace() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('panel') ?? 'copilot'
  const panel: PanelId = PANELS.some((p) => p.id === raw) ? raw as PanelId : 'copilot'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b shrink-0 bg-background">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setParams({ panel: p.id }, { replace: true }) }}
            className={cn(
              'px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
              panel === p.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <PanelErrorBoundary name={`Eye · ${panel}`}>
        <div className="flex-1 overflow-hidden">
          {panel === 'copilot' && <EyeCopilotPage />}
          {panel === 'signals' && <UnifiedSignalsPage />}
        </div>
      </PanelErrorBoundary>
    </div>
  )
}

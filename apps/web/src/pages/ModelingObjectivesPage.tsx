// Modeling Objectives index — every registered objective, its candidate
// adapter count, eval-case count, and active-stage release summary per org.
// Mirrors AIP's Modeling Objectives index (folder 4 #1).

import { Link } from 'react-router-dom'
import { Card, Icon, Intent, NonIdealState, Tag } from '@blueprintjs/core'
import { objectiveDescriptors, type ObjectiveDescriptor } from '@/features/modelingObjectives/registry'

export default function ModelingObjectivesPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <h1 className="text-sm font-semibold">Modeling Objectives</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each objective owns N candidate adapters, one eval suite, and a release lifecycle (sandbox → staging → production). Logic Tools delegate here so callers never bind to a specific implementation.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {objectiveDescriptors.length === 0 ? (
          <NonIdealState icon="predictive-analysis" title="No objectives registered" />
        ) : (
          objectiveDescriptors.map((d) => <ObjectiveCard key={d.objective.name} descriptor={d} />)
        )}
      </div>
    </div>
  )
}

function ObjectiveCard({ descriptor }: { descriptor: ObjectiveDescriptor }) {
  const { objective, adapters, evalSuite } = descriptor
  return (
    <Link to={`/modeling-objectives/${objective.name}`} className="block">
      <Card interactive className="flex flex-col gap-3 h-full">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon icon="predictive-analysis" intent={Intent.PRIMARY} size={14} />
            <span className="text-sm font-semibold">{objective.name}</span>
          </div>
          <Tag minimal icon="flag" intent={Intent.NONE}>default → {objective.defaultAdapter}</Tag>
        </header>

        <p className="text-xs text-muted-foreground leading-relaxed">{objective.description}</p>

        <div className="grid grid-cols-4 gap-2 text-center pt-1">
          <Stat label="Adapters"     value={adapters.length} />
          <Stat label="Eval cases"   value={evalSuite.cases.length} />
          <Stat label="Datasets"     value={evalSuite.datasets.length} />
          <Stat label="Metrics"      value={evalSuite.metrics.length} />
        </div>

        <footer className="border-t border-border/40 pt-2 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
          <Icon icon="cube" size={10} />
          <span>Candidates:</span>
          {objective.candidates.map((c) => (
            <Tag key={c} minimal className="font-mono text-[10px]">{c}</Tag>
          ))}
        </footer>
      </Card>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  )
}

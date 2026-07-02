// Modeling Objectives index — every registered objective, its candidate
// adapter count, eval-case count, and default adapter. Mirrors AIP's Modeling
// Objectives index (folder 4 #1). Dense cards via the shared EntityCard idiom.

import { Intent, NonIdealState, Tag } from '@blueprintjs/core'
import { EntityCard, Bit, Dot } from '@/components/EntityCard'
import { objectiveDescriptors, type ObjectiveDescriptor } from '@/features/modelingObjectives/registry'

export default function ModelingObjectivesPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-3 border-b shrink-0">
        <h1 className="text-sm font-semibold">Modeling Objectives</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each objective owns N candidate adapters, one eval suite, and a release lifecycle (sandbox → staging → production). Logic Tools delegate here so callers never bind to a specific implementation.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {objectiveDescriptors.length === 0 ? (
          <NonIdealState icon="predictive-analysis" title="No objectives registered" />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 items-start">
            {objectiveDescriptors.map((d) => <ObjectiveCard key={d.objective.name} descriptor={d} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ObjectiveCard({ descriptor }: { descriptor: ObjectiveDescriptor }) {
  const { objective, adapters, evalSuite } = descriptor
  return (
    <EntityCard
      to={`/modeling-objectives/${objective.name}`}
      icon="predictive-analysis"
      iconIntent={Intent.PRIMARY}
      title={objective.name}
      stageTag={<Tag minimal icon="flag" className="!text-[10px]">default → {objective.defaultAdapter}</Tag>}
      purpose={objective.description}
      meta={
        <>
          <Bit n={adapters.length} unit="adapters" />
          <Dot />
          <Bit n={evalSuite.cases.length} unit="eval cases" />
          <Dot />
          <Bit n={evalSuite.datasets.length} unit="datasets" />
          <Dot />
          <Bit n={evalSuite.metrics.length} unit="metrics" />
        </>
      }
      footer={<>↳ candidates: {objective.candidates.join(', ')}</>}
    />
  )
}

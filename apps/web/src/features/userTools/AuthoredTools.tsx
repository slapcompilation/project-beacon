// Authored tools, each answered against live records — a tool you can't run is
// just a stored definition. Same value + basis + confidence a code tool returns.

import { Button, Card, Icon, Intent, NonIdealState, Tag } from '@blueprintjs/core'
import { evaluateUserTool, describeUserTool, type ObjectTypeDef } from '@beacon/reality-graph'
import { useObjectTypes, useObjectRecords } from '@/features/objectTypes/hooks'
import { rowToObjectType, type ObjectTypeRow } from '@/features/objectTypes/api'
import { useUserTools, useDeleteUserTool } from './hooks'
import type { UserToolRow } from './api'

export default function AuthoredTools({ onCompose }: { onCompose: () => void }) {
  const tools = useUserTools()
  const types = useObjectTypes()

  if (tools.isLoading) return null
  const rows = tools.data ?? []

  if (rows.length === 0) {
    return (
      <Card>
        <NonIdealState
          icon="function"
          title="No authored tools yet"
          description="An authored tool asks one bounded question over your ontology — how many, total, average — and answers with a basis and a confidence, like the shipped tools do."
          action={<Button intent={Intent.PRIMARY} icon="add" onClick={onCompose}>New tool</Button>}
        />
      </Card>
    )
  }

  const typeById = new Map((types.data ?? []).map((t) => [t.id, t]))
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 items-start">
      {rows.map((t) => <AuthoredToolCard key={t.id} tool={t} typeRow={typeById.get(t.subject_type_id)} />)}
    </div>
  )
}

function AuthoredToolCard({ tool, typeRow }: { tool: UserToolRow; typeRow: ObjectTypeRow | undefined }) {
  const del = useDeleteUserTool()
  const records = useObjectRecords(tool.subject_type_id)
  const type: ObjectTypeDef | undefined = typeRow ? rowToObjectType(typeRow) : undefined

  const result = records.data
    ? evaluateUserTool({ filters: tool.filters, aggregation: tool.aggregation }, records.data.map((r) => r.data), type)
    : null

  return (
    <Card className="space-y-2">
      <div className="flex items-start gap-2">
        <Icon icon="function" size={14} className="mt-0.5 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{tool.name}</div>
          <div className="font-mono text-[10px] text-muted-foreground truncate">{tool.api_name}</div>
        </div>
        <Button size="small" variant="minimal" icon="trash" loading={del.isPending}
          onClick={() => { del.mutate(tool.id) }} />
      </div>

      <p className="text-[11px] text-muted-foreground">
        {describeUserTool({ filters: tool.filters, aggregation: tool.aggregation }, type)}
      </p>

      {result ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg font-semibold tabular-nums">
            {Number.isInteger(result.value) ? result.value : result.value.toFixed(2)}
          </span>
          <Tag minimal intent={result.confidence >= 0.85 ? Intent.SUCCESS : result.confidence >= 0.6 ? Intent.WARNING : Intent.DANGER}
            className="!text-[10px]">
            {Math.round(result.confidence * 100)}%
          </Tag>
          <span className="text-[10px] text-muted-foreground">{result.basis}</span>
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground">running…</span>
      )}
    </Card>
  )
}

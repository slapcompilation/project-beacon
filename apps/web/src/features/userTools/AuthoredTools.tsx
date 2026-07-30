// Authored tools, each answered against live records — a tool you can't run is
// just a stored definition. Same value + basis + confidence a code tool returns.

import { useState } from 'react'
import { Button, Card, Icon, Intent, NonIdealState, Tag, Tooltip } from '@blueprintjs/core'
import { bindToolArgs, evaluateUserToolAcross, describeUserTool, type ToolArgs } from '@beacon/reality-graph'
import { useUserTools, useDeleteUserTool } from './hooks'
import { useSetSubject } from '@/features/objectSets/subject'
import Breakdown from './Breakdown'
import { ArgInput } from './ToolComposer'
import type { UserToolRow } from './api'

export default function AuthoredTools({ onCompose }: { onCompose: () => void }) {
  const tools = useUserTools()

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

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 items-start">
      {rows.map((t) => <AuthoredToolCard key={t.id} tool={t} />)}
    </div>
  )
}

function AuthoredToolCard({ tool }: { tool: UserToolRow }) {
  const del = useDeleteUserTool()
  const { subject, targets, groups } = useSetSubject({
    subjectTypeId: tool.subject_type_id, subjectInterfaceId: tool.subject_interface_id,
  })

  const params = tool.parameters
  const [args, setArgs] = useState<ToolArgs>({})

  const def = { parameters: params, filters: tool.filters, aggregation: tool.aggregation }
  const bound = bindToolArgs(def, args)
  const result = groups && bound.errors.length === 0
    ? evaluateUserToolAcross({ ...def, filters: bound.filters }, groups)
    : null
  const spansTypes = subject?.kind === 'interface'

  return (
    <Card className="space-y-2">
      <div className="flex items-start gap-2">
        <Icon icon={spansTypes ? 'layers' : 'function'} size={14}
          className={`mt-0.5 shrink-0 ${spansTypes ? 'text-violet-500' : 'text-primary'}`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{tool.name}</div>
          <div className="font-mono text-[10px] text-muted-foreground truncate">{tool.api_name}</div>
        </div>
        {spansTypes && (
          <Tooltip compact content={targets.length === 0
            ? `No type implements ${subject.iface.label} yet`
            : `Across ${targets.map((t) => t.label).join(', ')}`}>
            <Tag minimal className="!text-[10px]">{targets.length} types</Tag>
          </Tooltip>
        )}
        <Button size="small" variant="minimal" icon="trash" loading={del.isPending}
          onClick={() => { del.mutate(tool.id) }} />
      </div>

      <p className="text-[11px] text-muted-foreground">{describeUserTool(def, subject)}</p>

      {params.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {params.map((p) => (
            <ArgInput key={p.key} param={p} value={args[p.key]}
              onChange={(v) => { setArgs({ ...args, [p.key]: v }) }} />
          ))}
        </div>
      )}

      {bound.errors.length > 0 ? (
        <span className="text-[11px] text-muted-foreground">{bound.errors[0]}</span>
      ) : result ? (
        <div className="space-y-1">
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
          {result.byType.length > 1 && <Breakdown byType={result.byType} />}
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground">running…</span>
      )}
    </Card>
  )
}

// Authored agents, each shown as the sentence it compiles to.

import { Button, Card, Icon, Intent, NonIdealState, Tag } from '@blueprintjs/core'
import { describeAuthoredAgent } from '@beacon/reality-graph'
import { useUserAgents, useDeleteUserAgent } from './hooks'
import { rowToAgentDef } from './api'

export default function AuthoredAgents({ onCompose }: { onCompose: () => void }) {
  const agents = useUserAgents()
  const del = useDeleteUserAgent()

  if (agents.isLoading) return null
  const rows = agents.data ?? []

  if (rows.length === 0) {
    return (
      <Card>
        <NonIdealState
          icon="predictive-analysis"
          title="No authored agents yet"
          description="An authored agent is the same shape as a shipped one — purpose, scope, cadence, a bounded toolset and a numbered procedure — expressed as data. It runs on the same runtime and through the same gates."
          action={<Button intent={Intent.PRIMARY} icon="add" onClick={onCompose}>New agent</Button>}
        />
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 items-start">
      {rows.map((a) => {
        const def = rowToAgentDef(a)
        return (
          <Card key={a.id} className="space-y-1.5">
            <div className="flex items-start gap-2">
              <Icon icon="predictive-analysis" size={14} className="mt-0.5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{a.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground truncate">{a.api_name}</div>
              </div>
              <Tag minimal intent={a.approval === 'auto' ? Intent.WARNING : Intent.NONE} className="!text-[10px]">
                {a.approval === 'auto' ? 'auto' : 'review'}
              </Tag>
              <Button size="small" variant="minimal" icon="trash" loading={del.isPending}
                onClick={() => { del.mutate(a.id) }} />
            </div>
            <p className="text-[11px]">{a.purpose}</p>
            <p className="text-[10px] text-muted-foreground">{describeAuthoredAgent(def)}</p>
          </Card>
        )
      })}
    </div>
  )
}

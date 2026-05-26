// Copilot tool allowlist (Phase 10.b).
// Per-hotel toggle list. Disabled tools are hidden from the LLM at request
// time by the copilot-chat edge function.

import { useEffect, useMemo, useState } from 'react'
import {
  Button, Callout, Card, Icon, Intent, NonIdealState, Spinner,
  SpinnerSize, Switch, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { useCopilotConfig, useUpsertCopilotConfig } from '@/features/copilotConfig/hooks'
import {
  COPILOT_TOOL_CATALOG,
  type CopilotToolCategory,
  type CopilotToolEntry,
} from '@/features/copilotConfig/catalog'

const CATEGORY_ORDER: CopilotToolCategory[] = ['query', 'search', 'propose']
const CATEGORY_LABELS: Record<CopilotToolCategory, string> = {
  query:   'Query (read-only)',
  search:  'Search',
  propose: 'Propose (action proposals)',
}
const CATEGORY_INTENT: Record<CopilotToolCategory, Intent> = {
  query:   Intent.PRIMARY,
  search:  Intent.SUCCESS,
  propose: Intent.WARNING,
}

export default function CopilotConfigPage() {
  const { data: config, isLoading, isError, refetch, isFetching } = useCopilotConfig()
  const upsert = useUpsertCopilotConfig()
  const [pending, setPending] = useState<Set<string>>(new Set())

  // Sync local pending set with the persisted disabled list whenever a fresh
  // copy comes back. Operators can flip switches; "Save" persists the diff.
  useEffect(() => {
    setPending(new Set(config?.disabled_tools ?? []))
  }, [config?.disabled_tools])

  const grouped = useMemo(() => {
    const byCat = new Map<CopilotToolCategory, CopilotToolEntry[]>()
    for (const c of CATEGORY_ORDER) byCat.set(c, [])
    for (const t of COPILOT_TOOL_CATALOG) byCat.get(t.category)?.push(t)
    return byCat
  }, [])

  const persistedSet = useMemo(() => new Set(config?.disabled_tools ?? []), [config?.disabled_tools])
  const dirty = useMemo(() => {
    if (pending.size !== persistedSet.size) return true
    for (const v of pending) if (!persistedSet.has(v)) return true
    return false
  }, [pending, persistedSet])

  const toggle = (name: string) => {
    setPending((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }
  if (isError) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to load copilot config"
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }

  const enabledCount = COPILOT_TOOL_CATALOG.length - pending.size

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            Copilot Configuration
            <Tag minimal>{String(enabledCount)} / {String(COPILOT_TOOL_CATALOG.length)} tools enabled</Tag>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per-hotel allowlist for the copilot. Disabled tools are hidden from the LLM at request time — the model can't choose them, can't see them in its tool list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="minimal" size="small" icon="refresh" loading={isFetching} onClick={() => { void refetch() }}>Refresh</Button>
          <Button
            intent={Intent.PRIMARY}
            icon="floppy-disk"
            disabled={!dirty}
            loading={upsert.isPending}
            onClick={() => { upsert.mutate([...pending]) }}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {!config && (
          <Callout intent={Intent.NONE} icon="info-sign">
            No config row exists yet for this hotel. All tools are enabled by default. Toggle any switch + Save to create the row.
          </Callout>
        )}

        {CATEGORY_ORDER.map((cat) => {
          const tools = grouped.get(cat) ?? []
          if (tools.length === 0) return null
          return (
            <section key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag minimal intent={CATEGORY_INTENT[cat]}>{cat}</Tag>
                <h2 className="text-sm font-semibold">{CATEGORY_LABELS[cat]}</h2>
                <span className="text-[11px] text-muted-foreground">{String(tools.length)} tool{tools.length === 1 ? '' : 's'}</span>
              </div>
              <div className="space-y-1.5">
                {tools.map((tool) => (
                  <ToolRow
                    key={tool.name}
                    tool={tool}
                    disabled={pending.has(tool.name)}
                    onToggle={() => { toggle(tool.name) }}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {config?.updated_at && (
          <p className="text-[10px] text-muted-foreground italic">
            Last updated {formatDistanceToNow(new Date(config.updated_at), { addSuffix: true })}
            {config.updated_by_user_id && (
              <> by <span className="font-mono">{config.updated_by_user_id}</span></>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

function ToolRow({ tool, disabled, onToggle }: { tool: CopilotToolEntry; disabled: boolean; onToggle: () => void }) {
  return (
    <Card className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon icon="function" size={11} className="text-muted-foreground" />
          <span className="text-xs font-mono font-semibold">{tool.name}</span>
          <Tag minimal>{tool.label}</Tag>
          {disabled && <Tag minimal intent={Intent.DANGER}>disabled</Tag>}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{tool.description}</p>
      </div>
      <Switch
        checked={!disabled}
        onChange={onToggle}
        labelElement={<span className="text-xs">{disabled ? 'Off' : 'On'}</span>}
      />
    </Card>
  )
}

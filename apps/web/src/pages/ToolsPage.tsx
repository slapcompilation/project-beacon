// Tools index — every Logic Tool in the registry, grouped by AIP category.
// Shows category coverage (which of the 7 AIP categories we've populated).

import { useMemo } from 'react'
import { Card, Intent, Tag } from '@blueprintjs/core'
import { EntityCard } from '@/components/EntityCard'
import { toolDescriptors } from '@/features/agentStudio/registry'
import type { LogicTool, ToolCategory } from '@beacon/reality-graph'

const ALL_CATEGORIES: ToolCategory[] = [
  'data', 'logic', 'search', 'mutation', 'utility', 'predefined', 'ui-control',
]

export default function ToolsPage() {
  const grouped = useMemo(() => {
    const m = new Map<ToolCategory, LogicTool[]>()
    for (const c of ALL_CATEGORIES) m.set(c, [])
    for (const t of toolDescriptors) m.get(t.category)?.push(t)
    return m
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <h1 className="text-sm font-semibold">Logic Tools</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every registered Logic Tool, grouped by AIP category. Agents may only invoke tools listed in their declared toolset.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {ALL_CATEGORIES.map((category) => {
          const tools = grouped.get(category) ?? []
          return (
            <section key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag minimal intent={categoryIntent(category)} className="font-mono text-[10px]">{category}</Tag>
                <h2 className="text-sm font-semibold">{category}</h2>
                <span className="text-[11px] text-muted-foreground">{String(tools.length)} tool{tools.length === 1 ? '' : 's'}</span>
              </div>
              {tools.length === 0 ? (
                <Card className="text-xs italic text-muted-foreground">
                  No tools in <span className="font-mono">{category}</span> yet. {emptyHint(category)}
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 items-start">
                  {tools.map((tool) => (
                    <EntityCard
                      key={tool.name}
                      to={`/tools/${tool.name}`}
                      icon="function"
                      title={tool.name}
                      mono
                      titleTag={
                        <>
                          <Tag minimal className="font-mono !text-[10px]">@ {tool.version}</Tag>
                          <Tag minimal className="!text-[10px]">{tool.kind}</Tag>
                        </>
                      }
                      purpose={tool.description}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function categoryIntent(category: ToolCategory): Intent {
  switch (category) {
    case 'data':       return Intent.PRIMARY
    case 'logic':      return Intent.SUCCESS
    case 'search':     return Intent.WARNING
    case 'mutation':   return Intent.DANGER
    case 'predefined':
    case 'utility':
    case 'ui-control': return Intent.NONE
  }
}

function emptyHint(category: ToolCategory): string {
  switch (category) {
    case 'search':     return 'Lands with Documents + ApprovedAnswers (P2).'
    case 'mutation':   return 'Each mutation tool wraps an Action Registry call; useful once the copilot proposes actions.'
    case 'utility':    return 'Add small format/parse helpers as needed.'
    case 'ui-control': return 'Surface helpers exposed only to the operator copilot land here.'
    default:           return ''
  }
}

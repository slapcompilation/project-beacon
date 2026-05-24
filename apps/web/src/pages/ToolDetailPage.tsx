// Tool detail — typed I/O schema, description, traversable edges, few-shot
// examples, which agents declare this tool in their toolset.

import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Icon, Intent, NonIdealState, Tag } from '@blueprintjs/core'
import {
  agentDescriptors,
  describeSchema,
  getToolDescriptor,
  type SchemaField,
} from '@/features/agentStudio/registry'
import type { ToolCategory } from '@beacon/reality-graph'

export default function ToolDetailPage() {
  const { toolName = '' } = useParams<{ toolName: string }>()
  const navigate = useNavigate()
  const tool     = getToolDescriptor(toolName)

  if (!tool) {
    return (
      <NonIdealState
        icon="search-template"
        title="Tool not found"
        description={`No descriptor registered for "${toolName}".`}
        action={<Button onClick={() => { void navigate('/tools') }}>Back to Tools</Button>}
      />
    )
  }

  const inputs:  SchemaField[] = describeSchema(tool.inputSchema)
  const outputs: SchemaField[] = describeSchema(tool.outputSchema)
  const callers = agentDescriptors.filter((a) => a.toolset.includes(tool.name))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link to="/tools" className="text-xs text-muted-foreground hover:text-foreground">Tools</Link>
          <Icon icon="chevron-right" size={10} className="text-muted-foreground" />
          <Icon icon="function" size={14} className="text-muted-foreground" />
          <h1 className="text-sm font-semibold font-mono">{tool.name}</h1>
          <Tag minimal className="font-mono text-xs">@ {tool.version}</Tag>
          <Tag minimal intent={categoryIntent(tool.category)}>{tool.category}</Tag>
          <Tag minimal>{tool.kind}</Tag>
          {tool.scope && <Tag minimal icon="people">{tool.scope}</Tag>}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Section title="Schema" icon="code">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SchemaCard title="Input"  fields={inputs} />
            <SchemaCard title="Output" fields={outputs} />
          </div>
        </Section>

        {tool.traversableLinks && tool.traversableLinks.length > 0 && (
          <Section title="Traversable edges" icon="graph">
            <div className="flex items-center gap-2 flex-wrap">
              {tool.traversableLinks.map((edge) => (
                <Tag key={edge} minimal icon="flow-linear">{edge}</Tag>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Edge types this tool is allowed to follow. Ad-hoc traversal is rejected.
            </p>
          </Section>
        )}

        {tool.examples && tool.examples.length > 0 && (
          <Section title="Few-shot examples" icon="learning">
            <div className="space-y-2">
              {tool.examples.map((ex, i) => (
                <Card key={i} className="space-y-2">
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Input</h4>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap bg-surface-2 rounded p-2 border border-border/40">{JSON.stringify(ex.input, null, 2)}</pre>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Output</h4>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap bg-surface-2 rounded p-2 border border-border/40">{JSON.stringify(ex.output, null, 2)}</pre>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        <Section title="Used by" icon="predictive-analysis">
          {callers.length === 0 ? (
            <Card className="text-xs italic text-muted-foreground">No agent declares this tool in its toolset.</Card>
          ) : (
            <div className="space-y-1.5">
              {callers.map((a) => (
                <Link key={a.name} to={`/agent-studio/${a.name}`}>
                  <Card interactive className="flex items-center gap-2 hover:bg-surface-2">
                    <Icon icon="predictive-analysis" size={12} intent={Intent.PRIMARY} />
                    <span className="text-xs font-semibold">{a.name}</span>
                    <Tag minimal className="font-mono text-[10px]">@ {a.version}</Tag>
                    <span className="flex-1 text-[11px] text-muted-foreground truncate">{a.purpose}</span>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function SchemaCard({ title, fields }: { title: string; fields: SchemaField[] }) {
  return (
    <Card className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {fields.length === 0 ? (
        <span className="text-xs italic text-muted-foreground">(non-object schema)</span>
      ) : (
        <ul className="space-y-0.5">
          {fields.map((f) => (
            <li key={f.name} className="text-xs font-mono flex items-baseline gap-2">
              <span className="font-medium">{f.name}</span>
              <span className="text-muted-foreground">{f.type}{f.optional ? '?' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Section({ title, icon, children }: { title: string; icon: 'code' | 'graph' | 'learning' | 'predictive-analysis'; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
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

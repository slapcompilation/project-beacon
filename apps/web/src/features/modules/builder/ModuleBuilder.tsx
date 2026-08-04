// The builder. Foundry: mirror/workshop/overview.md.
//
// Foundry's regions, by their names (workshop/getting-started): a left panel
// listing variables and the layout tree, the CANVAS in the middle, a
// CONFIGURATION PANEL on the right that appears when something is selected, and
// a TOP BAR carrying the resource name and publishing.
//
// The canvas is ModuleRenderer — the same component operators use. A builder
// with its own preview renderer is a builder that drifts from production.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon, Intent, NonIdealState, Spinner, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { ModuleRenderer, useModule } from '../ModuleRenderer'
import type { ModuleDoc } from '../api'
import { ROOT } from '../runtime'
import { nextPosition, useCreateRow, useDeleteRow, usePublishModule } from './api'
import { LAYOUT_KINDS, WIDGET_SPECS } from './specs'
import { EventsPanel, LayoutPanel, VariablePanel, WidgetPanel } from './panels'

export type Selection =
  | { kind: 'variable'; id: string }
  | { kind: 'layout';   id: string }
  | { kind: 'widget';   id: string }
  | null

export function ModuleBuilder({ apiName }: { apiName: string }) {
  const { data: mod, isLoading } = useModule(apiName)
  const [selected, setSelected] = useState<Selection>(null)
  const [adding, setAdding] = useState<'widget' | 'layout' | null>(null)
  const navigate = useNavigate()
  const publish = usePublishModule(apiName)
  const create = useCreateRow(apiName)
  const remove = useDeleteRow(apiName)

  if (isLoading) return <div className="flex h-full items-center justify-center"><Spinner /></div>
  if (!mod) {
    return <NonIdealState icon="application" title="No such application"
             description={`Nothing named "${apiName}" is in your scope.`} />
  }

  const addWidget = async (widgetType: keyof typeof WIDGET_SPECS) => {
    const spec = WIDGET_SPECS[widgetType]
    // A display widget must carry a variable — the CHECK refuses it otherwise,
    // so bind the first compatible one rather than failing the insert.
    const candidate = mod.variables.find((v) =>
      spec.binds ? spec.binds.includes(v.varType) : v.varType !== 'object_set_filter')
    if (spec.needsVariable && !candidate) {
      setAdding(null)
      return
    }
    const id = await create.mutateAsync({
      table: 'module_widgets',
      row: {
        module_id: mod.id, api_name: `w_${Date.now().toString(36)}`,
        widget_type: widgetType, title: '',
        layout_id: selectedLayoutId(mod, selected),
        variable_id: spec.needsVariable ? candidate?.id : null,
        config: widgetType === 'markdown' ? { body: 'New text' } : {},
        position: nextPosition(mod.widgets),
      },
    })
    setAdding(null)
    setSelected({ kind: 'widget', id })
  }

  const addLayout = async (layoutType: string) => {
    const id = await create.mutateAsync({
      table: 'module_layouts',
      row: {
        module_id: mod.id, api_name: `l_${Date.now().toString(36)}`,
        title: LAYOUT_KINDS.find((k) => k.value === layoutType)?.label ?? 'Section',
        layout_type: layoutType,
        parent_id: selectedLayoutId(mod, selected),
        position: nextPosition(mod.layouts),
      },
    })
    setAdding(null)
    setSelected({ kind: 'layout', id })
  }

  const addVariable = async () => {
    const id = await create.mutateAsync({
      table: 'module_variables',
      row: {
        module_id: mod.id, api_name: `v${Date.now().toString(36)}`,
        label: 'New variable', var_type: 'string',
        definition_kind: 'static', definition: { value: '' },
      },
    })
    setSelected({ kind: 'variable', id })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar — resource name and publishing controls. */}
      <header className="flex items-center gap-3 border-b px-4 py-2 shrink-0">
        <Button size="small" variant="minimal" icon="arrow-left"
          onClick={() => { void navigate(`/modules/${apiName}`) }} text="Done" />
        <div className="flex items-center gap-2">
          <Icon icon={(mod.icon || 'application') as IconName} size={14} />
          <span className="text-sm font-semibold">{mod.title}</span>
          <Tag minimal intent={mod.status === 'published' ? Intent.SUCCESS : Intent.NONE}>
            {mod.status}
          </Tag>
          <Tag minimal>v{mod.version}</Tag>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            Publishing moves the version promotions and installations point at.
          </span>
          <Button size="small" intent={Intent.PRIMARY} icon="cloud-upload" text={`Publish v${mod.version + 1}`}
            loading={publish.isPending} onClick={() => { publish.mutate(mod) }} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — variables, then the layout tree. */}
        <aside aria-label="Structure" className="w-72 shrink-0 border-r overflow-y-auto p-3 space-y-4">
          <Group title="Variables" onAdd={() => { void addVariable() }}>
            {mod.variables.length === 0 && <Empty>Nothing yet. A variable is where an application keeps what it knows.</Empty>}
            {[...mod.variables].sort((a, b) => a.apiName.localeCompare(b.apiName)).map((v) => (
              <Row key={v.id} icon="variable" label={v.apiName} sub={v.varType}
                active={selected?.kind === 'variable' && selected.id === v.id}
                onClick={() => { setSelected({ kind: 'variable', id: v.id }) }}
                onRemove={() => { remove.mutate({ table: 'module_variables', id: v.id }) }} />
            ))}
          </Group>

          <Group title="Layout" onAdd={() => { setAdding('layout') }}>
            <Tree mod={mod} parentKey={ROOT} depth={0} selected={selected}
              onSelect={setSelected} onRemove={remove.mutate} />
            {mod.layouts.length === 0 && mod.widgets.length === 0 && (
              <Empty>Add a widget to start. Sections and rows are optional until you need to arrange things.</Empty>
            )}
          </Group>

          <Button fill size="small" icon="add" text="Add widget"
            onClick={() => { setAdding('widget') }} />
        </aside>

        {/* Canvas — the real renderer, not a preview of one. */}
        <main className="flex-1 overflow-y-auto bg-muted/20">
          {adding === 'widget' ? (
            <Picker title="Add a widget" onClose={() => { setAdding(null) }}
              items={Object.entries(WIDGET_SPECS).map(([value, s]) => ({
                value, label: s.label, icon: s.icon, blurb: s.blurb,
                disabled: s.needsVariable && !mod.variables.some((v) =>
                  s.binds ? s.binds.includes(v.varType) : true),
                disabledReason: 'Needs a variable of a compatible type first.',
              }))}
              onPick={(v) => { void addWidget(v as keyof typeof WIDGET_SPECS) }} />
          ) : adding === 'layout' ? (
            <Picker title="Add a layout" onClose={() => { setAdding(null) }}
              items={LAYOUT_KINDS.map((k) => ({
                value: k.value, label: k.label, icon: 'layout', blurb: k.blurb,
              }))}
              onPick={(v) => { void addLayout(v) }} />
          ) : (
            <div className="pointer-events-none">
              <ModuleRenderer apiName={apiName} />
            </div>
          )}
        </main>

        {/* Configuration panel — appears when something is selected. */}
        <aside aria-label="Configuration" className="w-80 shrink-0 border-l overflow-y-auto">
          {selected === null ? (
            <div className="p-4 text-xs text-muted-foreground leading-relaxed">
              Select a variable, a layout or a widget on the left to configure it.
              The canvas is live — it renders exactly what an operator will see.
            </div>
          ) : (
            <ConfigPanel mod={mod} selected={selected} apiName={apiName} />
          )}
        </aside>
      </div>
    </div>
  )
}

function ConfigPanel({ mod, selected, apiName }: {
  mod: ModuleDoc; selected: NonNullable<Selection>; apiName: string
}) {
  if (selected.kind === 'variable') {
    const v = mod.variables.find((x) => x.id === selected.id)
    return v ? <VariablePanel mod={mod} variable={v} apiName={apiName} /> : null
  }
  if (selected.kind === 'layout') {
    const l = mod.layouts.find((x) => x.id === selected.id)
    return l ? <LayoutPanel mod={mod} layout={l} apiName={apiName} /> : null
  }
  const w = mod.widgets.find((x) => x.id === selected.id)
  if (!w) return null
  return (
    <div>
      <WidgetPanel mod={mod} widget={w} apiName={apiName} />
      <EventsPanel mod={mod} sourceWidgetId={w.id} apiName={apiName} />
    </div>
  )
}

/** Where a new thing goes: inside the selected layout, or at the root. */
function selectedLayoutId(mod: ModuleDoc, selected: Selection): string | null {
  if (selected?.kind === 'layout') return selected.id
  if (selected?.kind === 'widget') return mod.widgets.find((w) => w.id === selected.id)?.layoutId ?? null
  return null
}

function Tree({ mod, parentKey, depth, selected, onSelect, onRemove }: {
  mod: ModuleDoc; parentKey: string; depth: number; selected: Selection
  onSelect: (s: Selection) => void
  onRemove: (a: { table: 'module_layouts' | 'module_widgets'; id: string }) => void
}) {
  const layouts = mod.layouts.filter((l) => (l.parentId ?? ROOT) === parentKey)
    .sort((a, b) => a.position - b.position)
  const widgets = mod.widgets.filter((w) => (w.layoutId ?? ROOT) === parentKey)
    .sort((a, b) => a.position - b.position)

  return (
    <>
      {widgets.map((w) => (
        <Row key={w.id} icon={WIDGET_SPECS[w.widgetType].icon} depth={depth}
          label={w.title || WIDGET_SPECS[w.widgetType].label}
          sub={WIDGET_SPECS[w.widgetType].label}
          active={selected?.kind === 'widget' && selected.id === w.id}
          onClick={() => { onSelect({ kind: 'widget', id: w.id }) }}
          onRemove={() => { onRemove({ table: 'module_widgets', id: w.id }) }} />
      ))}
      {layouts.map((l) => (
        <div key={l.id}>
          <Row icon="layout" depth={depth} label={l.title || l.apiName} sub={l.layoutType}
            active={selected?.kind === 'layout' && selected.id === l.id}
            onClick={() => { onSelect({ kind: 'layout', id: l.id }) }}
            onRemove={() => { onRemove({ table: 'module_layouts', id: l.id }) }} />
          <Tree mod={mod} parentKey={l.id} depth={depth + 1} selected={selected}
            onSelect={onSelect} onRemove={onRemove} />
        </div>
      ))}
    </>
  )
}

function Group({ title, onAdd, children }: {
  title: string; onAdd: () => void; children: React.ReactNode
}) {
  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
        <Button size="small" variant="minimal" icon="add" onClick={onAdd} aria-label={`Add ${title}`} />
      </div>
      {children}
    </section>
  )
}

function Row({ icon, label, sub, active, depth = 0, onClick, onRemove }: {
  icon: string; label: string; sub?: string; active: boolean; depth?: number
  onClick: () => void; onRemove: () => void
}) {
  return (
    <div className={cn('group flex items-center gap-1.5 rounded px-1.5 py-1 text-xs cursor-pointer',
      active ? 'bg-primary/10 font-medium' : 'hover:bg-muted/60')}
      style={{ paddingLeft: 6 + depth * 12 }} onClick={onClick}>
      <Icon icon={icon as IconName} size={12} className="text-muted-foreground shrink-0" />
      <span className="truncate flex-1">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground shrink-0">{sub}</span>}
      <Button size="small" variant="minimal" icon="cross" aria-label={`Remove ${label}`}
        className="opacity-0 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onRemove() }} />
    </div>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] text-muted-foreground leading-snug py-1">{children}</p>
)

function Picker({ title, items, onPick, onClose }: {
  title: string
  items: Array<{ value: string; label: string; icon: string; blurb: string; disabled?: boolean; disabledReason?: string }>
  onPick: (value: string) => void
  onClose: () => void
}) {
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button size="small" variant="minimal" text="Cancel" onClick={onClose} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((i) => (
          <button key={i.value} type="button" disabled={i.disabled}
            onClick={() => { onPick(i.value) }}
            className={cn('rounded-md border p-3 text-left transition-all',
              i.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-muted-foreground/40 hover:bg-muted/40')}>
            <div className="flex items-center gap-2">
              <Icon icon={i.icon as IconName} size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">{i.label}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {i.disabled ? i.disabledReason : i.blurb}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

// The configuration panel's contents — one per selectable thing.
//
// Every field writes straight to the row it describes. There is no draft state
// and no Save button: the canvas is the same renderer operators use, so an edit
// that is not yet written is an edit you cannot see the effect of.

import { useEffect, useState } from 'react'
import {
  Button, Callout, FormGroup, HTMLSelect, InputGroup, Intent, Switch, TextArea, Tag,
} from '@blueprintjs/core'
import { useQuery } from '@tanstack/react-query'
import { actionDescriptors, buildAuthoredAgentTools, type LogicTool } from '@beacon/reality-graph'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'
import { supabase } from '@/lib/supabase/client'
import {
  fetchModules,
  type ModuleDoc, type ModuleLayout, type ModuleVariable, type ModuleWidget,
} from '../api'
import { useModule } from '../ModuleRenderer'
import type { Binding, ButtonSpec } from '../bindings'
import {
  AGGREGATION_METRICS, METRIC_ACCEPTS,
  type AggregationMetric, type TabSpec,
} from '../runtime'
import { nextPosition, useCreateRow, useDeleteRow, useUpdateRow } from './api'
import { EFFECT_KINDS, TRIGGERS, VARIABLE_KINDS, WIDGET_SPECS } from './specs'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-b p-3 space-y-2">
    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
    {children}
  </section>
)

/** A jsonb value in a form field. Empty rather than an em dash — this is an
 *  input, not a display. */
function text(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

/** A tool's argument names, read off its zod schema. Without these the author
 *  has to know the tool's inputs by heart and type them correctly. */
function toolArgNames(tool: LogicTool): string[] {
  const schema: unknown = tool.inputSchema
  if (schema && typeof schema === 'object' && 'shape' in schema) {
    const shape: unknown = (schema as { shape: unknown }).shape
    if (shape && typeof shape === 'object') return Object.keys(shape)
  }
  return []
}

function useTools() {
  return useQuery({
    queryKey: ['builder-tools'],
    queryFn: () => Promise.resolve([...buildAuthoredAgentTools(makeSupabaseGraphReader()).values()]),
    staleTime: Infinity,
  })
}

/** Published modules, minus this one — a module cannot contain itself, and
 *  offering it in the picker only teaches the author to hit the guard. */
function useEmbeddable(selfApiName: string) {
  return useQuery({
    queryKey: ['builder-embeddable'],
    queryFn: fetchModules,
    select: (all) => all.filter((m) => m.status === 'published' && m.apiName !== selfApiName),
  })
}

function useObjectSets() {
  return useQuery({
    queryKey: ['builder-object-sets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('object_sets')
        .select('id, name, api_name').order('name')
      if (error) throw new Error(error.message)
      return data as Array<{ id: string; name: string; api_name: string }>
    },
  })
}

// ── Variable ─────────────────────────────────────────────────────────────────

export function VariablePanel({ mod, variable, apiName }: {
  mod: ModuleDoc; variable: ModuleVariable; apiName: string
}) {
  const update = useUpdateRow(apiName)
  const { data: sets = [] } = useObjectSets()
  const { data: tools = [] } = useTools()
  const patch = (p: Record<string, unknown>) => {
    update.mutate({ table: 'module_variables', id: variable.id, patch: p })
  }
  const def = variable.definition
  const tool = tools.find((t) => t.name === def.toolName)
  const args = (def.args ?? {}) as Record<string, Binding>

  return (
    <div>
      <Section title="Variable">
        <FormGroup label="Name" labelFor="var-name"
          helperText="Used in {{interpolation}} and in bindings.">
          <InputGroup id="var-name" defaultValue={variable.apiName}
            onBlur={(e) => { patch({ api_name: e.target.value }) }} />
        </FormGroup>
        <FormGroup label="Label" helperText="What an operator sees.">
          <InputGroup defaultValue={variable.label}
            onBlur={(e) => { patch({ label: e.target.value }) }} />
        </FormGroup>
        <FormGroup label="Type">
          <HTMLSelect fill value={variable.varType}
            onChange={(e) => { patch({ var_type: e.currentTarget.value }) }}
            options={['object_set', 'string', 'numeric', 'boolean', 'date', 'object_set_filter']} />
        </FormGroup>
        {/* Without this nothing can be a component: a parent can only fill the
            variables a module says it accepts, and everything else stays private. */}
        <Switch checked={variable.isInterface} label="A parent application can fill this"
          onChange={(e) => { patch({ is_interface: e.currentTarget.checked }) }} />
        {variable.isInterface && (
          <p className="text-[11px] text-muted-foreground leading-snug">
            A loop puts each object here, and an embedding module maps one of its
            own variables onto it. What is set outside wins over the value below.
          </p>
        )}
      </Section>

      <Section title="Where its value comes from">
        <HTMLSelect fill value={variable.definitionKind}
          onChange={(e) => { patch({ definition_kind: e.currentTarget.value, definition: {} }) }}>
          {VARIABLE_KINDS.map((k) => (
            <option key={k.value} value={k.value} disabled={!k.enabled}>
              {k.label}{k.enabled ? '' : ' — not built yet'}
            </option>
          ))}
        </HTMLSelect>
        <p className="text-[11px] text-muted-foreground leading-snug">
          {VARIABLE_KINDS.find((k) => k.value === variable.definitionKind)?.blurb}
        </p>

        {variable.definitionKind === 'static' && (
          <FormGroup label="Value" labelFor="var-value">
            <InputGroup id="var-value" defaultValue={text(def.value)}
              onBlur={(e) => { patch({ definition: { value: e.target.value } }) }} />
          </FormGroup>
        )}

        {variable.definitionKind === 'object_set_definition' && (
          <FormGroup label="Object set" helperText={sets.length === 0
            ? 'No saved sets yet — create one in Objects first.' : undefined}>
            <HTMLSelect fill value={text(def.objectSetId)}
              onChange={(e) => { patch({ definition: { objectSetId: e.currentTarget.value } }) }}
              options={[{ label: '— pick a set —', value: '' },
                ...sets.map((s) => ({ label: s.name, value: s.id }))]} />
          </FormGroup>
        )}

        {variable.definitionKind === 'object_set_aggregation' && (
          <AggregationConfig mod={mod} variable={variable}
            onChange={(d) => { patch({ definition: d }) }} />
        )}

        {variable.definitionKind === 'function' && (
          <>
            <FormGroup label="Logic Tool">
              <HTMLSelect fill value={text(def.toolName)}
                onChange={(e) => { patch({ definition: { toolName: e.currentTarget.value, args: {}, output: '' } }) }}
                options={[{ label: '— pick a tool —', value: '' },
                  ...tools.map((t) => ({ label: t.name, value: t.name }))]} />
            </FormGroup>
            {tool && (
              <>
                <p className="text-[11px] text-muted-foreground leading-snug">{tool.description}</p>
                <FormGroup label="Read this field from the result"
                  helperText="Leave blank to keep the whole object.">
                  <InputGroup defaultValue={text(def.output)}
                    onBlur={(e) => { patch({ definition: { ...def, output: e.target.value } }) }} />
                </FormGroup>
                {toolArgNames(tool).map((arg) => (
                  <BindingRow key={arg} label={arg} mod={mod} binding={args[arg] ?? {}}
                    onChange={(b) => { patch({ definition: { ...def, args: { ...args, [arg]: b } } }) }} />
                ))}
              </>
            )}
          </>
        )}
      </Section>
    </div>
  )
}

/** An aggregation reads another object-set VARIABLE — the whole reason it exists
 *  is that one set can back a count, a sum and an average without three
 *  near-identical sets of the same object type. */
function AggregationConfig({ mod, variable, onChange }: {
  mod: ModuleDoc; variable: ModuleVariable
  onChange: (definition: Record<string, unknown>) => void
}) {
  const def = variable.definition
  const sets = mod.variables.filter((v) => v.varType === 'object_set')
  // `definition` is jsonb, so the stored metric is a string until proven
  // otherwise. Checking it beats casting and hoping.
  const stored = typeof def.metric === 'string' ? def.metric : ''
  const metric: AggregationMetric =
    (AGGREGATION_METRICS as readonly string[]).includes(stored)
      ? (stored as AggregationMetric) : 'count'
  const needs = METRIC_ACCEPTS[metric]

  return (
    <>
      <FormGroup label="Over which set" helperText={sets.length === 0
        ? 'This application has no object-set variable yet.' : undefined}>
        <HTMLSelect fill value={text(def.objectSet)}
          onChange={(e) => { onChange({ ...def, objectSet: e.currentTarget.value }) }}
          options={[{ label: '— pick a set —', value: '' },
            ...sets.map((v) => ({ label: v.apiName, value: v.apiName }))]} />
      </FormGroup>

      <FormGroup label="Measure">
        <HTMLSelect fill value={metric}
          onChange={(e) => { onChange({ ...def, metric: e.currentTarget.value }) }}
          options={AGGREGATION_METRICS.map((m) => ({ label: m, value: m }))} />
      </FormGroup>

      {needs !== 'none' && (
        <FormGroup label="Of which property"
          helperText={needs === 'numeric'
            ? 'A number. Summing dates is not a thing.'
            : needs === 'ordered' ? 'A number, date or timestamp.' : 'Any property.'}>
          <InputGroup defaultValue={text(def.property)}
            onBlur={(e) => { onChange({ ...def, property: e.target.value }) }} />
        </FormGroup>
      )}

      <p className="text-[11px] text-muted-foreground leading-snug">
        {metric === 'count' ? 'Counts objects, not values.'
          : metric === 'cardinality' ? 'How many distinct values that property takes.'
          : `The ${metric} of that property across the set.`}
      </p>
    </>
  )
}

/** One value, bound the way W3 binds them: a variable, a literal, or the form. */
function BindingRow({ label, mod, binding, onChange, allowUserInput = false }: {
  label: string; mod: ModuleDoc; binding: Binding
  onChange: (b: Binding) => void; allowUserInput?: boolean
}) {
  const source = binding.source ?? (binding.variableApiName ? 'variable' : 'static')
  return (
    <FormGroup label={label}>
      <div className="flex gap-1">
        <HTMLSelect value={source} className="shrink-0"
          onChange={(e) => { onChange({ ...binding, source: e.currentTarget.value as Binding['source'] }) }}
          options={[
            { label: 'variable', value: 'variable' },
            { label: 'fixed', value: 'static' },
            ...(allowUserInput ? [{ label: 'ask the operator', value: 'user_input' }] : []),
          ]} />
        {source === 'variable' ? (
          <HTMLSelect fill value={binding.variableApiName ?? ''}
            onChange={(e) => { onChange({ ...binding, variableApiName: e.currentTarget.value }) }}
            options={[{ label: '— pick —', value: '' },
              ...mod.variables.map((v) => ({ label: v.apiName, value: v.apiName }))]} />
        ) : source === 'static' ? (
          <InputGroup fill defaultValue={text(binding.value)}
            onBlur={(e) => { onChange({ ...binding, value: e.target.value }) }} />
        ) : null}
      </div>
    </FormGroup>
  )
}

// ── Layout ───────────────────────────────────────────────────────────────────

export function LayoutPanel({ mod, layout, apiName }: {
  mod: ModuleDoc; layout: ModuleLayout; apiName: string
}) {
  const update = useUpdateRow(apiName)
  const patch = (p: Record<string, unknown>) => {
    update.mutate({ table: 'module_layouts', id: layout.id, patch: p })
  }
  const siblings = mod.layouts.filter((l) => l.parentId === layout.parentId && l.id !== layout.id)

  return (
    <Section title={`${layout.layoutType} layout`}>
      <FormGroup label="Title">
        <InputGroup defaultValue={layout.title}
          onBlur={(e) => { patch({ title: e.target.value }) }} />
      </FormGroup>
      <FormGroup label="Position" helperText={`Among ${siblings.length + 1} at this level.`}>
        <InputGroup type="number" defaultValue={String(layout.position)}
          onBlur={(e) => { patch({ position: Number(e.target.value) }) }} />
      </FormGroup>
      {layout.layoutType === 'loop' && (
        <LoopConfig mod={mod} layout={layout} apiName={apiName}
          onChange={(c) => { patch({ config: c }) }} />
      )}
      {layout.layoutType === 'tab' && (
        <Callout intent={Intent.NONE} icon="info-sign" className="text-[11px]">
          Its container draws the tab bar. Variables used only inside a tab that is
          not showing are not computed until it opens.
        </Callout>
      )}
      {layout.layoutType === 'overlay' && (
        <Callout intent={Intent.NONE} icon="info-sign" className="text-[11px]">
          Hidden until an <strong>Open an overlay</strong> effect opens it.
        </Callout>
      )}
    </Section>
  )
}

/** Everything a loop needs: a set to walk, an application to show per entry, and
 *  the name of the variable in that application the entry lands in. Pickers
 *  rather than free text — the runtime resolves all three by name, so a typo is
 *  a loop that silently shows nothing. */
function LoopConfig({ mod, layout, apiName, onChange }: {
  mod: ModuleDoc; layout: ModuleLayout; apiName: string
  onChange: (config: Record<string, unknown>) => void
}) {
  // Each field writes the WHOLE config object, so spreading the server copy
  // would let two quick edits race: the second read the row before the first
  // landed and dropped it. The draft is what the author has actually chosen.
  const [cfg, setCfg] = useState<Record<string, unknown>>(layout.config)
  // Reseed only when a DIFFERENT loop is selected. Depending on the config too
  // would overwrite the draft on every refetch — which is the race this exists
  // to prevent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCfg(layout.config) }, [layout.id])

  const { data: modules = [] } = useEmbeddable(apiName)
  const childName = typeof cfg.module === 'string' ? cfg.module : ''
  const { data: child } = useModule(childName)
  const set = (patch: Record<string, unknown>) => {
    const next = { ...cfg, ...patch }
    setCfg(next)
    onChange(next)
  }

  const sets = mod.variables.filter((v) => v.varType === 'object_set')
  const inbound = (child?.variables ?? []).filter((v) => v.isInterface)
  const paging = (cfg.paging ?? {}) as { style?: string; size?: number }
  const display = (cfg.display ?? {}) as { mode?: string; columns?: number }

  return (
    <div className="space-y-2 pt-1">
      <FormGroup label="Walk this set" labelFor="loop-set" helperText={sets.length === 0
        ? 'This application has no object-set variable yet.' : undefined}>
        <HTMLSelect id="loop-set" fill value={text(cfg.variable)}
          onChange={(e) => { set({ variable: e.currentTarget.value }) }}
          options={[{ label: '— pick a set —', value: '' },
            ...sets.map((v) => ({ label: v.apiName, value: v.apiName }))]} />
      </FormGroup>

      <FormGroup label="Show this application for each" labelFor="loop-module"
        helperText={modules.length === 0
          ? 'Nothing published to embed yet — publish the component first.' : undefined}>
        <HTMLSelect id="loop-module" fill value={childName}
          onChange={(e) => { set({ module: e.currentTarget.value, itemInto: '' }) }}
          options={[{ label: '— pick an application —', value: '' },
            ...modules.map((m) => ({ label: m.title, value: m.apiName }))]} />
      </FormGroup>

      {childName !== '' && (
        <FormGroup label="The object arrives in" labelFor="loop-into"
          helperText={inbound.length === 0
            ? 'That application has no variable marked as an input. Open it and turn one on.'
            : 'Only variables it accepts from outside.'}>
          <HTMLSelect id="loop-into" fill value={text(cfg.itemInto)}
            onChange={(e) => { set({ itemInto: e.currentTarget.value }) }}
            options={[{ label: '— pick a variable —', value: '' },
              ...inbound.map((v) => ({ label: v.apiName, value: v.apiName }))]} />
        </FormGroup>
      )}

      <FormGroup label="How many at a time">
        <div className="flex gap-1">
          <HTMLSelect value={paging.style ?? 'limit'}
            onChange={(e) => { set({ paging: { ...paging, style: e.currentTarget.value } }) }}
            options={[{ label: 'first', value: 'limit' }, { label: 'pages of', value: 'paged' }]} />
          <InputGroup type="number" value={String(paging.size ?? 25)}
            onChange={(e) => { set({ paging: { ...paging, size: Number(e.target.value) || 25 } }) }} />
        </div>
      </FormGroup>

      <FormGroup label="Arranged as">
        <div className="flex gap-1">
          <HTMLSelect value={display.mode ?? 'list'}
            onChange={(e) => { set({ display: { ...display, mode: e.currentTarget.value } }) }}
            options={[{ label: 'a list', value: 'list' }, { label: 'a grid', value: 'grid' }]} />
          {display.mode === 'grid' && (
            <HTMLSelect value={String(display.columns ?? 2)}
              onChange={(e) => { set({ display: { ...display, columns: Number(e.currentTarget.value) } }) }}
              options={['2', '3', '4']} />
          )}
        </div>
      </FormGroup>
    </div>
  )
}

/** An embedded application, and which of this module's variables fill its
 *  inputs. Foundry shares them both ways, so this mapping is the whole contract
 *  between parent and child. */
function EmbeddedConfig({ mod, widget, apiName, onChange }: {
  mod: ModuleDoc; widget: ModuleWidget; apiName: string
  onChange: (config: Record<string, unknown>) => void
}) {
  // Same race as the loop: one mapping row per interface variable, each writing
  // the whole config.
  const [cfg, setCfg] = useState<Record<string, unknown>>(widget.config)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see LoopConfig
  useEffect(() => { setCfg(widget.config) }, [widget.id])
  const set = (next: Record<string, unknown>) => { setCfg(next); onChange(next) }

  const { data: modules = [] } = useEmbeddable(apiName)
  const childName = typeof cfg.module === 'string' ? cfg.module : ''
  const { data: child } = useModule(childName)
  const mapping = (cfg.mapping ?? {}) as Record<string, string>
  const inbound = (child?.variables ?? []).filter((v) => v.isInterface)

  return (
    <Section title="Which application">
      <HTMLSelect fill value={childName}
        onChange={(e) => { set({ module: e.currentTarget.value, mapping: {} }) }}
        options={[{ label: '— pick an application —', value: '' },
          ...modules.map((m) => ({ label: m.title, value: m.apiName }))]} />

      {childName !== '' && inbound.length === 0 && (
        <Callout intent={Intent.NONE} icon="info-sign" className="text-[11px]">
          It takes no inputs, so it will show the same thing wherever it appears.
        </Callout>
      )}

      {inbound.map((v) => (
        <FormGroup key={v.id} label={v.label || v.apiName}
          helperText="Shared both ways — a change on either side shows on both.">
          <HTMLSelect fill value={mapping[v.apiName] ?? ''}
            onChange={(e) => {
              set({ ...cfg, mapping: { ...mapping, [v.apiName]: e.currentTarget.value } })
            }}
            options={[{ label: '— leave it alone —', value: '' },
              ...mod.variables.map((p) => ({ label: p.apiName, value: p.apiName }))]} />
        </FormGroup>
      ))}
    </Section>
  )
}

// ── Widget ───────────────────────────────────────────────────────────────────

export function WidgetPanel({ mod, widget, apiName }: {
  mod: ModuleDoc; widget: ModuleWidget; apiName: string
}) {
  const update = useUpdateRow(apiName)
  const spec = WIDGET_SPECS[widget.widgetType]
  const patch = (p: Record<string, unknown>) => {
    update.mutate({ table: 'module_widgets', id: widget.id, patch: p })
  }
  const setConfig = (key: string, value: unknown) => {
    patch({ config: { ...widget.config, [key]: value } })
  }
  const bindable = mod.variables.filter((v) => !spec.binds || spec.binds.includes(v.varType))

  return (
    <div>
      <Section title={spec.label}>
        <p className="text-[11px] text-muted-foreground leading-snug">{spec.blurb}</p>
        <FormGroup label="Title">
          <InputGroup defaultValue={widget.title}
            onBlur={(e) => { patch({ title: e.target.value }) }} />
        </FormGroup>

        {spec.needsVariable && (
          <FormGroup label="Shows" helperText={bindable.length === 0
            ? 'No compatible variable exists yet.' : undefined}>
            <HTMLSelect fill value={widget.variableId ?? ''}
              onChange={(e) => { patch({ variable_id: e.currentTarget.value }) }}
              options={bindable.map((v) => ({ label: v.apiName, value: v.id }))} />
          </FormGroup>
        )}

        {spec.fields.map((f) => (
          <FormGroup key={f.key} label={f.label} helperText={f.help}>
            {f.kind === 'textarea' ? (
              <TextArea fill rows={4} defaultValue={text(widget.config[f.key])}
                onBlur={(e) => { setConfig(f.key, e.target.value) }} />
            ) : f.kind === 'select' ? (
              <HTMLSelect fill value={text(widget.config[f.key] ?? f.options?.[0])}
                onChange={(e) => { setConfig(f.key, e.currentTarget.value) }}
                options={f.options ?? []} />
            ) : f.kind === 'csv' ? (
              <InputGroup defaultValue={(Array.isArray(widget.config[f.key])
                ? (widget.config[f.key] as string[]) : []).join(', ')}
                onBlur={(e) => {
                  setConfig(f.key, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))
                }} />
            ) : (
              <InputGroup defaultValue={text(widget.config[f.key])}
                onBlur={(e) => { setConfig(f.key, e.target.value) }} />
            )}
          </FormGroup>
        ))}
      </Section>

      {widget.widgetType === 'button_group' && (
        <ButtonsPanel mod={mod} widget={widget} onChange={(b) => { setConfig('buttons', b) }} />
      )}

      {widget.widgetType === 'filter_list' && (
        <FilterListPanel mod={mod} widget={widget}
          onChange={(c) => { patch({ config: c }) }} />
      )}

      {widget.widgetType === 'tabs' && (
        <TabsPanel mod={mod} widget={widget} onChange={(t) => { setConfig('tabs', t) }} />
      )}

      {widget.widgetType === 'embedded_module' && (
        <EmbeddedConfig mod={mod} widget={widget} apiName={apiName}
          onChange={(c) => { patch({ config: c }) }} />
      )}
    </div>
  )
}

function ButtonsPanel({ mod, widget, onChange }: {
  mod: ModuleDoc; widget: ModuleWidget; onChange: (buttons: ButtonSpec[]) => void
}) {
  const buttons = (Array.isArray(widget.config.buttons) ? widget.config.buttons : []) as ButtonSpec[]
  const set = (i: number, b: ButtonSpec) => { onChange(buttons.map((x, j) => (j === i ? b : x))) }

  return (
    <Section title="Buttons">
      {buttons.map((b, i) => {
        const descriptor = b.action ? actionDescriptors[b.action.type as keyof typeof actionDescriptors] : undefined
        // Hidden parameters are context the operator never sees; visible ones are
        // form fields. Ambient context (hotel, requestor) is supplied at runtime
        // and deliberately absent here.
        const params = descriptor ? descriptor.fields.map((f) => f.name) : []
        return (
          <div key={i} className="rounded border p-2 space-y-2">
            <div className="flex gap-1">
              <InputGroup fill placeholder="Label" defaultValue={b.label ?? ''}
                onBlur={(e) => { set(i, { ...b, label: e.target.value, key: b.key ?? e.target.value.toLowerCase().replace(/\W+/g, '_') }) }} />
              <Button size="small" variant="minimal" icon="cross" aria-label="Remove button"
                onClick={() => { onChange(buttons.filter((_, j) => j !== i)) }} />
            </div>

            <FormGroup label="Applies an action" helperText="Optional — a button can just fire events.">
              <HTMLSelect fill value={b.action?.type ?? ''}
                onChange={(e) => {
                  const type = e.currentTarget.value
                  set(i, { ...b, action: type ? { type, parameters: {} } : undefined })
                }}
                options={[{ label: '— none —', value: '' },
                  ...Object.keys(actionDescriptors).map((t) => ({ label: t, value: t }))]} />
            </FormGroup>

            {b.action && descriptor && (
              <div className="space-y-1 pl-2 border-l">
                <p className="text-[11px] text-muted-foreground leading-snug">{descriptor.description}</p>
                {params.map((name) => (
                  <BindingRow key={name} label={name} mod={mod} allowUserInput
                    binding={b.action?.parameters?.[name] ?? { source: 'user_input' }}
                    onChange={(bind) => {
                      const action = b.action
                      if (!action) return
                      set(i, { ...b, action: { ...action, parameters: { ...action.parameters, [name]: bind } } })
                    }} />
                ))}
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {descriptor.contextFields.join(', ')} are supplied by the application.
                </p>
              </div>
            )}
          </div>
        )
      })}
      <Button size="small" icon="add" text="Add button" fill
        onClick={() => { onChange([...buttons, { key: `b${buttons.length + 1}`, label: 'Button' }]) }} />
    </Section>
  )
}

/** A Filter List: which properties an operator may narrow on, and the one
 *  variable that holds what they chose.
 *
 *  Foundry's output variable "plays two roles" — the live filter state and the
 *  default applied on load — so there is exactly one, and the set that should
 *  narrow has to name it back. That second half is easy to forget, so the panel
 *  offers to wire it. */
function FilterListPanel({ mod, widget, onChange }: {
  mod: ModuleDoc; widget: ModuleWidget; onChange: (config: Record<string, unknown>) => void
}) {
  const update = useUpdateRow(mod.apiName)
  const cfg = widget.config
  const out = typeof cfg.output === 'string' ? cfg.output : ''
  const props = (Array.isArray(cfg.properties) ? cfg.properties : []) as Array<{ property: string; component?: string }>
  const filters = mod.variables.filter((v) => v.varType === 'object_set_filter')
  const shown = mod.variables.find((v) => v.id === widget.variableId)
  const wired = shown && shown.definition.filterVariable === out

  return (
    <Section title="Filtering">
      <FormGroup label="Puts the choice in" helperText={filters.length === 0
        ? 'Add a variable of type object_set_filter first — that is where the choice lives.'
        : undefined}>
        <HTMLSelect fill value={out}
          onChange={(e) => { onChange({ ...cfg, output: e.currentTarget.value }) }}
          options={[{ label: '— pick a filter variable —', value: '' },
            ...filters.map((v) => ({ label: v.apiName, value: v.apiName }))]} />
      </FormGroup>

      {out !== '' && shown && !wired && (
        <Callout intent={Intent.WARNING} icon="warning-sign" className="text-[11px]">
          <div className="mb-1">
            <code>{shown.apiName}</code> is not reading this filter yet, so nothing
            will narrow.
          </div>
          <Button size="small" text={`Have ${shown.apiName} use it`}
            onClick={() => {
              update.mutate({ table: 'module_variables', id: shown.id,
                patch: { definition: { ...shown.definition, filterVariable: out } } })
            }} />
        </Callout>
      )}

      {props.map((p, i) => (
        <div key={i} className="flex gap-1">
          <InputGroup fill placeholder="Property" defaultValue={p.property}
            onBlur={(e) => {
              onChange({ ...cfg, properties: props.map((x, j) =>
                (j === i ? { ...x, property: e.target.value } : x)) })
            }} />
          <HTMLSelect value={p.component ?? 'multi_select'}
            onChange={(e) => {
              onChange({ ...cfg, properties: props.map((x, j) =>
                (j === i ? { ...x, component: e.currentTarget.value } : x)) })
            }}
            options={[{ label: 'pick from values', value: 'multi_select' },
              { label: 'starts with', value: 'keyword' }]} />
          <Button size="small" variant="minimal" icon="cross" aria-label="Remove filter"
            onClick={() => { onChange({ ...cfg, properties: props.filter((_, j) => j !== i) }) }} />
        </div>
      ))}

      <Button size="small" icon="add" text="Add a property" fill
        onClick={() => { onChange({ ...cfg, properties: [...props, { property: '', component: 'multi_select' }] }) }} />

      <p className="text-[11px] text-muted-foreground leading-snug">
        Two components for now: pick-from-values, and starts-with. Foundry also
        offers histograms, distribution charts and date pickers.
      </p>
    </Section>
  )
}

/** Tabs. Each one is a label plus, optionally, an icon, a badge read from a
 *  variable, and a boolean that gates it — Foundry's own configuration set,
 *  minus the four styling presets, which are decided globally here. */
function TabsPanel({ mod, widget, onChange }: {
  mod: ModuleDoc; widget: ModuleWidget; onChange: (tabs: TabSpec[]) => void
}) {
  const tabs = (Array.isArray(widget.config.tabs) ? widget.config.tabs : []) as TabSpec[]
  const set = (i: number, t: TabSpec) => { onChange(tabs.map((x, j) => (j === i ? t : x))) }
  const booleans = mod.variables.filter((v) => v.varType === 'boolean')
  // Foundry allows a string or a number here. An object set is ours, showing its
  // count — see the note in ModuleRenderer.
  const badgeable = mod.variables.filter((v) =>
    v.varType === 'string' || v.varType === 'numeric' || v.varType === 'object_set')

  return (
    <Section title="Tabs">
      <p className="text-[11px] text-muted-foreground leading-snug">
        Give each tab an effect below — the one whose effect would leave you
        where you already are is the one that looks selected.
      </p>

      {tabs.map((t, i) => (
        <div key={i} className="rounded border p-2 space-y-2">
          <div className="flex gap-1">
            <InputGroup fill placeholder="Label" defaultValue={t.label ?? ''}
              onBlur={(e) => {
                set(i, { ...t, label: e.target.value,
                  key: t.key ?? e.target.value.toLowerCase().replace(/\W+/g, '_') })
              }} />
            <Button size="small" variant="minimal" icon="cross" aria-label="Remove tab"
              onClick={() => { onChange(tabs.filter((_, j) => j !== i)) }} />
          </div>

          <InputGroup size="small" placeholder="Icon (optional, e.g. inbox)"
            defaultValue={t.icon ?? ''}
            onBlur={(e) => { set(i, { ...t, icon: e.target.value || undefined }) }} />

          <FormGroup label="Badge" helperText="A label to the right — or a set, shown as its count.">
            <HTMLSelect fill value={t.badge ?? ''}
              onChange={(e) => { set(i, { ...t, badge: e.currentTarget.value || undefined }) }}
              options={[{ label: '— none —', value: '' },
                ...badgeable.map((v) => ({ label: v.apiName, value: v.apiName }))]} />
          </FormGroup>

          <FormGroup label="Only when" helperText="A boolean that gates this tab.">
            <div className="flex gap-1">
              <HTMLSelect fill value={t.visibleWhen ?? ''}
                onChange={(e) => { set(i, { ...t, visibleWhen: e.currentTarget.value || undefined }) }}
                options={[{ label: '— always —', value: '' },
                  ...booleans.map((v) => ({ label: v.apiName, value: v.apiName }))]} />
              {t.visibleWhen && (
                <HTMLSelect value={t.whenFalse ?? 'disabled'}
                  onChange={(e) => { set(i, { ...t, whenFalse: e.currentTarget.value as TabSpec['whenFalse'] }) }}
                  options={[{ label: 'else greyed', value: 'disabled' },
                    { label: 'else hidden', value: 'hidden' }]} />
              )}
            </div>
          </FormGroup>
        </div>
      ))}

      <Button size="small" icon="add" text="Add tab" fill
        onClick={() => { onChange([...tabs, { key: `t${tabs.length + 1}`, label: 'Tab' }]) }} />
    </Section>
  )
}

// ── Events ───────────────────────────────────────────────────────────────────

export function EventsPanel({ mod, sourceWidgetId, apiName }: {
  mod: ModuleDoc; sourceWidgetId: string; apiName: string
}) {
  const create = useCreateRow(apiName)
  const remove = useDeleteRow(apiName)
  const update = useUpdateRow(apiName)
  const [adding, setAdding] = useState(false)
  const events = mod.events.filter((e) => e.sourceWidgetId === sourceWidgetId)
    .sort((a, b) => a.position - b.position)

  return (
    <Section title="When this is used">
      {events.length === 0 && !adding && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Nothing happens yet.
        </p>
      )}

      {events.map((e) => {
        const kind = EFFECT_KINDS.find((k) => k.value === e.effectType)
        const needs = kind?.needs ?? []
        return (
          <div key={e.id} className="rounded border p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <Tag minimal className="!text-[10px]">
                {TRIGGERS.find((t) => t.value === e.trigger)?.label ?? e.trigger}
              </Tag>
              <span className="text-[11px] flex-1">{kind?.label ?? e.effectType}</span>
              <Button size="small" variant="minimal" icon="cross" aria-label="Remove effect"
                onClick={() => { remove.mutate({ table: 'module_events', id: e.id }) }} />
            </div>

            {needs.includes('variable') && (
              <HTMLSelect fill value={text(e.config.variableId)}
                onChange={(ev) => {
                  update.mutate({ table: 'module_events', id: e.id,
                    patch: { config: { ...e.config, variableId: ev.currentTarget.value } } })
                }}
                options={[{ label: '— which variable —', value: '' },
                  ...mod.variables.map((v) => ({ label: v.apiName, value: v.id }))]} />
            )}
            {needs.includes('layout') && (
              <HTMLSelect fill value={text(e.config.layoutApiName)}
                onChange={(ev) => {
                  update.mutate({ table: 'module_events', id: e.id,
                    patch: { config: { ...e.config, layoutApiName: ev.currentTarget.value } } })
                }}
                options={[{ label: '— which layout —', value: '' },
                  ...mod.layouts.map((l) => ({ label: `${l.title || l.apiName} (${l.layoutType})`, value: l.apiName }))]} />
            )}
            {e.effectType === 'set_variable' && (
              <InputGroup size="small" placeholder="Value, or a property name from the selected row"
                defaultValue={text(e.config.value ?? e.config.fromProperty)}
                onBlur={(ev) => {
                  const v = ev.target.value
                  update.mutate({ table: 'module_events', id: e.id,
                    patch: { config: e.trigger === 'row_select'
                      ? { ...e.config, fromProperty: v, value: undefined }
                      : { ...e.config, value: v } } })
                }} />
            )}
          </div>
        )
      })}

      {adding ? (
        <div className="rounded border p-2 space-y-1.5">
          <HTMLSelect fill id="new-effect-trigger" defaultValue="click"
            options={TRIGGERS.map((t) => ({ label: `When ${t.label}`, value: t.value }))} />
          <HTMLSelect fill id="new-effect-kind" defaultValue="set_variable"
            options={EFFECT_KINDS.map((k) => ({ label: k.label, value: k.value }))} />
          <div className="flex gap-1">
            <Button size="small" intent={Intent.PRIMARY} text="Add" onClick={() => {
              const trigger = (document.getElementById('new-effect-trigger') as HTMLSelectElement).value
              const effect = (document.getElementById('new-effect-kind') as HTMLSelectElement).value
              create.mutate({ table: 'module_events', row: {
                module_id: mod.id, source_widget_id: sourceWidgetId,
                trigger, effect_type: effect, config: {},
                position: nextPosition(events),
              } })
              setAdding(false)
            }} />
            <Button size="small" variant="minimal" text="Cancel" onClick={() => { setAdding(false) }} />
          </div>
        </div>
      ) : (
        <Button size="small" icon="add" text="Add an effect" fill onClick={() => { setAdding(true) }} />
      )}

      {events.length > 1 && (
        <p className="text-[10px] text-muted-foreground leading-snug">
          Effects run in order but do not wait for each other. One that reads what
          the previous one computed will read the old value.
        </p>
      )}
    </Section>
  )
}

// The configuration panel's contents — one per selectable thing.
//
// Every field writes straight to the row it describes. There is no draft state
// and no Save button: the canvas is the same renderer operators use, so an edit
// that is not yet written is an edit you cannot see the effect of.

import { useState } from 'react'
import {
  Button, Callout, FormGroup, HTMLSelect, InputGroup, Intent, TextArea, Tag,
} from '@blueprintjs/core'
import { useQuery } from '@tanstack/react-query'
import { actionDescriptors, buildAuthoredAgentTools, type LogicTool } from '@beacon/reality-graph'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'
import { supabase } from '@/lib/supabase/client'
import type { ModuleDoc, ModuleLayout, ModuleVariable, ModuleWidget } from '../api'
import type { Binding, ButtonSpec } from '../bindings'
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
        <FormGroup label="Name" helperText="Used in {{interpolation}} and in bindings.">
          <InputGroup defaultValue={variable.apiName}
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
          <FormGroup label="Value">
            <InputGroup defaultValue={text(def.value)}
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

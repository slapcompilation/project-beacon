// The Forms half of the action editor (666/667's engine, authored at last —
// creation review F6.5). Sections group parameters with columns, a title
// bar, and visibility; defaults prefill from a static value, an object
// property, or one of the actions namespace's prefill type classes. The
// resolver (action_form_effective) stays the one place the semantics live —
// this surface only writes the rows it reads. Override BLOCKS remain
// resolver-honored but authored elsewhere: their conditions are the criteria
// tree, and generalising that editor is the chunk's named residual.

import { useState } from 'react'
import {
  Button, Card, Checkbox, HTMLSelect, Icon, InputGroup, Tag,
} from '@blueprintjs/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

interface SectionRow {
  id: string
  title: string
  description: string
  columns: number
  showTitleBar: boolean
  visible: boolean
  position: number
}

interface ParamForm {
  id: string
  apiName: string
  displayName: string
  sectionId: string | null
  defaultSource: string | null
  defaultStatic: unknown
  defaultProperty: string | null
  defaultObjectParameterId: string | null
  typeClasses: string[]
}

/** The actions namespace's published prefill trio (emit-only). */
const TYPE_CLASSES = ['generate_uuid', 'prefill_current_user', 'view_object_with_type'] as const

const keys = {
  sections: (a: string) => ['action-form-sections', a] as const,
  params: (a: string) => ['action-form-params', a] as const,
}

function useSections(actionTypeId: string) {
  return useQuery({
    queryKey: keys.sections(actionTypeId),
    queryFn: async (): Promise<SectionRow[]> => {
      const { data, error } = await supabase.from('action_type_form_sections')
        .select('id, title, description, columns, show_title_bar, visible, position')
        .eq('action_type_id', actionTypeId).order('position')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; title: string; description: string; columns: number
        show_title_bar: boolean; visible: boolean; position: number
      }[]).map((r) => ({
        id: r.id, title: r.title, description: r.description, columns: r.columns,
        showTitleBar: r.show_title_bar, visible: r.visible, position: r.position,
      }))
    },
  })
}

function useParamForms(actionTypeId: string) {
  return useQuery({
    queryKey: keys.params(actionTypeId),
    queryFn: async (): Promise<ParamForm[]> => {
      const { data, error } = await supabase.from('action_type_parameters')
        .select('id, api_name, display_name, section_id, default_source, default_static, default_property, default_object_parameter_id, type_classes')
        .eq('action_type_id', actionTypeId).order('position')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; api_name: string; display_name: string; section_id: string | null
        default_source: string | null; default_static: unknown
        default_property: string | null; default_object_parameter_id: string | null
        type_classes: string[] | null
      }[]).map((r) => ({
        id: r.id, apiName: r.api_name, displayName: r.display_name, sectionId: r.section_id,
        defaultSource: r.default_source, defaultStatic: r.default_static,
        defaultProperty: r.default_property, defaultObjectParameterId: r.default_object_parameter_id,
        typeClasses: r.type_classes ?? [],
      }))
    },
  })
}

export function FormEditor({ actionTypeId }: { actionTypeId: string }) {
  const qc = useQueryClient()
  const { data: sections = [] } = useSections(actionTypeId)
  const { data: params = [] } = useParamForms(actionTypeId)
  const [newTitle, setNewTitle] = useState('')
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.sections(actionTypeId) })
    void qc.invalidateQueries({ queryKey: keys.params(actionTypeId) })
  }
  const onError = (e: Error) => { toast.error(e.message) }

  const addSection = useMutation({
    mutationFn: async (title: string) => {
      const api = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section'
      const { error } = await supabase.from('action_type_form_sections').insert({
        action_type_id: actionTypeId, api_name: `${api}-${sections.length + 1}`,
        title: title.trim(), description: '', columns: 1,
        show_title_bar: true, visible: true, position: sections.length,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(); setNewTitle('') },
    onError,
  })
  const patchSection = useMutation({
    mutationFn: async (i: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from('action_type_form_sections')
        .update(i.patch).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate, onError,
  })
  const dropSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('action_type_form_sections').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate, onError,
  })
  const patchParam = useMutation({
    mutationFn: async (i: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from('action_type_parameters')
        .update(i.patch).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate, onError,
  })

  return (
    <div className="mt-3 space-y-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Form</span>

      {/* Sections: "a logical grouping of parameters to organize an action
          form. Sections also support columns, descriptions, and conditional
          overrides." Only sections with a title can be collapsed. */}
      {sections.map((s) => (
        <Card key={s.id} compact className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Icon icon="widget-header" size={12} className="text-violet-500" />
            <InputGroup size="small" value={s.title} className="min-w-[140px]"
              onChange={(e) => { patchSection.mutate({ id: s.id, patch: { title: e.currentTarget.value } }) }} />
            <HTMLSelect value={s.columns}
              onChange={(e) => { patchSection.mutate({ id: s.id, patch: { columns: Number(e.currentTarget.value) } }) }}>
              <option value={1}>1 Column</option>
              <option value={2}>2 Columns</option>
            </HTMLSelect>
            <Checkbox checked={s.showTitleBar} label="Show title bar" className="!mb-0"
              onChange={(e) => { patchSection.mutate({ id: s.id, patch: { show_title_bar: e.currentTarget.checked } }) }} />
            <Checkbox checked={s.visible} label="Visible" className="!mb-0"
              onChange={(e) => { patchSection.mutate({ id: s.id, patch: { visible: e.currentTarget.checked } }) }} />
            <Button variant="minimal" size="small" icon="cross" className="ml-auto"
              onClick={() => { dropSection.mutate(s.id) }} />
          </div>
          <InputGroup size="small" placeholder="Description (always shown in the section, never a tooltip)"
            value={s.description}
            onChange={(e) => { patchSection.mutate({ id: s.id, patch: { description: e.currentTarget.value } }) }} />
        </Card>
      ))}
      <div className="flex items-center gap-2">
        <InputGroup size="small" placeholder="New section title" value={newTitle}
          onChange={(e) => { setNewTitle(e.currentTarget.value) }} />
        <Button size="small" icon="plus" disabled={newTitle.trim() === ''}
          loading={addSection.isPending}
          onClick={() => { addSection.mutate(newTitle) }}>Add section</Button>
      </div>

      {/* Per-parameter form config: its section, and its default — a
          form-time prefill the user may edit (the Edited chip), the two
          prefill type classes also honoured server-side. */}
      {params.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 text-xs pl-1">
          <Tag minimal className="font-mono">{p.apiName}</Tag>
          <HTMLSelect value={p.sectionId ?? ''}
            onChange={(e) => { patchParam.mutate({ id: p.id, patch: { section_id: e.currentTarget.value || null } }) }}>
            <option value="">No section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.title || s.id}</option>)}
          </HTMLSelect>
          <HTMLSelect value={p.defaultSource ?? ''}
            onChange={(e) => {
              const src = e.currentTarget.value || null
              patchParam.mutate({ id: p.id, patch: {
                default_source: src,
                ...(src !== 'static' ? { default_static: null } : {}),
                ...(src !== 'object_property' ? { default_property: null, default_object_parameter_id: null } : {}),
                ...(src !== 'type_class' ? { type_classes: [] } : {}),
              } })
            }}>
            <option value="">No default</option>
            <option value="static">Static value</option>
            <option value="object_property">Object property</option>
            <option value="type_class">Type class</option>
          </HTMLSelect>
          {p.defaultSource === 'static' && (
            <InputGroup size="small" placeholder="Default value"
              value={typeof p.defaultStatic === 'string' ? p.defaultStatic : p.defaultStatic == null ? '' : JSON.stringify(p.defaultStatic)}
              onChange={(e) => { patchParam.mutate({ id: p.id, patch: { default_static: JSON.stringify(e.currentTarget.value) } }) }} />
          )}
          {p.defaultSource === 'object_property' && (
            <>
              {/* The property is read off the OBJECT another parameter names
                  — one that sits ABOVE this one in the list (the guard's
                  rule). */}
              <HTMLSelect value={p.defaultObjectParameterId ?? ''}
                onChange={(e) => { patchParam.mutate({ id: p.id, patch: { default_object_parameter_id: e.currentTarget.value || null } }) }}>
                <option value="">Object parameter…</option>
                {params.filter((o) => o.id !== p.id).map((o) => (
                  <option key={o.id} value={o.id}>{o.displayName}</option>
                ))}
              </HTMLSelect>
              <InputGroup size="small" placeholder="property api name" className="font-mono"
                value={p.defaultProperty ?? ''}
                onChange={(e) => { patchParam.mutate({ id: p.id, patch: { default_property: e.currentTarget.value || null } }) }} />
            </>
          )}
          {p.defaultSource === 'type_class' && (
            <HTMLSelect value={p.typeClasses[0] ?? ''}
              onChange={(e) => { patchParam.mutate({ id: p.id, patch: { type_classes: e.currentTarget.value ? [e.currentTarget.value] : [] } }) }}>
              <option value="">Type class…</option>
              {TYPE_CLASSES.map((t) => <option key={t} value={t}>{t}</option>)}
            </HTMLSelect>
          )}
        </div>
      ))}
    </div>
  )
}

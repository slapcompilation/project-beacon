// Describe an application, get a draft to review. W7.
//
// The generator proposes; nothing here publishes. What comes back is checked
// against the real vocabulary by the SAME validator the eval suite covers,
// shown to the author with its problems if it has any, and only materialised as
// a DRAFT they then edit and publish in the builder.
//
// The edge function only holds the API key. Validation is not the security
// boundary either way — the module_* CHECK constraints refuse malformed rows
// whoever sends them — so it lives where one implementation serves the dialog,
// the tests and any future caller.
//
// So the failure mode is a wasted minute, not a wrong screen in production.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Callout, Dialog, DialogBody, DialogFooter, Intent, Spinner, SpinnerSize, Tag, TextArea,
} from '@blueprintjs/core'
import { useQuery } from '@tanstack/react-query'
import {
  buildAuthoringPrompt, moduleSpecToRows, parseModuleSpec, validateModuleSpec,
  type AuthoringCatalog, type ModuleSpec, type RowPayloads, type SpecProblem,
} from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'
import { slugify } from './api'

/** Only what this user can already see. The model is never told about a set
 *  across a tenant boundary, because RLS decides what comes back here. */
function useCatalog() {
  return useQuery({
    queryKey: ['authoring-catalog'],
    queryFn: async (): Promise<{ catalog: AuthoringCatalog; blurbs: string }> => {
      const { data, error } = await supabase.from('object_sets')
        .select('id, api_name, name, description')
      if (error) throw new Error(error.message)
      const sets = data as Array<{ id: string; api_name: string; name: string; description: string }>
      return {
        catalog: {
          objectSets: Object.fromEntries(sets.map((s) => [s.api_name, s.id])),
          // The tools a screen can compute through — the two the builder binds.
          toolNames: ['forecast_consumption', 'compute_reorder_point'],
        },
        blurbs: sets
          .map((s) => `  ${s.api_name}: ${s.name}${s.description ? ` — ${s.description}` : ''}`)
          .join('\n'),
      }
    },
  })
}

interface Proposal {
  spec: ModuleSpec
  problems: SpecProblem[]
  rows: RowPayloads | null
}

export function DescribeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [request, setRequest] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { data: cat, isLoading: catalogLoading } = useCatalog()

  const ask = async () => {
    // Guarded again for safety, but the button is disabled until the catalog is
    // in hand: pressing Compose early used to return here silently, which reads
    // as a dead button. It passed locally on a warm query and failed in CI.
    if (!cat) return
    setBusy(true); setError(null); setProposal(null)
    try {
      // functions.invoke types its payload as `any`; narrow at the boundary.
      const invoked = await supabase.functions.invoke('module-author', {
        body: {
          request,
          prompt: `${buildAuthoringPrompt(cat.catalog)}

What each set contains:
${cat.blurbs}`,
        },
      }) as { data: { text?: string; error?: string; message?: string } | null; error: { message: string } | null }
      if (invoked.error) throw new Error(invoked.error.message)
      const result = invoked.data ?? {}
      if (result.error) throw new Error(result.message ?? result.error)

      // Same validator the eval suite covers — one implementation, no drift.
      const spec = parseModuleSpec(result.text ?? '')
      if (!spec) {
        setError('The model did not answer with a usable application. Try saying it differently.')
        return
      }
      const problems = validateModuleSpec(spec, cat.catalog)
      setProposal({ spec, problems, rows: problems.length === 0 ? moduleSpecToRows(spec) : null })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the model.')
    } finally {
      setBusy(false)
    }
  }

  const accept = async () => {
    if (!proposal?.rows) return
    setBusy(true); setError(null)
    try {
      const apiName = await materialise(proposal.spec, proposal.rows)
      onClose()
      await navigate(`/modules/${apiName}/edit`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the draft.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog isOpen={open} onClose={onClose} title="Describe an application" className="!w-[34rem]">
      <DialogBody>
        <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
          Say what the screen is for. What comes back is a <strong>draft</strong> —
          you review it in the builder and publish it yourself.
        </p>
        <TextArea fill rows={3} value={request} disabled={busy}
          placeholder="A morning screen for the F&B manager: what is below par, how much we will use this week, and a way to reorder it."
          onChange={(e) => { setRequest(e.target.value) }} />

        {busy && !proposal && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} /> Composing…
          </div>
        )}

        {proposal && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{proposal.spec.title}</span>
              <Tag minimal>{proposal.spec.widgets.length} widgets</Tag>
              <Tag minimal>{proposal.spec.variables.length} variables</Tag>
            </div>
            {proposal.spec.description && (
              <p className="text-xs text-muted-foreground leading-snug">{proposal.spec.description}</p>
            )}
            <ul className="text-[11px] text-muted-foreground space-y-0.5">
              {proposal.spec.widgets.map((w) => (
                <li key={w.apiName}>· {w.title || w.widgetType}
                  <span className="opacity-60"> — {w.widgetType}{w.variable ? ` of ${w.variable}` : ''}</span>
                </li>
              ))}
            </ul>

            {proposal.problems.length > 0 && (
              <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs">
                <div className="font-semibold mb-1">
                  This will not be saved — it does not fit the vocabulary:
                </div>
                <ul className="space-y-0.5">
                  {proposal.problems.map((p, i) => (
                    <li key={i}><code className="text-[10px]">{p.code}</code> {p.message}
                      {p.at && <span className="opacity-60"> ({p.at})</span>}</li>
                  ))}
                </ul>
                <div className="mt-1.5 opacity-80">Say it differently and try again.</div>
              </Callout>
            )}
          </div>
        )}

        {error && <Callout intent={Intent.DANGER} icon="error" className="mt-3 text-xs">{error}</Callout>}
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button variant="minimal" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="minimal" onClick={() => { void ask() }}
            loading={catalogLoading}
            disabled={busy || catalogLoading || !cat || request.trim().length < 8}>
            {proposal ? 'Try again' : 'Compose'}
          </Button>
          <Button intent={Intent.PRIMARY} loading={busy && !!proposal}
            disabled={!proposal?.rows} onClick={() => { void accept() }}>
            Open as draft
          </Button>
        </>
      } />
    </Dialog>
  )
}

/** Names in the spec become ids here — the one place that knows both. Inserted
 *  parents first, so every reference resolves before it is needed. */
async function materialise(spec: ModuleSpec, rows: RowPayloads): Promise<string> {
  const apiName = `${slugify(spec.apiName || spec.title)}_${Date.now().toString(36).slice(-4)}`

  const { data: mod, error } = await supabase.from('modules')
    .insert({ ...rows.module, api_name: apiName }).select('id').single<{ id: string }>()
  if (error) throw new Error(error.message)

  const { data: sets } = await supabase.from('object_sets').select('id, api_name')
  const setIds = new Map((sets ?? []).map((s: { id: string; api_name: string }) => [s.api_name, s.id]))

  const varIds = new Map<string, string>()
  for (const v of rows.variables) {
    const def = v.definition as Record<string, unknown>
    const resolved = '_objectSet' in def
      ? { objectSetId: setIds.get(String(def._objectSet)) ?? null }
      : def
    const { data, error: e } = await supabase.from('module_variables')
      .insert({ ...v, module_id: mod.id, definition: resolved })
      .select('id').single<{ id: string }>()
    if (e) throw new Error(e.message)
    varIds.set(String(v.api_name), data.id)
  }

  // Two passes: every layout exists before any parent is pointed at.
  const layoutIds = new Map<string, string>()
  for (const l of rows.layouts) {
    const { _parent, ...row } = l as { _parent: string | null } & Record<string, unknown>
    const { data, error: e } = await supabase.from('module_layouts')
      .insert({ ...row, module_id: mod.id }).select('id').single<{ id: string }>()
    if (e) throw new Error(e.message)
    layoutIds.set(String(l.api_name), data.id)
  }
  for (const l of rows.layouts) {
    const parent = (l as { _parent: string | null })._parent
    if (!parent) continue
    await supabase.from('module_layouts')
      .update({ parent_id: layoutIds.get(parent) ?? null })
      .eq('id', layoutIds.get(String(l.api_name)) ?? '')
  }

  const widgetIds = new Map<string, string>()
  for (const w of rows.widgets) {
    const { _layout, _variable, ...row } = w as
      { _layout: string | null; _variable: string | null } & Record<string, unknown>
    const { data, error: e } = await supabase.from('module_widgets').insert({
      ...row, module_id: mod.id,
      layout_id: _layout ? layoutIds.get(_layout) ?? null : null,
      variable_id: _variable ? varIds.get(_variable) ?? null : null,
    }).select('id').single<{ id: string }>()
    if (e) throw new Error(e.message)
    widgetIds.set(String(w.api_name), data.id)
  }

  for (const ev of rows.events) {
    const { _widget, _config, ...row } = ev as
      { _widget: string; _config: Record<string, unknown> } & Record<string, unknown>
    // The spec speaks names; module_events stores ids.
    const config: Record<string, unknown> = { ..._config }
    if (typeof config.variable === 'string') {
      config.variableId = varIds.get(config.variable)
      delete config.variable
    }
    if (typeof config.layout === 'string') {
      config.layoutApiName = config.layout
      delete config.layout
    }
    const { error: e } = await supabase.from('module_events').insert({
      ...row, module_id: mod.id,
      source_widget_id: widgetIds.get(_widget) ?? null,
      config,
    })
    if (e) throw new Error(e.message)
  }

  return apiName
}

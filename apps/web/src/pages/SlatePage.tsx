// Slate — the application list, and one application in the editor.
//
// "There are four main areas of Slate in edit mode" (slate/navigation), and
// the capture draws them (slate/images/slate-ui-annotated.png):
//
//   1 Action bar   — name, File/Help, the panel buttons, Actions, Save
//   2 Widget List  — the widget tree, under a Widget | Workflow toggle
//   3 Canvas       — the workspace, with a screen-size selector
//   4 Widget Editor — Property | Layout | JSON | Events for the selection
//
// The panel buttons the capture names are Datasets, Queries, Functions,
// Platform, Events, Dependencies, Styles, Variables. Four have engines
// here (Events, Styles, Variables, and Datasets-as-variables, which the
// docs say the Datasets panel became); the rest open a note saying which
// page would build them, rather than an empty panel pretending otherwise.

import { useState } from 'react'
import {
  Button, Card, Dialog, DialogBody, HTMLSelect, Icon, InputGroup, Intent,
  NonIdealState, Spinner, SpinnerSize, Tab, Tabs, Tag, TextArea,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/projects/api'
import {
  useSlateApps, useSlateContents, useCreateSlateApp, useSlateWidgetKinds,
  useAddSlateWidget, useUpdateSlateWidget, useRemoveSlateWidget, useAddSlatePage,
  useAddSlateVariable, useSetStylesheet, useAddSlateEvent, useRemoveSlateEvent,
  type SlateApp, type SlateContents, type SlateWidget, type ContainerType,
} from '@/features/slate/api'

const CONTAINER_TYPES: ContainerType[] = ['basic', 'flex', 'repeating', 'split', 'tabbed']

/** The action bar's second row, in the capture's order. `panel` is the ones
 *  with an engine; the rest name the page that would build them. */
const PANELS = [
  { id: 'datasets', label: 'Datasets', note: 'The Datasets panel has been migrated to the Variables panel; tabular data is a shared variable.' },
  { id: 'queries', label: 'Queries', note: 'slate/concepts-queries — not built here.' },
  { id: 'functions', label: 'Functions', note: 'slate/concepts-functions — not built here.' },
  { id: 'platform', label: 'Platform', note: 'Object sets, object context and Foundry Functions — not built here.' },
  { id: 'events', label: 'Events', note: null },
  { id: 'dependencies', label: 'Dependencies', note: 'slate/applications-dependencies — not built here.' },
  { id: 'styles', label: 'Styles', note: null },
  { id: 'variables', label: 'Variables', note: null },
] as const

export default function SlatePage() {
  const { data: apps = [], isLoading } = useSlateApps()
  const [params, setParams] = useSearchParams()
  const openId = params.get('a')
  const open = apps.find((a) => a.id === openId) ?? null

  if (open) return <SlateEditor app={open} onClose={() => { setParams({}) }} />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Slate</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              Create an application: widgets on a canvas, wired to each other by name, drawing
              their data from queries rather than from the object layer alone.
            </p>
          </div>
          <NewAppButton />
        </header>

        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : apps.length === 0 ? (
          <NonIdealState icon="control" title="No applications yet"
            description="A Slate application lives in a project and inherits its permissions. Everything in it — widgets, queries, variables, functions — shares one namespace." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {apps.map((a) => (
              <Card key={a.id} interactive compact onClick={() => { setParams({ a: a.id }) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="control" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{a.name}</span>
                  <Tag minimal className="!text-[9px] ml-auto">{a.kind}</Tag>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{a.rid}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewAppButton() {
  const { data: projects = [] } = useProjects()
  const create = useCreateSlateApp()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')
  return (
    <>
      <Button intent={Intent.PRIMARY} icon="add" onClick={() => { setOpen(true) }}>
        New application
      </Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New Slate application">
        <DialogBody>
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
              <InputGroup value={name} placeholder="Slate Example"
                onChange={(e) => { setName(e.currentTarget.value) }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project</span>
              <HTMLSelect value={projectId} onChange={(e) => { setProjectId(e.currentTarget.value) }}>
                <option value="">Pick a project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </HTMLSelect>
            </label>
            <p className="text-[11px] text-muted-foreground">
              Public applications are not built here — they may not read objects, datasets,
              actions or files, and that isolation does not exist yet.
            </p>
            <Button intent={Intent.PRIMARY} icon="tick" loading={create.isPending}
              disabled={name.trim() === '' || projectId === ''}
              onClick={() => {
                create.mutate({ projectId, name: name.trim() },
                  { onSuccess: () => { setOpen(false); setName('') } })
              }}>Create</Button>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

function SlateEditor({ app, onClose }: { app: SlateApp; onClose: () => void }) {
  const { data: contents } = useSlateContents(app.id)
  const [pageId, setPageId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [panel, setPanel] = useState<string | null>(null)

  if (!contents) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  const page = contents.pages.find((p) => p.id === pageId) ?? contents.pages.at(0) ?? null
  const widget = contents.widgets.find((w) => w.id === selected) ?? null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 1 — the action bar */}
      <div className="sl-actionbar">
        <div className="sl-actionbar-row">
          <Button variant="minimal" size="small" icon="arrow-left" onClick={onClose} />
          <Icon icon="control" size={14} className="text-violet-500" />
          <span className="sl-appname">{app.name}</span>
          <Tag minimal className="!text-[9px]">{app.kind}</Tag>
          <span className="ml-auto flex items-center gap-1">
            <Tag minimal className="!text-[9px]">{contents.pages.length} page{contents.pages.length === 1 ? '' : 's'}</Tag>
            <Tag minimal className="!text-[9px]">{contents.identifiers.length} identifiers</Tag>
          </span>
        </div>
        <div className="sl-panelbar">
          {PANELS.map((p) => (
            <Button key={p.id} size="small" variant="minimal"
              className={panel === p.id ? 'sl-panel-active' : ''}
              onClick={() => { setPanel(panel === p.id ? null : p.id) }}>
              {p.label}
            </Button>
          ))}
          <HTMLSelect minimal className="ml-auto" value={page?.id ?? ''}
            onChange={(e) => { setPageId(e.currentTarget.value) }}>
            {contents.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </HTMLSelect>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* 2 — the widget list */}
        <WidgetList app={app} contents={contents} pageId={page?.id ?? null}
          selected={selected} onSelect={setSelected} />

        {/* 3 — the canvas */}
        <div className="flex-1 min-w-0 overflow-auto sl-canvas">
          {page === null ? (
            <NonIdealState icon="page-layout" title="No pages" />
          ) : (
            <WidgetTree contents={contents} pageId={page.id} parentId={null}
              selected={selected} onSelect={setSelected} />
          )}
        </div>

        {/* 4 — the widget editor, or a panel over it */}
        <div className="sl-inspector">
          {panel !== null
            ? <PanelBody app={app} contents={contents} panelId={panel} pageId={page?.id ?? null} />
            : widget
              ? <WidgetEditor app={app} contents={contents} widget={widget} />
              : <p className="sl-hint">Select a widget to configure it, or open a panel above.</p>}
        </div>
      </div>
    </div>
  )
}

/** The widget list is a tree, as the capture draws it — rooted at the page's
 *  top-level widgets, each row naming its identifier. */
function WidgetList({ app, contents, pageId, selected, onSelect }: {
  app: SlateApp
  contents: SlateContents
  pageId: string | null
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const [term, setTerm] = useState('')
  const nameOf = (w: SlateWidget) =>
    contents.identifiers.find((i) => i.id === w.identifierId)?.name ?? w.id.slice(0, 8)

  const rows = (parentId: string | null, depth: number): React.ReactElement[] =>
    contents.widgets
      .filter((w) => w.pageId === pageId && w.parentId === parentId)
      .sort((a, b) => a.position - b.position)
      .flatMap((w) => {
        const name = nameOf(w)
        const hidden = term !== '' && !name.toLowerCase().includes(term.toLowerCase())
        return [
          ...(hidden ? [] : [
            <li key={w.id}
              className={`sl-tree-row ${selected === w.id ? 'sl-tree-selected' : ''}`}
              style={{ paddingLeft: `${String(8 + depth * 14)}px` }}
              onClick={() => { onSelect(w.id) }}>
              <Icon icon={w.kind === 'container' ? 'box' : 'code'} size={11}
                className="text-muted-foreground" />
              <span className="truncate">{name}</span>
              {w.containerType && <Tag minimal className="!text-[9px]">{w.containerType}</Tag>}
            </li>,
          ]),
          ...rows(w.id, depth + 1),
        ]
      })

  return (
    <div className="sl-widgetlist">
      <div className="sl-widgetlist-head">
        <Tag minimal className="!text-[10px]">Widget</Tag>
        <Tag minimal className="!text-[10px] sl-tab-inactive">Workflow</Tag>
        <AddWidgetButton app={app} contents={contents} pageId={pageId} />
      </div>
      <div className="px-2 py-1">
        <InputGroup size="small" leftIcon="search" value={term} placeholder="Search widgets…"
          onChange={(e) => { setTerm(e.currentTarget.value) }} />
      </div>
      <p className="sl-tree-root">canvas</p>
      <ul>{rows(null, 0)}</ul>
    </div>
  )
}

function AddWidgetButton({ app, contents, pageId }: {
  app: SlateApp; contents: SlateContents; pageId: string | null
}) {
  const { data: kinds = [] } = useSlateWidgetKinds()
  const add = useAddSlateWidget(app.id)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('text')
  const [name, setName] = useState('')
  const parent = contents.widgets.find((w) => w.pageId === pageId && w.parentId === null) ?? null

  return (
    <>
      <Button variant="minimal" size="small" icon="add" className="ml-auto"
        title="Add widget" onClick={() => { setOpen(true) }} />
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="Add widget">
        <DialogBody>
          <div className="space-y-3">
            <div className="sl-kindgrid">
              {kinds.map((k) => (
                <Card key={k.kind} compact interactive={k.built}
                  className={`${k.built ? '' : 'sl-kind-unbuilt'} ${kind === k.kind ? 'sl-kind-picked' : ''}`}
                  onClick={k.built ? () => { setKind(k.kind) } : undefined}>
                  <p className="text-xs font-semibold">{k.label}</p>
                  <p className="text-[11px] text-muted-foreground">{k.note}</p>
                  {!k.built && <Tag minimal className="!text-[9px] mt-1">not built</Tag>}
                </Card>
              ))}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Name — must start w_ and be unique in this application
              </span>
              <InputGroup value={name} placeholder="w_myWidget"
                onChange={(e) => { setName(e.currentTarget.value) }} />
            </label>
            <Button intent={Intent.PRIMARY} icon="tick" loading={add.isPending}
              disabled={name.trim() === '' || pageId === null}
              onClick={() => {
                add.mutate({
                  pageId: pageId ?? '', parentId: parent?.id ?? null, kind,
                  name: name.trim(),
                  position: contents.widgets.filter((w) => w.parentId === (parent?.id ?? null)).length,
                }, { onSuccess: () => { setOpen(false); setName('') } })
              }}>Add</Button>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

/** The canvas renders the tree. A container arranges its children by its
 *  container type; the six built kinds draw themselves. */
function WidgetTree({ contents, pageId, parentId, selected, onSelect }: {
  contents: SlateContents
  pageId: string
  parentId: string | null
  selected: string | null
  onSelect: (id: string) => void
}) {
  const kids = contents.widgets
    .filter((w) => w.pageId === pageId && w.parentId === parentId)
    .sort((a, b) => a.position - b.position)
  if (kids.length === 0) return null
  return (
    <>
      {kids.map((w) => {
        const name = contents.identifiers.find((i) => i.id === w.identifierId)?.name ?? ''
        const cls = `sl-widget ${selected === w.id ? 'sl-widget-selected' : ''} ${w.additionalClasses}`
        if (w.kind === 'container') {
          // hoisted: a fallback inside the template reads as a class name
          const ct = w.containerType ?? 'basic'
          return (
            <div key={w.id} className={`${cls} sl-container sl-c-${ct}`}
              onClick={(e) => { e.stopPropagation(); onSelect(w.id) }}>
              <span className="sl-widget-tag">{name}</span>
              <WidgetTree contents={contents} pageId={pageId} parentId={w.id}
                selected={selected} onSelect={onSelect} />
            </div>
          )
        }
        return (
          <div key={w.id} className={cls}
            onClick={(e) => { e.stopPropagation(); onSelect(w.id) }}>
            <span className="sl-widget-tag">{name}</span>
            <SlateWidgetBody widget={w} />
          </div>
        )
      })}
    </>
  )
}

function SlateWidgetBody({ widget }: { widget: SlateWidget }) {
  const cfg = widget.config
  const text = typeof cfg.text === 'string' ? cfg.text : ''
  switch (widget.kind) {
    case 'text':
      return <p className="sl-text">{text || 'Text widget'}</p>
    case 'button':
      return <Button size="small">{text || 'Button'}</Button>
    case 'input':
      return <InputGroup size="small" placeholder={text || 'Input'} readOnly />
    case 'dropdown':
      return <HTMLSelect minimal><option>{text || 'Dropdown'}</option></HTMLSelect>
    case 'table':
      return <p className="sl-hint">Table — bind a query to fill it.</p>
    default:
      return <p className="sl-hint">{widget.kind}</p>
  }
}

/** The Widget Editor's four tabs, named by slate/navigation. */
function WidgetEditor({ app, contents, widget }: {
  app: SlateApp; contents: SlateContents; widget: SlateWidget
}) {
  const update = useUpdateSlateWidget(app.id)
  const remove = useRemoveSlateWidget(app.id)
  const [tab, setTab] = useState('property')
  const [json, setJson] = useState(JSON.stringify(widget.config, null, 2))
  const [classes, setClasses] = useState(widget.additionalClasses)
  const [styles, setStyles] = useState(widget.styles)
  const name = contents.identifiers.find((i) => i.id === widget.identifierId)?.name ?? ''
  const events = contents.events.filter((e) => e.eventIdentifierId === widget.identifierId)

  return (
    <div className="sl-editor">
      <div className="sl-editor-head">
        <Icon icon="widget" size={12} className="text-muted-foreground" />
        <span className="sl-editor-name">{name}</span>
        <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER}
          title="Delete widget"
          onClick={() => { remove.mutate({ id: widget.id, identifierId: widget.identifierId }) }} />
      </div>
      <Tabs id="slate-widget" selectedTabId={tab} onChange={(t) => { setTab(String(t)) }}>
        <Tab id="property" title="Property" />
        <Tab id="layout" title="Layout" />
        <Tab id="json" title="JSON" />
        <Tab id="events" title="Events" />
      </Tabs>
      <div className="sl-editor-body">
        {tab === 'property' && (
          <div className="space-y-2">
            <p className="sl-hint">Kind: {widget.kind}</p>
            {widget.kind === 'container' && (
              <label className="flex flex-col gap-1">
                <span className="sl-label">Container type</span>
                <HTMLSelect value={widget.containerType ?? 'basic'}
                  onChange={(e) => {
                    const v = e.currentTarget.value as ContainerType
                    update.mutate({ id: widget.id, container_type: v,
                      split_axis: v === 'split' ? 'horizontally' : null })
                  }}>
                  {CONTAINER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                </HTMLSelect>
              </label>
            )}
            {widget.containerType === 'split' && (
              <label className="flex flex-col gap-1">
                <span className="sl-label">Split axis</span>
                <HTMLSelect value={widget.splitAxis ?? 'horizontally'}
                  onChange={(e) => {
                    update.mutate({ id: widget.id, split_axis: e.currentTarget.value })
                  }}>
                  <option value="horizontally">horizontally</option>
                  <option value="vertically">vertically</option>
                </HTMLSelect>
              </label>
            )}
          </div>
        )}
        {tab === 'layout' && (
          <div className="space-y-2">
            {/* "Set the position and size of your widget, and apply custom styling." */}
            <label className="flex flex-col gap-1">
              <span className="sl-label">Additional classes</span>
              <InputGroup size="small" value={classes}
                onChange={(e) => { setClasses(e.currentTarget.value) }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="sl-label">Styles — this widget, and its children if it is a container</span>
              <TextArea fill rows={5} value={styles} className="font-mono !text-xs"
                onChange={(e) => { setStyles(e.currentTarget.value) }} />
            </label>
            <Button size="small" intent={Intent.PRIMARY} icon="tick" loading={update.isPending}
              onClick={() => {
                update.mutate({ id: widget.id, additional_classes: classes, styles })
              }}>Save</Button>
          </div>
        )}
        {tab === 'json' && (
          <div className="space-y-2">
            <p className="sl-hint">
              The raw configuration. State not exposed through Property is managed internally.
            </p>
            <TextArea fill rows={12} value={json} className="font-mono !text-xs"
              onChange={(e) => { setJson(e.currentTarget.value) }} />
            <Button size="small" intent={Intent.PRIMARY} icon="tick" loading={update.isPending}
              onClick={() => {
                try {
                  update.mutate({ id: widget.id, config: JSON.parse(json) as Record<string, unknown> })
                } catch {
                  // an invalid draft is the author's to fix
                }
              }}>Update</Button>
          </div>
        )}
        {tab === 'events' && (
          <div className="space-y-2">
            {events.length === 0
              ? <p className="sl-hint">No events on this widget. Wire one in the Events panel.</p>
              : events.map((e) => {
                const target = contents.identifiers.find((i) => i.id === e.actionIdentifierId)
                return (
                  <p key={e.id} className="text-xs font-mono">
                    {name}.{e.eventName} → {target?.name ?? ''}.{e.actionName}
                  </p>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}

/** The panels the action bar opens. Three have engines; the rest say which
 *  page would build them rather than rendering an empty shell. */
function PanelBody({ app, contents, panelId, pageId }: {
  app: SlateApp; contents: SlateContents; panelId: string; pageId: string | null
}) {
  const meta = PANELS.find((p) => p.id === panelId)
  const addVar = useAddSlateVariable(app.id)
  const addEvent = useAddSlateEvent(app.id)
  const removeEvent = useRemoveSlateEvent(app.id)
  const setCss = useSetStylesheet(app.id)
  const addPage = useAddSlatePage(app.id)
  const [css, setCssDraft] = useState(app.stylesheet)
  const [vname, setVname] = useState('')
  const [vtype, setVtype] = useState('String')
  const [vscope, setVscope] = useState('shared')
  const [evSrc, setEvSrc] = useState('')
  const [evName, setEvName] = useState('click')
  const [evDst, setEvDst] = useState('')
  const [evAction, setEvAction] = useState('run')

  if (meta?.note != null && panelId !== 'datasets') {
    return (
      <div className="sl-editor-body">
        <p className="sl-label">{meta.label}</p>
        <p className="sl-hint">{meta.note}</p>
      </div>
    )
  }

  if (panelId === 'styles') {
    return (
      <div className="sl-editor-body space-y-2">
        <p className="sl-label">Local stylesheet</p>
        <p className="sl-hint">
          One per application. Upstream this is LESS, compiled at page load; we store the text.
        </p>
        <TextArea fill rows={14} value={css} className="font-mono !text-xs"
          onChange={(e) => { setCssDraft(e.currentTarget.value) }} />
        <Button size="small" intent={Intent.PRIMARY} icon="tick" loading={setCss.isPending}
          onClick={() => { setCss.mutate(css) }}>Save</Button>
      </div>
    )
  }

  if (panelId === 'variables' || panelId === 'datasets') {
    return (
      <div className="sl-editor-body space-y-2">
        <p className="sl-label">Variables ({contents.variables.length})</p>
        {panelId === 'datasets' && <p className="sl-hint">{meta?.note}</p>}
        <ul>
          {contents.variables.map((v) => {
            const ident = contents.identifiers.find((i) => i.id === v.identifierId)
            return (
              <li key={v.id} className="flex items-center gap-2 text-xs py-0.5">
                <span className="flex-1 truncate font-mono">{ident?.name}</span>
                <Tag minimal className="!text-[9px]">{v.valueType}</Tag>
                {ident?.pageId != null && <Tag minimal className="!text-[9px]">page</Tag>}
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <InputGroup size="small" value={vname} placeholder="v_myVariable"
            onChange={(e) => { setVname(e.currentTarget.value) }} />
          <HTMLSelect value={vtype} onChange={(e) => { setVtype(e.currentTarget.value) }}>
            {['Number', 'String', 'Boolean', 'Array', 'Object', 'Null']
              .map((t) => <option key={t} value={t}>{t}</option>)}
          </HTMLSelect>
          <HTMLSelect value={vscope} onChange={(e) => { setVscope(e.currentTarget.value) }}>
            <option value="shared">shared</option>
            <option value="page">this page</option>
          </HTMLSelect>
          <Button size="small" icon="add" loading={addVar.isPending} disabled={vname.trim() === ''}
            onClick={() => {
              addVar.mutate({
                name: vname.trim(), valueType: vtype,
                pageId: vscope === 'page' ? pageId : null, defaultValue: null,
              }, { onSuccess: () => { setVname('') } })
            }} />
        </div>
        <Button size="small" variant="minimal" icon="add" loading={addPage.isPending}
          onClick={() => {
            addPage.mutate({ name: `Page ${String(contents.pages.length + 1)}`,
              position: contents.pages.length })
          }}>Add page</Button>
      </div>
    )
  }

  // events
  return (
    <div className="sl-editor-body space-y-2">
      <p className="sl-label">Events &amp; actions ({contents.events.length})</p>
      <ul>
        {contents.events.map((e) => {
          const src = contents.identifiers.find((i) => i.id === e.eventIdentifierId)
          const dst = contents.identifiers.find((i) => i.id === e.actionIdentifierId)
          return (
            <li key={e.id} className="flex items-center gap-2 text-xs py-0.5">
              <span className="flex-1 truncate font-mono">
                {src?.name}.{e.eventName} → {dst?.name}.{e.actionName}
              </span>
              <Button variant="minimal" size="small" icon="cross"
                onClick={() => { removeEvent.mutate(e.id) }} />
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <HTMLSelect value={evSrc} onChange={(e) => { setEvSrc(e.currentTarget.value) }}>
          <option value="">event on…</option>
          {contents.identifiers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </HTMLSelect>
        <InputGroup size="small" value={evName} onChange={(e) => { setEvName(e.currentTarget.value) }} />
        <HTMLSelect value={evDst} onChange={(e) => { setEvDst(e.currentTarget.value) }}>
          <option value="">action on…</option>
          {contents.identifiers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </HTMLSelect>
        <InputGroup size="small" value={evAction} onChange={(e) => { setEvAction(e.currentTarget.value) }} />
        <Button size="small" icon="add" loading={addEvent.isPending}
          disabled={evSrc === '' || evDst === ''}
          onClick={() => {
            addEvent.mutate({
              eventIdentifierId: evSrc, eventName: evName.trim(),
              actionIdentifierId: evDst, actionName: evAction.trim(),
              body: '', position: contents.events.length,
            }, { onSuccess: () => { setEvSrc(''); setEvDst('') } })
          }} />
      </div>
      <p className="sl-hint">
        Wiring is stored and validated; running it is a later arc.
      </p>
    </div>
  )
}

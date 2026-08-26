// Workshop — the module list, and one module in view or edit mode.
//
// The chrome follows the captures: a module header carrying icon and title
// with Edit at the right (workshop/images/object-apps-workshop-module.png),
// sections that draw their own header (icon + title) and nest by their
// layout, and an empty section offering "+ Add widget" over "Set layout"
// (workshop/images/configure_new_page.png).
//
// The builder rail is the captured one, minus the panels this arc has no
// engine for: Layout and Variables are real; layers, transfer and settings
// arrive with the arcs that fill them.

import { useState } from 'react'
import {
  Button, Card, Dialog, DialogBody, HTMLSelect, Icon, InputGroup, Intent,
  NonIdealState, Spinner, SpinnerSize, Tag, TextArea, type IconName,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/projects/api'
import {
  useWorkshopModules, useModuleContents, useCreateModule, useWidgetKinds,
  useAddWidget, useRemoveWidget, useSetSection, useSplitSection, useAddPage,
  useAddVariable, useRemoveVariable, useSetWidgetConfig,
  type ModuleContents, type SectionLayout, type WorkshopModule, type WorkshopSection,
} from '@/features/workshop/api'
import { WidgetFrame } from '@/features/workshop/widgets'

const LAYOUTS: SectionLayout[] = ['columns', 'rows', 'tabs', 'flow', 'toolbar', 'loop']

export default function WorkshopPage() {
  const { data: modules = [], isLoading } = useWorkshopModules()
  const [params, setParams] = useSearchParams()
  const openId = params.get('m')
  const open = modules.find((m) => m.id === openId) ?? null

  if (open) return <ModuleView module={open} onClose={() => { setParams({}) }} />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Workshop</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              Build interactive, object-backed apps. Everything a module shows is read from the
              object layer, so an application is a view of the ontology rather than a copy of it.
            </p>
          </div>
          <NewModuleButton />
        </header>

        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : modules.length === 0 ? (
          <NonIdealState icon="applications" title="No modules yet"
            description="A module is an application in a project — it inherits that project's permissions, and everything it displays comes from the object layer." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {modules.map((m) => (
              <Card key={m.id} interactive compact onClick={() => { setParams({ m: m.id }) }}>
                <div className="flex items-center gap-2">
                  <Icon icon={(m.headerIcon ?? 'applications') as IconName} size={14}
                    color={m.headerIconColor ?? undefined} />
                  <span className="text-sm font-semibold truncate">{m.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{m.rid}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewModuleButton() {
  const { data: projects = [] } = useProjects()
  const create = useCreateModule()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')

  return (
    <>
      <Button intent={Intent.PRIMARY} icon="add" onClick={() => { setOpen(true) }}>
        New module
      </Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New Workshop module">
        <DialogBody>
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
              <InputGroup value={name} placeholder="Flight Alert Inbox"
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
              The module inherits the permissions of the project it is created in.
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

function ModuleView({ module, onClose }: { module: WorkshopModule; onClose: () => void }) {
  const { data: contents } = useModuleContents(module.id)
  const [editing, setEditing] = useState(false)
  const [pageId, setPageId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  if (!contents) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={SpinnerSize.SMALL} />
      </div>
    )
  }
  const page = contents.pages.find((p) => p.id === pageId)
    ?? contents.pages.find((p) => p.isDefault) ?? contents.pages.at(0) ?? null
  const headerWidgets = contents.widgets.filter((w) => w.inHeader)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* The module header persists across pages — the one thing that does. */}
      {module.headerVisible && (
        <div className="ws-header">
          <Button variant="minimal" size="small" icon="arrow-left" onClick={onClose} />
          <Icon icon={(module.headerIcon ?? 'applications') as IconName} size={16}
            color={module.headerIconColor ?? undefined} />
          <span className="ws-header-title">{module.headerTitle ?? module.name}</span>
          <span className="ml-auto flex items-center gap-1">
            {headerWidgets.map((w) => (
              <WidgetFrame key={w.id} widget={w} editing={false} selected={false}
                onSelect={() => undefined} onRemove={() => undefined} />
            ))}
            <Button size="small" variant={editing ? undefined : 'minimal'} icon="edit"
              intent={editing ? Intent.PRIMARY : Intent.NONE}
              onClick={() => { setEditing(!editing) }}>
              {editing ? 'Editing' : 'Edit'}
            </Button>
          </span>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {editing && (
          <BuilderRail module={module} contents={contents}
            pageId={page?.id ?? null} onPickPage={setPageId} />
        )}
        <div className="flex-1 min-w-0 overflow-auto ws-canvas">
          {page === null ? (
            <NonIdealState icon="page-layout" title="No pages" />
          ) : (
            <SectionTree contents={contents} moduleId={module.id}
              parent={{ pageId: page.id }} editing={editing}
              selected={selected} onSelect={setSelected} />
          )}
        </div>
      </div>
    </div>
  )
}

/** The Layout panel: Header as a peer of the pages, one marked DEFAULT
 *  (workshop/images/add_page.png), then the module's variables. */
function BuilderRail({ module, contents, pageId, onPickPage }: {
  module: WorkshopModule
  contents: ModuleContents
  pageId: string | null
  onPickPage: (id: string) => void
}) {
  const addPage = useAddPage(module.id)
  const addVariable = useAddVariable(module.id)
  const removeVariable = useRemoveVariable(module.id)
  const [name, setName] = useState('')

  return (
    <div className="ws-rail">
      <div className="ws-rail-head">
        <span className="ws-rail-title">Layout</span>
        <Button variant="minimal" size="small" icon="add" title="New page"
          loading={addPage.isPending}
          onClick={() => {
            addPage.mutate({ name: `Page ${String(contents.pages.length)}`,
              position: contents.pages.length })
          }} />
      </div>
      <ul className="ws-rail-list">
        <li className="ws-rail-item">Header</li>
        {contents.pages.map((p) => (
          <li key={p.id}
            className={`ws-rail-item ws-rail-page ${p.id === pageId ? 'ws-rail-active' : ''}`}
            onClick={() => { onPickPage(p.id) }}>
            {p.name}
            {p.isDefault && <span className="ws-rail-default">DEFAULT</span>}
          </li>
        ))}
      </ul>

      <div className="ws-rail-head">
        <span className="ws-rail-title">Variables ({contents.variables.length})</span>
      </div>
      <ul className="ws-rail-list">
        {contents.variables.map((v) => (
          <li key={v.id} className="ws-rail-item ws-rail-var">
            <span className="flex-1 truncate">{v.name}</span>
            <Tag minimal className="!text-[9px]">{v.valueType.replace(/_/g, ' ')}</Tag>
            <Button variant="minimal" size="small" icon="cross"
              onClick={() => { removeVariable.mutate(v.id) }} />
          </li>
        ))}
      </ul>
      <div className="ws-rail-add">
        <InputGroup size="small" value={name} placeholder="New object set variable…"
          onChange={(e) => { setName(e.currentTarget.value) }} />
        <Button size="small" icon="add" disabled={name.trim() === ''}
          loading={addVariable.isPending}
          onClick={() => {
            addVariable.mutate({
              name: name.trim(), valueType: 'object_set',
              definitionType: 'object_set_definition', definition: {},
            }, { onSuccess: () => { setName('') } })
          }} />
      </div>
    </div>
  )
}

/** Sections nest, so the tree renders itself. A section's layout decides
 *  how its children are arranged — the captured six. */
function SectionTree({ contents, moduleId, parent, editing, selected, onSelect }: {
  contents: ModuleContents
  moduleId: string
  parent: { pageId: string } | { parentId: string }
  editing: boolean
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const children = contents.sections
    .filter((s) => 'pageId' in parent ? s.pageId === parent.pageId : s.parentId === parent.parentId)
    .sort((a, b) => a.position - b.position)
  if (children.length === 0) return null
  return (
    <>
      {children.map((s) => (
        <SectionView key={s.id} section={s} contents={contents} moduleId={moduleId}
          editing={editing} selected={selected} onSelect={onSelect} />
      ))}
    </>
  )
}

function SectionView({ section, contents, moduleId, editing, selected, onSelect }: {
  section: WorkshopSection
  contents: ModuleContents
  moduleId: string
  editing: boolean
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const kids = contents.sections.filter((s) => s.parentId === section.id)
  const widgets = contents.widgets
    .filter((w) => w.sectionId === section.id).sort((a, b) => a.position - b.position)
  const addWidget = useAddWidget(moduleId)
  const removeWidget = useRemoveWidget(moduleId)
  const setSection = useSetSection(moduleId)
  const split = useSplitSection(moduleId)
  const [picking, setPicking] = useState(false)
  const [collapsed, setCollapsed] = useState(section.collapsed)

  const style = section.widthMode === 'absolute' && section.widthValue !== null
    ? { flexBasis: `${String(section.widthValue)}px`, flexGrow: 0, flexShrink: 0 }
    : { flex: '1 1 0%' }

  return (
    <div className={`ws-section ws-layout-${section.layout}`} style={style}>
      {section.showHeader && (
        <div className="ws-section-head">
          {section.icon && <Icon icon={section.icon as IconName} size={12} />}
          <span className="ws-section-title">{section.title ?? 'Section'}</span>
          {section.collapsible && (
            <Button variant="minimal" size="small" className="ml-auto"
              icon={collapsed ? 'chevron-down' : 'chevron-up'}
              onClick={() => { setCollapsed(!collapsed) }} />
          )}
        </div>
      )}
      {!collapsed && (
        <div className={`ws-section-body ws-body-${section.layout}`}>
          {kids.length > 0 ? (
            <SectionTree contents={contents} moduleId={moduleId}
              parent={{ parentId: section.id }} editing={editing}
              selected={selected} onSelect={onSelect} />
          ) : widgets.length > 0 ? (
            widgets.map((w) => (
              <WidgetFrame key={w.id} widget={w} editing={editing}
                selected={selected === w.id}
                onSelect={() => { onSelect(w.id) }}
                onRemove={() => { removeWidget.mutate(w.id) }} />
            ))
          ) : editing ? (
            <div className="ws-empty-section">
              <Button size="small" icon="add" onClick={() => { setPicking(true) }}>Add widget</Button>
              <HTMLSelect minimal value={section.layout}
                onChange={(e) => {
                  split.mutate({ parentId: section.id,
                    layout: e.currentTarget.value as SectionLayout })
                }}>
                {LAYOUTS.map((l) => <option key={l} value={l}>Set layout: {l}</option>)}
              </HTMLSelect>
              <Button size="small" variant="minimal" icon="header"
                onClick={() => {
                  setSection.mutate({ id: section.id, show_header: !section.showHeader,
                    title: section.title ?? 'Section' })
                }}>
                {section.showHeader ? 'Hide header' : 'Show header'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
      <WidgetPicker isOpen={picking} onClose={() => { setPicking(false) }}
        onPick={(kind, label) => {
          addWidget.mutate({ sectionId: section.id, kind,
            name: `${label} ${String(widgets.length + 1)}`, position: widgets.length })
          setPicking(false)
        }} />
    </div>
  )
}

/** The widget selector: search over the catalogue, the picker's own
 *  categories, and every kind the database records — built ones can be
 *  added, catalogued ones say which page would build them. */
function WidgetPicker({ isOpen, onClose, onPick }: {
  isOpen: boolean
  onClose: () => void
  onPick: (kind: string, label: string) => void
}) {
  const { data: kinds = [] } = useWidgetKinds()
  const [term, setTerm] = useState('')
  const [category, setCategory] = useState('all')
  const categories = ['all', ...new Set(kinds.map((k) => k.category))]
  const shown = kinds.filter((k) =>
    (category === 'all' || k.category === category)
    && (term === '' || k.label.toLowerCase().includes(term.toLowerCase())))

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Add widget" className="ws-picker">
      <DialogBody>
        <InputGroup leftIcon="search" value={term} placeholder="Search widgets…"
          onChange={(e) => { setTerm(e.currentTarget.value) }} />
        <div className="ws-picker-tabs">
          {categories.map((c) => (
            <Button key={c} size="small" variant={category === c ? undefined : 'minimal'}
              onClick={() => { setCategory(c) }}>
              {c === 'all' ? 'All' : c.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
        <div className="ws-picker-grid">
          {shown.map((k) => (
            <Card key={k.kind} compact interactive={k.built}
              className={k.built ? '' : 'ws-picker-unbuilt'}
              onClick={k.built ? () => { onPick(k.kind, k.label) } : undefined}>
              <p className="text-xs font-semibold">{k.label}</p>
              <p className="text-[11px] text-muted-foreground">{k.note}</p>
              {!k.built && <Tag minimal className="!text-[9px] mt-1">not built</Tag>}
            </Card>
          ))}
        </div>
      </DialogBody>
    </Dialog>
  )
}

/** Bind a widget to an object set and its display options, as raw JSON —
 *  which is how Foundry itself exposes a widget's setup. */
export function WidgetConfigPanel({ moduleId, widget }: {
  moduleId: string
  widget: { id: string; config: Record<string, unknown> }
}) {
  const save = useSetWidgetConfig(moduleId)
  const [draft, setDraft] = useState(JSON.stringify(widget.config, null, 2))
  return (
    <div className="space-y-2">
      <TextArea fill rows={8} value={draft} className="font-mono !text-xs"
        onChange={(e) => { setDraft(e.currentTarget.value) }} />
      <Button size="small" intent={Intent.PRIMARY} icon="tick" loading={save.isPending}
        onClick={() => {
          try {
            save.mutate({ id: widget.id, config: JSON.parse(draft) as Record<string, unknown> })
          } catch {
            // an invalid draft is the author's to fix; the panel says so
          }
        }}>Save configuration</Button>
    </div>
  )
}

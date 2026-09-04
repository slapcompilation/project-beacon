// The Object View (718): the page one object gets. A configured view — if
// one exists — is the default, its tabs Workshop modules, with the standard
// view one toggle away; otherwise the standard view renders, computed from
// the type and stored nowhere: prominent properties (or all non-hidden if
// none are prominent), the object's links, its actions, its edit history.

import { useState } from 'react'
import {
  Button, Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag, Tab, Tabs,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { Link, useParams } from 'react-router-dom'
import { useObjectTypes, useLinkTypes } from '@/features/objectTypes/hooks'
import { rowToObjectType, rowToLinkType } from '@/features/objectTypes/api'
import { ActionsMenu } from '@/features/explorer/ActionsMenu'
import {
  useObjectViewFor, useObjectViewTabs, useObjectRecord, useObjectHistory,
  useLinkedObjects, useLinkedCount,
} from '@/features/objectView/api'
import { EmbeddedModule } from '@/features/objectView/EmbeddedModule'
import { FormattedValue } from '@/features/formatting/FormattedValue'

export default function ObjectViewPage() {
  const { typeId = '', pk = '' } = useParams()
  const { data: typeRows = [], isLoading: typesLoading } = useObjectTypes()
  const type = typeRows.map(rowToObjectType).find((t) => t.id === typeId)
  const { data: view } = useObjectViewFor(typeId || null)
  // The toggle button packaged with the view: configured is the default,
  // the standard view one click away.
  const [forceStandard, setForceStandard] = useState(false)

  if (typesLoading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  if (!type) {
    return <NonIdealState icon="cube" title="No such object type" />
  }
  const configured = view && !forceStandard ? view : null
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ObjectHeader typeLabel={type.label} icon={(type.icon || 'cube') as IconName}
        status={type.status ?? 'experimental'} pk={pk}
        toggle={view ? (
          <Button size="small" variant="minimal" icon={forceStandard ? 'grid-view' : 'manual'}
            onClick={() => { setForceStandard(!forceStandard) }}>
            {forceStandard ? 'Configured view' : 'Standard view'}
          </Button>
        ) : null} />
      {configured
        ? <ConfiguredBody viewId={configured.id} />
        : <StandardBody typeId={typeId} pk={pk} />}
    </div>
  )
}

function ObjectHeader({ typeLabel, icon, status, pk, toggle }: {
  typeLabel: string; icon: IconName; status: string; pk: string
  toggle: React.ReactNode
}) {
  return (
    <div className="ov-header">
      <Icon icon={icon} size={16} className="text-violet-500" />
      <div className="flex-1 min-w-0">
        <p className="ov-title">{pk}</p>
        <p className="ov-type">{typeLabel}</p>
      </div>
      <Tag minimal className="!text-[9px]">{status}</Tag>
      {toggle}
    </div>
  )
}

function ConfiguredBody({ viewId }: { viewId: string }) {
  const { data: tabs = [], isLoading } = useObjectViewTabs(viewId)
  const [tabId, setTabId] = useState<string | null>(null)
  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  if (tabs.length === 0) {
    return <NonIdealState icon="page-layout" title="An empty configured view"
      description="Add a tab in the Ontology Manager's Object views tab — each tab is a Workshop module." />
  }
  const active = tabs.find((t) => t.tabId === tabId) ?? tabs[0]
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* A single-tab view hides its tab strip. */}
      {tabs.length > 1 && (
        <Tabs selectedTabId={active.tabId} onChange={(t) => { setTabId(String(t)) }} className="ov-tabs">
          {tabs.map((t) => <Tab key={t.tabId} id={t.tabId} title={t.title} />)}
        </Tabs>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        <EmbeddedModule moduleId={active.moduleId} />
      </div>
    </div>
  )
}

/** One link type's rows for THIS object: the far objects themselves, ten at a
 *  time — the shape Workshop's widget documents ("Viewing 10 of 23,814 ·
 *  Show more") — with the count beside the name. An unreadable backing shows
 *  its named refusal rather than an empty list. */
function LinkedSection({ typeId, pk, link, label, farId, farLabel, titleKey, pkKey }: {
  typeId: string; pk: string; link: string; label: string
  farId: string; farLabel: string; titleKey: string | null; pkKey: string | null
}) {
  const [limit, setLimit] = useState(10)
  const { data: rows = [], error } = useLinkedObjects(typeId, pk, link, limit)
  const { data: total } = useLinkedCount(typeId, pk, link)

  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon icon="link" size={11} />
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[11px] text-muted-foreground">{farLabel}</span>
        {total !== undefined && <Tag minimal round className="!text-[10px]">{total}</Tag>}
      </div>
      {error ? (
        <p className="text-[11px] text-muted-foreground mt-1">{error.message}</p>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground mt-1">No linked objects.</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          {rows.map((r) => {
            const scalar = (v: unknown) =>
              typeof v === 'string' || typeof v === 'number' ? String(v) : null
            const farPk = (pkKey !== null ? scalar(r[pkKey]) : null) ?? ''
            const title = (titleKey !== null ? scalar(r[titleKey]) : null) ?? farPk
            return (
              <Link key={farPk} to={`/objects/${farId}/${farPk}`}
                className="flex items-center gap-2 text-xs no-underline link-quiet">
                <Icon icon="cube" size={10} />
                <span>{title}</span>
                {title !== farPk && <span className="font-mono text-[10px] text-muted-foreground">{farPk}</span>}
              </Link>
            )
          })}
          {total !== undefined && total > rows.length && (
            <Button size="small" variant="minimal" className="!text-[11px]"
              onClick={() => { setLimit(limit + 10) }}>
              Viewing {rows.length} of {total} · Show more
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function StandardBody({ typeId, pk }: { typeId: string; pk: string }) {
  const { data: typeRows = [] } = useObjectTypes()
  const types = typeRows.map(rowToObjectType)
  const type = types.find((t) => t.id === typeId)
  const pkProp = type?.properties.find((p) => p.isPrimaryKey) ?? null
  const { data: record = null, isLoading } = useObjectRecord(typeId, pkProp?.key ?? null, pk)
  const { data: history = [] } = useObjectHistory(typeId, pk)
  const { data: linkRows } = useLinkTypes()
  const linkTypes = linkRows.map(rowToLinkType)
  const links = linkTypes.filter((lt) => lt.sourceTypeId === typeId || lt.targetTypeId === typeId)
  const labelOf = (id: string) => types.find((t) => t.id === id)?.label ?? '?'

  if (!type) return null
  // The standard view's own composition (standard-object-views): prominent
  // properties spotlighted in card format "elevated above a table displaying
  // the remaining standard properties"; normal in a regular table; hidden
  // not visible. (The prominent-OR-all sentence describes the generated
  // CONFIGURED default, not this — the build's first cut conflated them.)
  const prominent = type.properties.filter((p) => p.visibility === 'prominent')
  const normal = type.properties.filter((p) => p.visibility === 'normal' || p.visibility === undefined)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-4 max-w-4xl space-y-3">
        <Card compact>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Properties</span>
            <div className="flex-1" />
            <ActionsMenu ontologyId={type.ontologyId ?? ''} objectTypeId={typeId}
              targets={[pk]} selectedRow={record ?? null} />
          </div>
          {isLoading ? <Spinner size={SpinnerSize.SMALL} /> : record === null ? (
            <p className="text-sm text-muted-foreground">
              No indexed object with this key — the index may not have run since it was created.
            </p>
          ) : (
            <>
              {prominent.length > 0 && (
                <div className="ov-prominent">
                  {prominent.map((p) => (
                    <div key={p.key} className="ov-prominent-card">
                      <p className="ov-prominent-label">{p.label}</p>
                      <p className="ov-prominent-value">
                        <FormattedValue value={record[p.key]} property={p} row={record} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <dl className="ov-properties">
                {normal.map((p) => (
                  <div key={p.key} className="ov-prop">
                    <dt>{p.label}</dt>
                    <dd><FormattedValue value={record[p.key]} property={p} row={record} /></dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Card>

        <Card compact>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked objects</span>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">This type has no link types.</p>
          ) : (
            <div className="space-y-3 mt-2">
              {links.map((lt) => {
                const farId = lt.sourceTypeId === typeId ? lt.targetTypeId : lt.sourceTypeId
                const far = types.find((t) => t.id === farId)
                return (
                  <LinkedSection key={lt.id} typeId={typeId} pk={pk} link={lt.apiName}
                    label={lt.label} farId={farId} farLabel={labelOf(farId)}
                    titleKey={far?.properties.find((p) => p.isTitleKey)?.key ?? null}
                    pkKey={far?.properties.find((p) => p.isPrimaryKey)?.key ?? null} />
                )
              })}
            </div>
          )}
        </Card>

        <Card compact>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit history</span>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">
              No edits — only changes made through Actions appear here.
            </p>
          ) : (
            <div className="space-y-1 mt-2">
              {history.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-xs">
                  <Icon icon={e.instruction === 'delete' ? 'trash' : e.instruction === 'create' ? 'plus' : 'edit'} size={11} />
                  <span className="font-mono">{e.instruction}</span>
                  <span className="text-muted-foreground">{new Date(e.appliedAt).toLocaleString()}</span>
                  {e.actionTypeId === null && <Tag minimal intent={Intent.WARNING} className="!text-[9px]">no action</Tag>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

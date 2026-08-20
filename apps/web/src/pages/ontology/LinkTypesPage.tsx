// Link types, listed with their two ends. Read-only: a link type is authored
// from the object type it starts at, which is where the source is already
// decided — so this page is the index, not a second builder.

import { Card, Icon, Tag } from '@blueprintjs/core'
import { Link, useSearchParams } from 'react-router-dom'
import { LinkTypeView } from '@/features/linkTypes/LinkTypeView'
import { rowToLinkType } from '@/features/objectTypes/api'
import { useLinkTypes } from '@/features/objectTypes/hooks'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { typePath, useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'
import { cn } from '@/lib/utils'

export default function LinkTypesPage() {
  const [params, setParams] = useSearchParams()
  const { ontology, isLoading } = useOmaOntology()
  const { types } = useOmaTypes()
  const { data: rows } = useLinkTypes()

  if (!ontology) {
    return <div className="oma-page max-w-2xl">{isLoading ? null : <NoOntologyCallout />}</div>
  }

  const links = rows.filter((r) => r.ontology_id === ontology.id).map(rowToLinkType)
  const nameOf = (id: string) => types.find((t) => t.id === id)?.label ?? '—'
  const selected = links.find((l) => l.id === params.get('link')) ?? null

  return (
    <div className="oma-page">
      <SectionHead title="Link types" count={links.length} />
      <p className="text-sm text-muted-foreground max-w-2xl mb-5">
        How two object types relate. Add one from an object type — open it under Object types and
        use its Link types card.
      </p>

      <div className="max-w-4xl">
        {links.length === 0 ? (
          <Card compact className="text-xs text-muted-foreground">None yet.</Card>
        ) : (
          <Card compact className="!p-0">
            <ul className="divide-y divide-border/30">
              {links.map((lt) => (
                <li key={lt.id}
                  className={cn('flex items-center gap-2 px-3 py-2 text-xs cursor-pointer',
                    lt.id === selected?.id && 'bg-muted')}
                  onClick={() => { setParams({ link: lt.id }) }}>
                  <Icon icon="arrows-horizontal" size={12} className="text-violet-500 shrink-0" />
                  <span className="font-medium">{lt.label}</span>
                  <Tag minimal className="font-mono">{lt.apiName}</Tag>
                  <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
                    <Link to={typePath(lt.sourceTypeId)}>{nameOf(lt.sourceTypeId)}</Link>
                    <Icon icon="arrow-right" size={11} />
                    <Link to={typePath(lt.targetTypeId)}>{nameOf(lt.targetTypeId)}</Link>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Foundry opens a link type from the object type's link graph; ours also
          opens from this index. Sections beyond Overview are unbuilt and
          declared, not stubbed (readings/link-type-view.md Decision 6). */}
      {selected !== null && (
        <div className="max-w-4xl mt-5">
          <LinkTypeView link={selected} types={types} ontologyName={ontology.label} />
        </div>
      )}
    </div>
  )
}

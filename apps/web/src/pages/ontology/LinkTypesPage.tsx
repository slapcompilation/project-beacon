// Link types, listed with their two ends. Read-only: a link type is authored
// from the object type it starts at, which is where the source is already
// decided — so this page is the index, not a second builder.

import { Card, Icon, Tag } from '@blueprintjs/core'
import { Link } from 'react-router-dom'
import { rowToLinkType } from '@/features/objectTypes/api'
import { useLinkTypes } from '@/features/objectTypes/hooks'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { typePath, useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'

export default function LinkTypesPage() {
  const { ontology, isLoading } = useOmaOntology()
  const { types } = useOmaTypes()
  const { data: rows } = useLinkTypes()

  if (!ontology) {
    return <div className="oma-page max-w-2xl">{isLoading ? null : <NoOntologyCallout />}</div>
  }

  const links = rows.filter((r) => r.ontology_id === ontology.id).map(rowToLinkType)
  const nameOf = (id: string) => types.find((t) => t.id === id)?.label ?? '—'

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
                <li key={lt.id} className="flex items-center gap-2 px-3 py-2 text-xs">
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
    </div>
  )
}

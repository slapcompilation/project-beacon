// The Discover view (§6.4): "a highly customizable landing page tailored to
// your preferences. By default, the Discover view showcases favorite object
// types, recently-viewed object types, and favorite groups."
//
// OMITTED BY NAME: `Favorite object types` and `Favourite type groups` —
// nothing stars an object type and nothing draws a group's link graph, so both
// sections would render their empty state forever. On a card, `9 dependents`
// and the type-group chips go with them: nothing counts either. `Configure`
// (the Customize homepage dialog) has no sections to reorder without them.

import { Icon, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { Link } from 'react-router-dom'
import type { ObjectTypeDef } from '@beacon/ontology'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { indexReady, useIndexStatuses } from '@/features/objectTypes/indexing'
import { NoOntologyCallout, OntologySummary } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { typePath, useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'

export default function DiscoverPage() {
  const { ontology, isLoading } = useOmaOntology()
  const { types } = useOmaTypes()
  const recentIds = useAppStore((s) => s.omaRecentTypes)
  // Ids can outlive the types they name — a deleted type drops out of Recent.
  const recent = recentIds.flatMap((id) => types.find((t) => t.id === id) ?? [])

  if (isLoading) return <div className="p-8"><Spinner size={SpinnerSize.SMALL} /></div>
  if (!ontology) return <div className="p-8 max-w-2xl"><NoOntologyCallout /></div>

  return (
    <div className="oma-page">
      <OntologySummary ontology={ontology} />

      {recent.length > 0 && (
        <section className="oma-section">
          <SectionHead title="Recently viewed object types" count={recent.length} />
          <Cards types={recent} />
        </section>
      )}

      <section className="oma-section">
        <SectionHead title="Object types" count={types.length}
          seeAll={<Link className="oma-see-all" to="/ontology/object-types">See all <Icon icon="arrow-right" size={12} /></Link>} />
        {types.length === 0
          ? <p className="text-[11px] text-muted-foreground">None yet — author one from Object types.</p>
          : <Cards types={types} />}
      </section>
    </div>
  )
}

function Cards({ types }: { types: ObjectTypeDef[] }) {
  const { data: indexes } = useIndexStatuses()
  return (
    <div className="oma-cards">
      {types.map((t) => {
        const ix = indexes?.get(t.id)
        return (
          <Link key={t.id} to={typePath(t.id)} className="oma-card">
            <span className="oma-card-head">
              {/* The ontology stores an icon per type but no colour, so the tile
                  takes the application's tint rather than inventing a per-type hue. */}
              <span className="oma-tile"><Icon icon={t.icon as IconName} size={16} color="#fff" /></span>
              <span className="min-w-0">
                <span className="oma-card-name">{t.label}</span>
                {indexReady(ix)
                  ? <span className="oma-card-sub">{ix.objectCount ?? 0} object{ix.objectCount === 1 ? '' : 's'}</span>
                  : <Tag minimal intent="warning" className="!text-[9px]">Not indexed</Tag>}
              </span>
            </span>
            <span className={cn('oma-card-desc', !t.description && 'is-empty')}>
              {t.description || 'No description'}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

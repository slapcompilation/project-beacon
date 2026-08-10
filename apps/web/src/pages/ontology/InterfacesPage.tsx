// Interfaces as a resource page (§6.9). The section itself is unchanged — it
// defines a shape and ticks which types implement it, and the conformance
// trigger has the final word on whether the claim is true.

import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import InterfacesSection from '@/features/interfaces/InterfacesSection'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { useInterfaces } from '@/features/interfaces/hooks'
import { useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'

export default function InterfacesPage() {
  const { ontology, isLoading } = useOmaOntology()
  const { types } = useOmaTypes()
  const { data: rows = [] } = useInterfaces()

  if (!ontology) {
    return <div className="oma-page max-w-2xl">{isLoading ? null : <NoOntologyCallout />}</div>
  }

  return (
    <div className="oma-page">
      <SectionHead title="Interfaces" count={rows.filter((r) => r.ontology_id === ontology.id).length} />
      <p className="text-sm text-muted-foreground max-w-2xl mb-5">
        A shape several object types share. Tick a type to claim it implements one; the database
        refuses the claim unless the type really has the properties.
      </p>
      <div className="max-w-4xl">
        <InterfacesSection types={types} ontologyId={ontology.id} />
      </div>
    </div>
  )
}

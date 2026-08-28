// The Ontology configuration tab — the documented home of the two
// ontology-level toggles: "ontology owners can navigate to the Ontology
// configuration tab in Ontology Manager and toggle on Require new ontology
// resources be saved in a project" (migrate-to-project-based-permissions),
// and the Ontology metrics toggle (view-usage). Both engines predate this
// surface (454, 579) — the creation review's F6.1 named them unreachable,
// and 722's bridge makes the owner gate passable at all.

import { Callout, Card, NonIdealState, Spinner, SpinnerSize, Switch } from '@blueprintjs/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { setOntologyMetrics } from '@beacon/platform'
import { useOmaOntology } from '@/features/ontologyManager/resources'

interface Config {
  requireResourcesInProject: boolean
  metricsEnabled: boolean
}

function useOntologyConfig(ontologyId: string | null) {
  return useQuery({
    queryKey: ['ontology-configuration', ontologyId ?? ''],
    enabled: ontologyId !== null,
    queryFn: async (): Promise<Config> => {
      const { data, error } = await supabase.from('ontologies')
        .select('require_resources_in_project, metrics_enabled')
        .eq('id', ontologyId ?? '').single()
      if (error) throw new Error(error.message)
      const r = data as { require_resources_in_project: boolean; metrics_enabled: boolean }
      return { requireResourcesInProject: r.require_resources_in_project, metricsEnabled: r.metrics_enabled }
    },
  })
}

export default function OntologyConfigurationPage() {
  const { ontology } = useOmaOntology()
  const qc = useQueryClient()
  const { data: config, isLoading } = useOntologyConfig(ontology?.id ?? null)
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['ontology-configuration', ontology?.id ?? ''] })
  }
  // The database is the gate: 454's guard refuses anyone ontology_role()
  // does not call owner, with its own named error — shown verbatim.
  const setRequire = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.from('ontologies')
        .update({ require_resources_in_project: on }).eq('id', ontology?.id ?? '')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(); toast.success('Ontology configuration saved') },
    onError: (e: Error) => { toast.error(e.message) },
  })
  const setMetrics = useMutation({
    mutationFn: (on: boolean) =>
      client(setOntologyMetrics).applyAction({ p_ontology: ontology?.id ?? '', p_enabled: on }),
    onSuccess: () => { invalidate(); toast.success('Ontology metrics saved') },
    onError: (e: Error) => { toast.error(e.message) },
  })

  if (!ontology) return <NonIdealState icon="cube" title="Open an ontology first" />
  if (isLoading || !config) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  return (
    <div className="px-8 py-6 max-w-2xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Ontology configuration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ontology-level settings, each an owner's to change — the database refuses anyone else.
        </p>
      </header>

      <Card compact>
        <Switch checked={config.requireResourcesInProject}
          disabled={setRequire.isPending}
          onChange={(e) => { setRequire.mutate(e.currentTarget.checked) }}
          labelElement={<span>
            <strong>Require new ontology resources be saved in a project</strong>
            <p className="text-xs text-muted-foreground mb-0">
              Project-based permissions: new object, link and action types must choose a
              project, whose roles then govern them. Enabled for new ontologies.
            </p>
          </span>} />
      </Card>

      <Card compact>
        <Switch checked={config.metricsEnabled}
          disabled={setMetrics.isPending}
          onChange={(e) => { setMetrics.mutate(e.currentTarget.checked) }}
          labelElement={<span>
            <strong>Ontology metrics</strong>
            <p className="text-xs text-muted-foreground mb-0">
              Record usage so object types can show their consumers — the Usage tab reads
              what this collects.
            </p>
          </span>} />
      </Card>

      <Callout compact icon="info-sign">
        Who counts as an owner: an explicit ontology role grant, or — until space-role
        derivation lands — an organization owner or admin of an organization in this
        ontology&apos;s space.
      </Callout>
    </div>
  )
}

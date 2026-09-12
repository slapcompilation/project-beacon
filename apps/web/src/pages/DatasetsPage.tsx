// Datasets — the way into a dataset.
//
// Foundry reaches a dataset through Compass, where it is one resource among
// others in a project; there is no "datasets list" application. This list
// stands in for that until the Compass family is built to its captures
// (docs/SURFACE-BUILD-MAP.md), and a card opens the dataset view at
// /datasets/:id — Dataset Preview's screen (pages/DatasetPage.tsx).
//
// "Navigate to your preferred folder and create a dataset." — the create pane
// asks for a location, because permissions derive from it.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, HTMLSelect, Icon, InputGroup, Intent, NonIdealState, Spinner, SpinnerSize, TextArea,
} from '@blueprintjs/core'
import { toSlug, type TransactionType } from '@beacon/ontology'
import { useAuthStore } from '@/stores/auth.store'
import { useProjects } from '@/features/projects/api'
import { datasetLocation, useCreateDataset, useDatasets } from '@/features/datasets/api'

export default function DatasetsPage() {
  const navigate = useNavigate()
  const { data: datasets = [], isLoading } = useDatasets()
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Datasets</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              A dataset is a wrapper around a collection of files, with a schema, a version
              history and a place in the filesystem. It is what an object type is backed by.
            </p>
          </div>
          <Button intent={Intent.PRIMARY} icon="add" onClick={() => { setCreating(!creating) }}>
            New dataset
          </Button>
        </header>

        {creating && <CreatePane onDone={() => { setCreating(false) }} />}

        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : datasets.length === 0 ? (
          <NonIdealState icon="th" title="No datasets yet"
            description="A dataset lands data in the platform and carries it through to the Ontology. Create one to give an object type something to be backed by." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {datasets.map((d) => (
              <Card key={d.id} interactive compact onClick={() => { void navigate(`/datasets/${d.id}`) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="th" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{d.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{datasetLocation(d)}</p>
                {d.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{d.description}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CreatePane({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const create = useCreateDataset()
  const { data: projects = [] } = useProjects()
  const organizationId = useAuthStore((s) => s.organizationId ?? '')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const apiName = toSlug(name)
  const project = projectId || (projects.at(0)?.id ?? '')
  // Previewed the same way the view renders it, so the two cannot drift.
  const chosen = projects.find((p) => p.id === project)
  const location = chosen ? `${chosen.spacePath}/${chosen.apiName}/${apiName}` : ''

  return (
    <Card className="space-y-3 !border-violet-400/50">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-48">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
          <InputGroup value={name} placeholder="Airlines" onChange={(e) => { setName(e.currentTarget.value) }} />
        </label>
        <label className="flex flex-col gap-1">
          {/* Foundry prompts for a location because permissions derive from it. */}
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</span>
          <HTMLSelect value={project} onChange={(e) => { setProjectId(e.currentTarget.value) }}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </HTMLSelect>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</span>
        <TextArea fill rows={2} value={description} placeholder="Optional — what this data is."
          onChange={(e) => { setDescription(e.currentTarget.value) }} />
      </label>
      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} size="small" icon="tick" loading={create.isPending}
          disabled={!apiName || !project}
          onClick={() => {
            create.mutate({ apiName, name: name.trim(), description: description.trim(), projectId: project, organizationId },
              // "Drag and drop the file into the dataset preview window." is
              // step 2, so a new dataset opens on its (empty) preview.
              { onSuccess: (id) => { onDone(); void navigate(`/datasets/${id}`) } })
          }}>
          Create
        </Button>
        <Button variant="minimal" size="small" onClick={onDone}>Cancel</Button>
        {apiName && project && (
          <span className="text-[11px] text-muted-foreground font-mono">{location}</span>
        )}
        {projects.length === 0 && (
          <span className="text-[11px] text-amber-600">A dataset needs a project to live in — create one first.</span>
        )}
      </div>
    </Card>
  )
}

export type { TransactionType }

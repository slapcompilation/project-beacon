// Which model produced a vector property's embeddings — the union `api/` calls
// embeddingModel, whose two arms the schema has guarded since 583/584 with
// nothing on any screen able to choose between them.
//
// The card appears only for vector properties, because
// `vector_embedding_only_on_vector` refuses the columns on anything else.
import { useEffect, useState } from 'react'
import { Button, Card, HTMLSelect, InputGroup, Tag } from '@blueprintjs/core'
import type { PropertyDef } from '@beacon/ontology'
import {
  EMBEDDING_MODELS, NO_EMBEDDING, useEmbedding, useSetEmbedding,
  type EmbeddingConfig, type EmbeddingKind, type EmbeddingModel,
} from '@/features/objectTypes/vectorEmbedding'

export function VectorEmbeddingCard({ properties }: { properties: PropertyDef[] }) {
  const vectors = properties.filter((p) => p.type === 'vector' && p.id)
  if (vectors.length === 0) return null
  return (
    <Card compact className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Embedding model</h3>
        <Tag minimal className="tabular-nums">{vectors.length}</Tag>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        What produced each vector. Either a Language Model Service model, or a Foundry live
        deployment naming the parameter the query goes into and the one the vector comes out of.
      </p>
      {vectors.map((p) => <VectorProperty key={p.id} property={p} />)}
    </Card>
  )
}

function VectorProperty({ property }: { property: PropertyDef }) {
  const id = property.id as string
  const { data: saved } = useEmbedding(id)
  const set = useSetEmbedding()
  const [cfg, setCfg] = useState<EmbeddingConfig>(NO_EMBEDDING)
  // The row is the truth; local state is the edit in progress.
  useEffect(() => { if (saved) setCfg(saved) }, [saved])

  const patch = (p: Partial<EmbeddingConfig>) => { setCfg({ ...cfg, ...p }) }
  const ready = cfg.kind === null
    || (cfg.kind === 'lms' && cfg.model !== null)
    || (cfg.kind === 'foundry_live_deployment'
        && (cfg.deploymentRid ?? '').trim().length > 0)

  return (
    <div className="space-y-2 border-t pt-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">{property.label}</span>
        <span className="text-xs text-muted-foreground">{property.apiName}</span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Source</span>
          <HTMLSelect value={cfg.kind ?? ''}
            onChange={(e) => {
              const k = (e.currentTarget.value || null) as EmbeddingKind | null
              // Switching arms clears the other side, which is what the CHECK
              // requires anyway — better here than as a constraint error.
              setCfg({ ...NO_EMBEDDING, kind: k })
            }}>
            <option value="">Not recorded</option>
            <option value="lms">Language Model Service</option>
            <option value="foundry_live_deployment">Foundry live deployment</option>
          </HTMLSelect>
        </label>

        {cfg.kind === 'lms' && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Model</span>
            <HTMLSelect value={cfg.model ?? ''}
              onChange={(e) => { patch({ model: (e.currentTarget.value || null) as EmbeddingModel | null }) }}>
              <option value="">Select…</option>
              {EMBEDDING_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </HTMLSelect>
          </label>
        )}

        {cfg.kind === 'foundry_live_deployment' && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Deployment RID</span>
              <InputGroup size="small" value={cfg.deploymentRid ?? ''}
                onValueChange={(v) => { patch({ deploymentRid: v }) }}
                placeholder="ri.foundry-ml-live.main.live-deployment.…" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Input parameter</span>
              <InputGroup size="small" value={cfg.inputParam ?? ''}
                onValueChange={(v) => { patch({ inputParam: v }) }} placeholder="query" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Output parameter</span>
              <InputGroup size="small" value={cfg.outputParam ?? ''}
                onValueChange={(v) => { patch({ outputParam: v }) }} placeholder="embedding" />
            </label>
          </>
        )}

        <Button icon="tick" disabled={!ready || set.isPending}
          onClick={() => { set.mutate({ propertyId: id, cfg }) }}>Save</Button>
      </div>
    </div>
  )
}

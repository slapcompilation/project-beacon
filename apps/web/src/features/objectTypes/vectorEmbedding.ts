// What produced a vector property's embeddings.
//
// `api/`'s embeddingModel is a union with two arms: a Language Model Service
// model, or a Foundry live deployment naming a RID plus the input and output
// parameter names — "the query string goes into one and the vector comes out of
// the other". The schema has carried both arms and their CHECK since 583/584
// and no screen has ever written either.
//
// Written directly rather than through the draft-and-save schema editor,
// because `save_object_type` names neither column, so a direct write survives a
// save. `vectorEmbedding.test` in the platform suite asserts that stays true.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

/** The six the Language Model Service arm admits. */
export const EMBEDDING_MODELS = [
  'openai_text_embedding_ada_002', 'text_embedding_3_large', 'text_embedding_3_small',
  'snowflake_arctic_embed_m', 'instructor_large', 'bge_base_en_v1_5',
] as const

export type EmbeddingModel = (typeof EMBEDDING_MODELS)[number]
export type EmbeddingKind = 'lms' | 'foundry_live_deployment'

export interface EmbeddingConfig {
  kind: EmbeddingKind | null
  model: EmbeddingModel | null
  deploymentRid: string | null
  inputParam: string | null
  outputParam: string | null
}

export const NO_EMBEDDING: EmbeddingConfig = {
  kind: null, model: null, deploymentRid: null, inputParam: null, outputParam: null,
}

/** The arms are mutually exclusive in the CHECK, so the writer clears the other
 *  side rather than leaving it for the constraint to reject. */
export function useSetEmbedding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ propertyId, cfg }: { propertyId: string; cfg: EmbeddingConfig }) => {
      const row = cfg.kind === 'lms'
        ? { vector_embedding_kind: 'lms', vector_embedding_model: cfg.model,
            vector_deployment_rid: null, vector_deployment_input_param: null,
            vector_deployment_output_param: null }
        : cfg.kind === 'foundry_live_deployment'
          ? { vector_embedding_kind: 'foundry_live_deployment', vector_embedding_model: null,
              vector_deployment_rid: cfg.deploymentRid,
              vector_deployment_input_param: cfg.inputParam,
              vector_deployment_output_param: cfg.outputParam }
          : { vector_embedding_kind: null, vector_embedding_model: null,
              vector_deployment_rid: null, vector_deployment_input_param: null,
              vector_deployment_output_param: null }
      const { error } = await supabase.from('object_type_properties')
        .update(row).eq('id', propertyId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['object-types'] })
      toast.success('Embedding model saved')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Read straight from the property row: PropertyDef does not carry these, and
 *  threading five columns through the draft model to display them would be the
 *  change this file exists to avoid. */
export function useEmbedding(propertyId: string | null) {
  return useQuery({
    queryKey: ['vector-embedding', propertyId],
    enabled: propertyId !== null,
    queryFn: async (): Promise<EmbeddingConfig> => {
      const { data, error } = await supabase.from('object_type_properties')
        .select('vector_embedding_kind, vector_embedding_model, vector_deployment_rid, vector_deployment_input_param, vector_deployment_output_param')
        .eq('id', propertyId as string).single()
      if (error) throw new Error(error.message)
      const r = data as Record<string, string | null>
      return {
        kind: r.vector_embedding_kind as EmbeddingKind | null,
        model: r.vector_embedding_model as EmbeddingModel | null,
        deploymentRid: r.vector_deployment_rid,
        inputParam: r.vector_deployment_input_param,
        outputParam: r.vector_deployment_output_param,
      }
    },
  })
}

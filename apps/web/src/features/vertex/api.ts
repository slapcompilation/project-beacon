// Vertex — graphs of objects in sub-graphs, templates, and the scenario
// sandbox (710-713).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  createVertexGraph, saveVertexGraph, createGraphFromTemplate,
  applyActionInScenario, mergeScenario, scenarioObjectState, vertexEventTypes,
} from '@beacon/platform'

export interface VxGraph {
  id: string
  rid: string
  projectId: string
  name: string
  readOnly: boolean
}

export interface VxSubgraph { id: string; name: string; position: number }

export interface VxNode {
  id: string
  subgraphId: string
  objectTypeId: string
  primaryKey: string
  x: number
  y: number
}

export interface VxEdge {
  id: string
  subgraphId: string
  fromNodeId: string
  toNodeId: string
  linkTypeId: string | null
}

export interface VxTemplate {
  id: string
  name: string
  description: string
}

export interface VxObjectParam {
  id: string
  templateId: string
  name: string
  description: string
  objectTypeId: string
  required: boolean
  singleObject: boolean
}

export interface VxCaseStudy { id: string; name: string; graphId: string | null }

export interface VxScenario {
  id: string
  name: string
  caseStudyId: string | null
  mergedAt: string | null
}

export interface VxScenarioAction {
  id: string
  scenarioId: string
  actionTypeId: string
  parameters: Record<string, unknown>
  position: number
}

/** Lightweight pickers — the page needs names, not the full definitions. */
export interface VxTypeOption { id: string; label: string }

export function useVxObjectTypes() {
  return useQuery({
    queryKey: ['vx-object-types'],
    staleTime: 30_000,
    queryFn: async (): Promise<VxTypeOption[]> => {
      const { data, error } = await supabase.from('object_types')
        .select('id, label').order('label')
      if (error) throw new Error(error.message)
      return data as VxTypeOption[]
    },
  })
}

export function useVxActionTypes() {
  return useQuery({
    queryKey: ['vx-action-types'],
    staleTime: 30_000,
    queryFn: async (): Promise<VxTypeOption[]> => {
      const { data, error } = await supabase.from('action_types')
        .select('id, label').order('label')
      if (error) throw new Error(error.message)
      return data as VxTypeOption[]
    },
  })
}

const keys = {
  graphs: ['vx-graphs'] as const,
  graph: (id: string) => ['vx-graph', id] as const,
  templates: ['vx-templates'] as const,
  scenarios: ['vx-scenarios'] as const,
}

export function useVxGraphs() {
  return useQuery({
    queryKey: keys.graphs,
    staleTime: 30_000,
    queryFn: async (): Promise<VxGraph[]> => {
      const { data, error } = await supabase.from('vertex_graphs')
        .select('id, rid, project_id, name, read_only').is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; rid: string; project_id: string; name: string; read_only: boolean
      }[]).map((r) => ({
        id: r.id, rid: r.rid, projectId: r.project_id, name: r.name, readOnly: r.read_only,
      }))
    },
  })
}

export interface VxGraphContents {
  subgraphs: VxSubgraph[]
  nodes: VxNode[]
  edges: VxEdge[]
}

export function useVxGraphContents(id: string | null) {
  return useQuery({
    queryKey: keys.graph(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<VxGraphContents> => {
      const { data: sg, error } = await supabase.from('vertex_subgraphs')
        .select('id, name, position').eq('graph_id', id ?? '').order('position')
      if (error) throw new Error(error.message)
      const subgraphs = sg as VxSubgraph[]
      if (subgraphs.length === 0) return { subgraphs, nodes: [], edges: [] }
      const ids = subgraphs.map((s) => s.id)
      const [nd, ed] = await Promise.all([
        supabase.from('vertex_graph_nodes')
          .select('id, subgraph_id, object_type_id, primary_key, x, y').in('subgraph_id', ids),
        supabase.from('vertex_graph_edges')
          .select('id, subgraph_id, from_node_id, to_node_id, link_type_id').in('subgraph_id', ids),
      ])
      if (nd.error) throw new Error(nd.error.message)
      if (ed.error) throw new Error(ed.error.message)
      return {
        subgraphs,
        nodes: (nd.data as {
          id: string; subgraph_id: string; object_type_id: string
          primary_key: string; x: number; y: number
        }[]).map((r) => ({
          id: r.id, subgraphId: r.subgraph_id, objectTypeId: r.object_type_id,
          primaryKey: r.primary_key, x: r.x, y: r.y,
        })),
        edges: (ed.data as {
          id: string; subgraph_id: string; from_node_id: string
          to_node_id: string; link_type_id: string | null
        }[]).map((r) => ({
          id: r.id, subgraphId: r.subgraph_id, fromNodeId: r.from_node_id,
          toNodeId: r.to_node_id, linkTypeId: r.link_type_id,
        })),
      }
    },
  })
}

export function useVxTemplates() {
  return useQuery({
    queryKey: keys.templates,
    staleTime: 30_000,
    queryFn: async (): Promise<{ templates: VxTemplate[]; params: VxObjectParam[] }> => {
      const [tp, pr] = await Promise.all([
        supabase.from('vertex_graph_templates').select('id, name, description').order('name'),
        supabase.from('vertex_template_object_parameters')
          .select('id, template_id, name, description, object_type_id, required, single_object'),
      ])
      if (tp.error) throw new Error(tp.error.message)
      if (pr.error) throw new Error(pr.error.message)
      return {
        templates: tp.data as VxTemplate[],
        params: (pr.data as {
          id: string; template_id: string; name: string; description: string
          object_type_id: string; required: boolean; single_object: boolean
        }[]).map((r) => ({
          id: r.id, templateId: r.template_id, name: r.name, description: r.description,
          objectTypeId: r.object_type_id, required: r.required, singleObject: r.single_object,
        })),
      }
    },
  })
}

export function useVxScenarios() {
  return useQuery({
    queryKey: keys.scenarios,
    queryFn: async (): Promise<{
      caseStudies: VxCaseStudy[]; scenarios: VxScenario[]; actions: VxScenarioAction[]
    }> => {
      const [cs, sc, ac] = await Promise.all([
        supabase.from('vertex_case_studies').select('id, name, graph_id').order('created_at'),
        supabase.from('ontology_scenarios')
          .select('id, name, case_study_id, merged_at').order('created_at'),
        supabase.from('scenario_actions')
          .select('id, scenario_id, action_type_id, parameters, position').order('position'),
      ])
      for (const r of [cs, sc, ac]) if (r.error) throw new Error(r.error.message)
      return {
        caseStudies: (cs.data as { id: string; name: string; graph_id: string | null }[])
          .map((r) => ({ id: r.id, name: r.name, graphId: r.graph_id })),
        scenarios: (sc.data as {
          id: string; name: string; case_study_id: string | null; merged_at: string | null
        }[]).map((r) => ({
          id: r.id, name: r.name, caseStudyId: r.case_study_id, mergedAt: r.merged_at,
        })),
        actions: (ac.data as {
          id: string; scenario_id: string; action_type_id: string
          parameters: Record<string, unknown>; position: number
        }[]).map((r) => ({
          id: r.id, scenarioId: r.scenario_id, actionTypeId: r.action_type_id,
          parameters: r.parameters, position: r.position,
        })),
      }
    },
  })
}

export function useCreateVxGraph() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string }) =>
      client(createVertexGraph).applyAction({ p_project: i.projectId, p_name: i.name }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.graphs }); toast.success('Graph created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

function useGraphMutation<T>(id: string, fn: (i: T) => Promise<unknown>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.graph(id) })
      if (done !== undefined) toast.success(done)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useAddNode(graphId: string) {
  return useGraphMutation<{
    subgraphId: string; objectTypeId: string; primaryKey: string; x: number; y: number
  }>(graphId, async (i) => {
    const { error } = await supabase.from('vertex_graph_nodes').insert({
      subgraph_id: i.subgraphId, object_type_id: i.objectTypeId,
      primary_key: i.primaryKey, x: i.x, y: i.y,
    })
    if (error) throw new Error(error.message)
  })
}

export function useAddEdge(graphId: string) {
  return useGraphMutation<{
    subgraphId: string; fromNodeId: string; toNodeId: string; linkTypeId: string | null
  }>(graphId, async (i) => {
    const { error } = await supabase.from('vertex_graph_edges').insert({
      subgraph_id: i.subgraphId, from_node_id: i.fromNodeId,
      to_node_id: i.toNodeId, link_type_id: i.linkTypeId,
    })
    if (error) throw new Error(error.message)
  })
}

export function useAddSubgraph(graphId: string) {
  return useGraphMutation<{ name: string; position: number }>(graphId, async (i) => {
    const { error } = await supabase.from('vertex_subgraphs')
      .insert({ graph_id: graphId, name: i.name, position: i.position })
    if (error) throw new Error(error.message)
  }, 'Subgraph created')
}

export function useSaveVxGraph(graphId: string) {
  return useMutation({
    mutationFn: (label: string) =>
      client(saveVertexGraph).applyAction({ p_graph: graphId, p_label: label }),
    onSuccess: () => { toast.success('Saved — Graph History has a new version') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useInstantiateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: {
      templateId: string; projectId: string; name: string
      objects: Record<string, string[]>
    }) => client(createGraphFromTemplate).applyAction({
      p_template: i.templateId, p_project: i.projectId,
      p_name: i.name, p_objects: i.objects,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.graphs })
      toast.success('Graph generated from the template')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useScenarioOps() {
  const qc = useQueryClient()
  const invalidate = () => { void qc.invalidateQueries({ queryKey: keys.scenarios }) }
  const onError = (e: Error) => { toast.error(e.message) }
  return {
    createCaseStudy: useMutation({
      mutationFn: async (i: { projectId: string; name: string; graphId: string | null }) => {
        const { error } = await supabase.from('vertex_case_studies').insert({
          project_id: i.projectId, name: i.name, graph_id: i.graphId })
        if (error) throw new Error(error.message)
      },
      onSuccess: () => { invalidate(); toast.success('Case study created') },
      onError,
    }),
    createScenario: useMutation({
      mutationFn: async (i: { name: string; caseStudyId: string | null }) => {
        const { error } = await supabase.from('ontology_scenarios').insert({
          name: i.name, case_study_id: i.caseStudyId })
        if (error) throw new Error(error.message)
      },
      onSuccess: () => {
        invalidate()
        toast.success('Scenario created — a sandbox on top of the ontology')
      },
      onError,
    }),
    applyAction: useMutation({
      mutationFn: (i: {
        scenarioId: string; actionTypeId: string
        parameters: Record<string, unknown>; primaryKey: string | null
      }) => client(applyActionInScenario).applyAction({
        p_scenario: i.scenarioId, p_action_type: i.actionTypeId,
        p_parameters: i.parameters as never, p_primary_key: i.primaryKey ?? undefined,
      }),
      onSuccess: () => {
        invalidate()
        toast.success('Action applied to the scenario — the base ontology is untouched')
      },
      onError,
    }),
    merge: useMutation({
      mutationFn: (scenarioId: string) =>
        client(mergeScenario).applyAction({ p_scenario: scenarioId }),
      onSuccess: (n) => {
        invalidate()
        toast.success(`Merged — ${String(n)} staged edit(s) committed to the Ontology`)
      },
      onError,
    }),
  }
}

/** One object as the scenario sees it — the sandbox overlay on the base. */
export function useScenarioState() {
  return useMutation({
    mutationFn: (i: { scenarioId: string; objectTypeId: string; primaryKey: string }) =>
      client(scenarioObjectState).executeFunction({
        p_scenario: i.scenarioId, p_object_type: i.objectTypeId, p_primary_key: i.primaryKey }),
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The events convention: object types wearing both event timestamps. */
export function useEventTypes() {
  return useQuery({
    queryKey: ['vx-event-types'],
    queryFn: () => client(vertexEventTypes).executeFunction({}),
  })
}

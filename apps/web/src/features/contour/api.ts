// Contour — analyses, paths of boards, parameters, the one dashboard, and
// the save that publishes a job spec (703-705).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  contourBoardKinds, createContourAnalysis, refreshContourPath,
  saveContourPathAsDataset, runBuild,
} from '@beacon/platform'

export interface Analysis {
  id: string
  rid: string
  projectId: string
  name: string
  dashboardName: string
}

export interface Path {
  id: string
  name: string
  position: number
  headDatasetId: string | null
  headPathId: string | null
  headRestrictedViewId: string | null
  pinnedTransactionId: string | null
}

export interface Board {
  id: string
  pathId: string
  position: number
  kind: string
  title: string
  enabled: boolean
  pivoted: boolean
  configuration: Record<string, unknown>
  selection: Record<string, unknown> | null
}

export interface Parameter {
  id: string
  name: string
  paramType: 'Date' | 'String' | 'Number'
  multiValue: boolean
  defaultValue: unknown
}

export interface BoardKind {
  kind: string
  description: string
  visualize: boolean
  filter_rows: boolean
  aggregate: boolean
  manipulate_columns: boolean
  remove_duplicates: boolean
  built: boolean
  note: string | null
}

const keys = {
  list: ['contour-analyses'] as const,
  one: (id: string) => ['contour-analysis', id] as const,
}

export function useAnalyses() {
  return useQuery({
    queryKey: keys.list,
    staleTime: 30_000,
    queryFn: async (): Promise<Analysis[]> => {
      const { data, error } = await supabase.from('contour_analyses')
        .select('id, rid, project_id, name, dashboard_name').is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; rid: string; project_id: string; name: string; dashboard_name: string
      }[]).map((r) => ({
        id: r.id, rid: r.rid, projectId: r.project_id, name: r.name,
        dashboardName: r.dashboard_name,
      }))
    },
  })
}

/** The 26-kind catalogue with the page's five capability flags. */
export function useBoardKinds() {
  return useQuery({
    queryKey: ['contour-board-kinds'],
    staleTime: Infinity,
    queryFn: () => client(contourBoardKinds).executeFunction({}) as Promise<BoardKind[]>,
  })
}

export interface AnalysisContents {
  paths: Path[]
  boards: Board[]
  parameters: Parameter[]
}

export function useAnalysisContents(id: string | null) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<AnalysisContents> => {
      const [pa, pr] = await Promise.all([
        supabase.from('contour_paths')
          .select('id, name, position, head_dataset_id, head_path_id, head_restricted_view_id, pinned_transaction_id')
          .eq('analysis_id', id ?? '').order('position'),
        supabase.from('contour_parameters')
          .select('id, name, param_type, multi_value, default_value')
          .eq('analysis_id', id ?? '').order('name'),
      ])
      if (pa.error) throw new Error(pa.error.message)
      if (pr.error) throw new Error(pr.error.message)
      const paths = (pa.data as {
        id: string; name: string; position: number
        head_dataset_id: string | null; head_path_id: string | null
        head_restricted_view_id: string | null; pinned_transaction_id: string | null
      }[]).map((r) => ({
        id: r.id, name: r.name, position: r.position,
        headDatasetId: r.head_dataset_id, headPathId: r.head_path_id,
        headRestrictedViewId: r.head_restricted_view_id,
        pinnedTransactionId: r.pinned_transaction_id,
      }))
      let boards: Board[] = []
      if (paths.length > 0) {
        const { data: bd, error } = await supabase.from('contour_boards')
          .select('id, path_id, position, kind, title, enabled, pivoted, configuration, selection')
          .in('path_id', paths.map((p) => p.id)).order('position')
        if (error) throw new Error(error.message)
        boards = (bd as {
          id: string; path_id: string; position: number; kind: string; title: string
          enabled: boolean; pivoted: boolean
          configuration: Record<string, unknown>; selection: Record<string, unknown> | null
        }[]).map((r) => ({
          id: r.id, pathId: r.path_id, position: r.position, kind: r.kind, title: r.title,
          enabled: r.enabled, pivoted: r.pivoted, configuration: r.configuration,
          selection: r.selection,
        }))
      }
      return {
        paths,
        boards,
        parameters: (pr.data as {
          id: string; name: string; param_type: 'Date' | 'String' | 'Number'
          multi_value: boolean; default_value: unknown
        }[]).map((r) => ({
          id: r.id, name: r.name, paramType: r.param_type,
          multiValue: r.multi_value, defaultValue: r.default_value,
        })),
      }
    },
  })
}

export function useCreateAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string }) =>
      client(createContourAnalysis).applyAction({ p_project: i.projectId, p_name: i.name }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.list }); toast.success('Analysis created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

function useContentsMutation<T>(id: string, fn: (i: T) => Promise<void>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.one(id) })
      if (done !== undefined) toast.success(done)
    },
    // Contour:BoardNotBuilt, :CannotPivot, :PathCycle, :RestrictedViewInput …
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useAddPath(id: string) {
  return useContentsMutation<{
    name: string; position: number; headDatasetId?: string; headPathId?: string
  }>(id, async (i) => {
    const { error } = await supabase.from('contour_paths').insert({
      analysis_id: id, name: i.name, position: i.position,
      head_dataset_id: i.headDatasetId ?? null, head_path_id: i.headPathId ?? null,
    })
    if (error) throw new Error(error.message)
  }, 'Path created')
}

export function useAddBoard(id: string) {
  return useContentsMutation<{
    pathId: string; position: number; kind: string; configuration: Record<string, unknown>
  }>(id, async (i) => {
    const { error } = await supabase.from('contour_boards').insert({
      path_id: i.pathId, position: i.position, kind: i.kind, configuration: i.configuration,
    })
    if (error) throw new Error(error.message)
  })
}

export function useUpdateBoard(id: string) {
  return useContentsMutation<{
    boardId: string
    patch: Partial<{ enabled: boolean; pivoted: boolean; title: string
      configuration: Record<string, unknown>; selection: Record<string, unknown> | null }>
  }>(id, async (i) => {
    const row: Record<string, unknown> = {}
    if (i.patch.enabled !== undefined) row.enabled = i.patch.enabled
    if (i.patch.pivoted !== undefined) row.pivoted = i.patch.pivoted
    if (i.patch.title !== undefined) row.title = i.patch.title
    if (i.patch.configuration !== undefined) row.configuration = i.patch.configuration
    if (i.patch.selection !== undefined) row.selection = i.patch.selection
    const { error } = await supabase.from('contour_boards').update(row).eq('id', i.boardId)
    if (error) throw new Error(error.message)
  })
}

export function useRemoveBoard(id: string) {
  return useContentsMutation<string>(id, async (boardId) => {
    const { error } = await supabase.from('contour_boards').delete().eq('id', boardId)
    if (error) throw new Error(error.message)
  }, 'Board removed')
}

export function useAddParameter(id: string) {
  return useContentsMutation<{
    name: string; paramType: string; multiValue: boolean; defaultValue: unknown
  }>(id, async (i) => {
    const { error } = await supabase.from('contour_parameters').insert({
      analysis_id: id, name: i.name, param_type: i.paramType,
      multi_value: i.multiValue, default_value: i.defaultValue as never,
    })
    if (error) throw new Error(error.message)
  }, 'Parameter created')
}

export function useRefreshPath(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pathId: string) =>
      client(refreshContourPath).applyAction({ p_path: pathId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.one(id) })
      toast.success('Refreshed — the path now reads the latest version')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Save as Dataset, and the Update button when called again: publishes the
 *  compiled job specification, then runs the build so the dataset is real. */
export function useSaveAsDataset() {
  return useMutation({
    mutationFn: async (i: { pathId: string; outputDatasetId: string }) => {
      await client(saveContourPathAsDataset).applyAction({
        p_path: i.pathId, p_output: i.outputDatasetId })
      return client(runBuild).applyAction({ p_targets: [i.outputDatasetId], p_force: true })
    },
    onSuccess: () => {
      toast.success('Saved — the job specification is published and the build has run')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

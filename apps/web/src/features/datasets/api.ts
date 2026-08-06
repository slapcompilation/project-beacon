// Datasets — the Dataset Layer, given a surface.
//
// Shape copied from Dataset Preview rather than invented: a header naming the
// dataset with its location and selected branch, an About panel carrying the
// fields their screenshot shows (Location, Type, Table size, RID, Branch,
// Created/Updated), a Columns section, and History
// (mirror/dataset-preview/overview.md).
//
// The view is read through `dataset_view`, not by querying the physical table:
// "what you are seeing is actually the latest dataset view", and the view is a
// replay of transactions, not the table's current contents.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  DatasetField, MarkingKind, MarkingOrigin, ResourceMarking,
  TransactionStatus, TransactionType,
} from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'

export interface Dataset {
  id: string
  rid: string
  apiName: string
  name: string
  description: string
  physicalTable: string | null
  projectId: string
  projectName: string
  projectApiName: string
  /** The space's path — the first element of every location below it. Empty
   *  while a project has no space. */
  spacePath: string
  createdAt: string
  updatedAt: string
}

/** "Location, which specifies the filepath location of the dataset."
 *
 *  Foundry's path starts at the space: "The file path of a Foundry resource…
 *  indicates the space as the first element of the path: for example,
 *  `space/project/sub-folder/my-file`." */
export const datasetLocation = (d: Dataset): string =>
  `${d.spacePath}/${d.projectApiName}/${d.apiName}`

export interface Branch {
  id: string
  name: string
  parentBranchId: string | null
  headTransactionId: string | null
}

export interface Transaction {
  id: string
  rid: string
  txnType: TransactionType
  status: TransactionStatus
  startedAt: string
  committedAt: string | null
}

export interface ViewFile { fileId: string; logicalPath: string; rowCount: number }

/** Every marking the dataset demands, tagged with which card it belongs in and
 *  how it got there. One RPC over the same predicates the RLS policies call, so
 *  the panel cannot say one thing while the gate does another. */
export function useDatasetMarkings(datasetId: string | null) {
  return useQuery({
    queryKey: ['dataset-markings', datasetId ?? ''],
    enabled: datasetId !== null,
    queryFn: async (): Promise<ResourceMarking[]> => {
      const res: { data: unknown; error: { message: string } | null } =
        await supabase.rpc('dataset_markings', { p_dataset: datasetId })
      if (res.error) throw new Error(res.error.message)
      return (res.data as {
        marking_id: string; name: string; color: string; category: string
        kind: MarkingKind; origin: MarkingOrigin; satisfied: boolean
      }[]).map((r) => ({
        markingId: r.marking_id, name: r.name, color: r.color, category: r.category,
        kind: r.kind, origin: r.origin, satisfied: r.satisfied,
      }))
    },
  })
}

const keys = {
  all: ['datasets'] as const,
  one: (id: string) => ['dataset', id] as const,
  branches: (id: string) => ['dataset-branches', id] as const,
  transactions: (id: string) => ['dataset-transactions', id] as const,
  schema: (id: string) => ['dataset-schema', id] as const,
  view: (branch: string) => ['dataset-view', branch] as const,
}

const SELECT = 'id, rid, api_name, name, description, physical_table, created_at, updated_at, project_id, projects(name, api_name, spaces(path))'

interface DatasetRow {
  id: string; rid: string; api_name: string; name: string; description: string
  physical_table: string | null; created_at: string; updated_at: string; project_id: string
  projects: { name: string; api_name: string; spaces: { path: string } | null } | null
}

const toDataset = (r: DatasetRow): Dataset => ({
  id: r.id, rid: r.rid, apiName: r.api_name, name: r.name, description: r.description,
  physicalTable: r.physical_table, createdAt: r.created_at, updatedAt: r.updated_at,
  projectId: r.project_id,
  projectName: r.projects?.name ?? '', projectApiName: r.projects?.api_name ?? '',
  spacePath: r.projects?.spaces?.path ?? '',
})

export function useDatasets() {
  return useQuery({
    queryKey: keys.all,
    queryFn: async (): Promise<Dataset[]> => {
      const { data, error } = await supabase.from('datasets').select(SELECT).order('name')
      if (error) throw new Error(error.message)
      return (data as unknown as DatasetRow[]).map(toDataset)
    },
    staleTime: 30_000,
  })
}

export function useBranches(datasetId: string | null) {
  return useQuery({
    queryKey: keys.branches(datasetId ?? ''),
    enabled: datasetId !== null,
    queryFn: async (): Promise<Branch[]> => {
      const { data, error } = await supabase.from('dataset_branches')
        .select('id, name, parent_branch_id, head_transaction_id')
        .eq('dataset_id', datasetId ?? '').order('name')
      if (error) throw new Error(error.message)
      return (data as { id: string; name: string; parent_branch_id: string | null; head_transaction_id: string | null }[])
        .map((r) => ({ id: r.id, name: r.name, parentBranchId: r.parent_branch_id, headTransactionId: r.head_transaction_id }))
    },
  })
}

export function useTransactions(datasetId: string | null) {
  return useQuery({
    queryKey: keys.transactions(datasetId ?? ''),
    enabled: datasetId !== null,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase.from('dataset_transactions')
        .select('id, rid, txn_type, status, started_at, committed_at')
        .eq('dataset_id', datasetId ?? '').order('started_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data as { id: string; rid: string; txn_type: TransactionType; status: TransactionStatus; started_at: string; committed_at: string | null }[])
        .map((r) => ({ id: r.id, rid: r.rid, txnType: r.txn_type, status: r.status, startedAt: r.started_at, committedAt: r.committed_at }))
    },
  })
}

/** The schema of the latest view. Foundry attaches one per view, so the newest
 *  row is the current one. */
export function useSchema(datasetId: string | null) {
  return useQuery({
    queryKey: keys.schema(datasetId ?? ''),
    enabled: datasetId !== null,
    queryFn: async (): Promise<DatasetField[] | null> => {
      const { data, error } = await supabase.from('dataset_schemas')
        .select('fields, created_at').eq('dataset_id', datasetId ?? '')
        .order('created_at', { ascending: false }).limit(1)
      if (error) throw new Error(error.message)
      const rows = data as { fields: DatasetField[] }[]
      return rows.length > 0 ? rows[0].fields : null
    },
  })
}

/** The files in the branch's current view — the replay, not the table. */
export function useView(branchId: string | null) {
  return useQuery({
    queryKey: keys.view(branchId ?? ''),
    enabled: branchId !== null,
    queryFn: async (): Promise<ViewFile[]> => {
      // The RPC has no generated type — its shape is the RETURNS TABLE of
      // dataset_view, which check:rpcs proves exists.
      const res: { data: unknown; error: { message: string } | null } =
        await supabase.rpc('dataset_view', { p_branch: branchId })
      if (res.error) throw new Error(res.error.message)
      return (res.data as { file_id: string; logical_path: string; row_count: number }[])
        .map((r) => ({ fileId: r.file_id, logicalPath: r.logical_path, rowCount: r.row_count }))
    },
  })
}

/** Creating a dataset creates its root branch too. Foundry: "most datasets in
 *  Foundry have a single root branch called `master`." */
export function useCreateDataset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { apiName: string; name: string; description: string; projectId: string; organizationId: string }) => {
      const { data, error } = await supabase.from('datasets')
        .insert({
          api_name: i.apiName, name: i.name, description: i.description,
          project_id: i.projectId, organization_id: i.organizationId,
        }).select('id').single()
      if (error) throw new Error(error.message)
      const id = (data as { id: string }).id
      const { error: bErr } = await supabase.from('dataset_branches')
        .insert({ dataset_id: id, name: 'master' })
      if (bErr) throw new Error(bErr.message)
      return id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all })
      toast.success('Dataset created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

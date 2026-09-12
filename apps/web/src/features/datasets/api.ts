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
import {
  abortTransaction, commitTransaction, datasetBranchSchema, datasetColumnStats, datasetMarkings,
  datasetPreview, datasetPreviewCount, datasetView, uploadFileToDataset,
} from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import type { Json, PreviewFilter } from './preview'

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
  createdByUserId: string | null
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
      const rows = await client(datasetMarkings).executeFunction({ p_dataset: datasetId as string })
      return (rows as unknown as {
        marking_id: string; name: string; category: string
        kind: MarkingKind; origin: MarkingOrigin; satisfied: boolean
      }[]).map((r) => ({
        markingId: r.marking_id, name: r.name, category: r.category,
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

const SELECT = 'id, rid, api_name, name, description, physical_table, created_by_user_id, created_at, updated_at, project_id, projects(name, api_name, spaces(path))'

interface DatasetRow {
  id: string; rid: string; api_name: string; name: string; description: string
  physical_table: string | null; created_by_user_id: string | null
  created_at: string; updated_at: string; project_id: string
  projects: { name: string; api_name: string; spaces: { path: string } | null } | null
}

const toDataset = (r: DatasetRow): Dataset => ({
  id: r.id, rid: r.rid, apiName: r.api_name, name: r.name, description: r.description,
  physicalTable: r.physical_table, createdByUserId: r.created_by_user_id,
  createdAt: r.created_at, updatedAt: r.updated_at,
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

export function useDataset(id: string | null) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<Dataset | null> => {
      const { data, error } = await supabase.from('datasets').select(SELECT).eq('id', id ?? '').maybeSingle()
      if (error) throw new Error(error.message)
      return data === null ? null : toDataset(data as unknown as DatasetRow)
    },
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

/** Settle an open transaction. Commit "is preserved and the Branch is updated
 *  to point to the Transaction"; abort "not preserved and the Branch is not
 *  updated" — the head trigger and the COMMITTED filter do the two halves. */
export function useSettleTransaction(datasetId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, to }: { id: string; to: 'commit' | 'abort' }) => {
      await client(to === 'commit' ? commitTransaction : abortTransaction)
        .applyAction({ p_transaction: id })
      return to
    },
    onSuccess: (to) => {
      void qc.invalidateQueries({ queryKey: keys.transactions(datasetId ?? '') })
      void qc.invalidateQueries({ queryKey: ['datasets'] })
      toast.success(to === 'commit' ? 'Committed — the branch now points here' : 'Aborted')
    },
    onError: (e: Error) => { toast.error(e.message) },
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
      // The row shape is the RETURNS TABLE of dataset_view, generated from it.
      const rows = await client(datasetView).executeFunction({ p_branch: branchId as string })
      return rows.map((r) => ({ fileId: r.file_id, logicalPath: r.logical_path, rowCount: r.row_count }))
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

/** Uploading a file into an existing dataset — the Dataset Preview path, not
 *  Compass's. "In Dataset Preview, you can upload files of the following types
 *  directly into a dataset": `.csv`, `.tsv`, `.xls`, `.xlsm`, `.xlsx`. The
 *  engine builds the two with a documented schema story and refuses the other
 *  three by name, so the picker offers those two.
 *
 *  The transaction type is the server's to choose — same filename and schema is
 *  an UPDATE, a new filename an APPEND — so nothing here proposes one. */
export const UPLOAD_ACCEPT = '.csv,.tsv'

export function useUploadFile(datasetId: string, branchName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File): Promise<{ path: string; type: string }> => {
      const content = await file.text()
      const txn = await client(uploadFileToDataset).applyAction({
        p_dataset: datasetId, p_path: file.name, p_content: content, p_branch: branchName,
      })
      const { data, error } = await supabase.from('dataset_transactions')
        .select('txn_type').eq('id', txn).single()
      if (error) throw new Error(error.message)
      return { path: file.name, type: (data as { txn_type: string }).txn_type }
    },
    onSuccess: ({ path, type }) => {
      for (const k of [keys.all, keys.transactions(datasetId), keys.schema(datasetId)]) {
        void qc.invalidateQueries({ queryKey: k })
      }
      void qc.invalidateQueries({ queryKey: ['dataset-view'] })
      toast.success(`${path} landed as a ${type} transaction`)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

// ── the dataset view (readings/dataset-preview.md) ──────────────────────────

/** The schema in force on a branch — "the nearest one down the commit chain
 *  from its head" — which is what the grid's column headers are. */
export function useBranchSchema(branchId: string | null) {
  return useQuery({
    queryKey: ['dataset-branch-schema', branchId ?? ''],
    enabled: branchId !== null,
    queryFn: async (): Promise<DatasetField[] | null> =>
      (await client(datasetBranchSchema).executeFunction({ p_branch: branchId as string })) as unknown as DatasetField[] | null,
  })
}

export interface PreviewQuery { orderBy: string | null; desc: boolean; filters: PreviewFilter[]; limit: number }
export type PreviewRow = Record<string, Json | undefined>

/** The sample: sort and filters go to the server, because "any action taken
 *  on the data, such as filtering or sorting, will apply to the full dataset". */
export function usePreview(branchId: string | null, q: PreviewQuery) {
  return useQuery({
    queryKey: ['dataset-preview', branchId ?? '', q],
    enabled: branchId !== null,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<PreviewRow[]> => {
      const rows = await client(datasetPreview).executeFunction({
        p_branch: branchId as string, p_limit: q.limit,
        ...(q.orderBy !== null ? { p_order_by: q.orderBy, p_desc: q.desc } : {}),
        p_filters: q.filters as unknown as Json,
      })
      return rows as unknown as PreviewRow[]
    },
  })
}

/** "the exact number of rows is displayed in the preview table header" */
export function usePreviewCount(branchId: string | null, filters: PreviewFilter[]) {
  return useQuery({
    queryKey: ['dataset-preview-count', branchId ?? '', filters],
    enabled: branchId !== null,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<number> =>
      await client(datasetPreviewCount).executeFunction({
        p_branch: branchId as string, p_filters: filters as unknown as Json,
      }),
  })
}

export interface ColumnStats {
  rows: number; normal: number; null: number; empty: number; whitespace: number; distinct: number
  values: { value: Json; count: number }[]
}

export function useColumnStats(branchId: string | null, column: string | null) {
  return useQuery({
    queryKey: ['dataset-column-stats', branchId ?? '', column ?? ''],
    enabled: branchId !== null && column !== null,
    queryFn: async (): Promise<ColumnStats> =>
      (await client(datasetColumnStats).executeFunction({
        p_branch: branchId as string, p_column: column as string,
      })) as unknown as ColumnStats,
  })
}

/** The jobs that wrote this dataset. A History row is a transaction and the
 *  job that opened it — 493 links the two through build_jobs.transaction_id. */
export interface DatasetJob {
  id: string; buildId: string; state: string; transactionId: string | null
  error: string | null; startedAt: string | null; finishedAt: string | null
}

export function useDatasetJobs(datasetId: string | null) {
  return useQuery({
    queryKey: ['dataset-jobs', datasetId ?? ''],
    enabled: datasetId !== null,
    queryFn: async (): Promise<DatasetJob[]> => {
      const { data, error } = await supabase.from('build_jobs')
        .select('id, build_id, state, transaction_id, error, started_at, finished_at')
        .eq('output_dataset_id', datasetId ?? '')
        .order('started_at', { ascending: false, nullsFirst: false }).limit(200)
      if (error) throw new Error(error.message)
      return (data as {
        id: string; build_id: string; state: string; transaction_id: string | null
        error: string | null; started_at: string | null; finished_at: string | null
      }[]).map((r) => ({
        id: r.id, buildId: r.build_id, state: r.state, transactionId: r.transaction_id,
        error: r.error, startedAt: r.started_at, finishedAt: r.finished_at,
      }))
    },
    staleTime: 10_000,
  })
}

/** The object types this dataset backs — the chip the About panel shows under
 *  the description (`[Foundry][OFT_1] Airline` in dataset.png). */
export interface BackingObjectType { id: string; apiName: string; displayName: string; branchId: string }

export function useBackingObjectTypes(datasetId: string | null) {
  return useQuery({
    queryKey: ['dataset-backing', datasetId ?? ''],
    enabled: datasetId !== null,
    queryFn: async (): Promise<BackingObjectType[]> => {
      const { data, error } = await supabase.from('object_type_datasources')
        .select('branch_id, object_types(id, api_name, display_name)')
        .eq('dataset_id', datasetId ?? '')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        branch_id: string; object_types: { id: string; api_name: string; display_name: string } | null
      }[]).flatMap((r) => r.object_types === null ? [] : [{
        id: r.object_types.id, apiName: r.object_types.api_name,
        displayName: r.object_types.display_name, branchId: r.branch_id,
      }])
    },
  })
}

// Fusion — spreadsheets, sheets, cells, table regions and the sync (694).
//
// A cell stores what was typed; a formula is kept and rendered, never
// computed — the function library holds 202 functions and none is built.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  createSpreadsheet, syncTableRegion, sortTableRegion, fusionCellTypes,
} from '@beacon/platform'

export interface Spreadsheet {
  id: string
  rid: string
  projectId: string
  name: string
}

export interface Sheet {
  id: string
  name: string
  position: number
}

export interface Cell {
  id: string
  sheetId: string
  row: number
  col: number
  raw: string
  cellType: string
}

export interface TableRegion {
  id: string
  sheetId: string
  name: string
  topRow: number
  leftCol: number
  rowCount: number
  columns: { name: string; type?: string }[]
  datasetId: string | null
}

const keys = {
  books: ['fusion-spreadsheets'] as const,
  book: (id: string) => ['fusion-spreadsheet', id] as const,
}

export function useSpreadsheets() {
  return useQuery({
    queryKey: keys.books,
    staleTime: 30_000,
    queryFn: async (): Promise<Spreadsheet[]> => {
      const { data, error } = await supabase.from('fusion_spreadsheets')
        .select('id, rid, project_id, name').is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as { id: string; rid: string; project_id: string; name: string }[])
        .map((r) => ({ id: r.id, rid: r.rid, projectId: r.project_id, name: r.name }))
    },
  })
}

export interface BookContents {
  sheets: Sheet[]
  cells: Cell[]
  regions: TableRegion[]
}

export function useBookContents(bookId: string | null) {
  return useQuery({
    queryKey: keys.book(bookId ?? ''),
    enabled: bookId !== null,
    queryFn: async (): Promise<BookContents> => {
      const { data: sheets, error } = await supabase.from('fusion_sheets')
        .select('id, name, position').eq('spreadsheet_id', bookId ?? '').order('position')
      if (error) throw new Error(error.message)
      const list = sheets as Sheet[]
      if (list.length === 0) return { sheets: [], cells: [], regions: [] }
      const ids = list.map((s) => s.id)
      const [cs, rs] = await Promise.all([
        supabase.from('fusion_cells')
          .select('id, sheet_id, row_index, col_index, raw, cell_type').in('sheet_id', ids),
        supabase.from('fusion_table_regions')
          .select('id, sheet_id, name, top_row, left_col, row_count, columns, dataset_id')
          .in('sheet_id', ids),
      ])
      if (cs.error) throw new Error(cs.error.message)
      if (rs.error) throw new Error(rs.error.message)
      return {
        sheets: list,
        cells: (cs.data as {
          id: string; sheet_id: string; row_index: number; col_index: number
          raw: string; cell_type: string
        }[]).map((r) => ({
          id: r.id, sheetId: r.sheet_id, row: r.row_index, col: r.col_index,
          raw: r.raw, cellType: r.cell_type,
        })),
        regions: (rs.data as {
          id: string; sheet_id: string; name: string; top_row: number; left_col: number
          row_count: number; columns: { name: string; type?: string }[]; dataset_id: string | null
        }[]).map((r) => ({
          id: r.id, sheetId: r.sheet_id, name: r.name, topRow: r.top_row,
          leftCol: r.left_col, rowCount: r.row_count, columns: r.columns,
          datasetId: r.dataset_id,
        })),
      }
    },
  })
}

export function useCellTypes() {
  return useQuery({
    queryKey: ['fusion-cell-types'],
    staleTime: Infinity,
    queryFn: () => client(fusionCellTypes).executeFunction({}),
  })
}

export function useCreateSpreadsheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string }) =>
      client(createSpreadsheet).applyAction({ p_project: i.projectId, p_name: i.name }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.books }); toast.success('Spreadsheet created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

function useBookMutation<T>(bookId: string, fn: (i: T) => Promise<void>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.book(bookId) })
      if (done !== undefined) toast.success(done)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** A cell's type is inferred from what was typed, the way the page shows it:
 *  a bare number is a number, an ISO date a date, =true a boolean. Anything
 *  else — including a formula — is stored as a string, uncomputed. */
export function inferCellType(raw: string): string {
  const v = raw.trim()
  if (v === '') return 'string'
  if (/^-?\d+(\.\d+)?$/.test(v)) return 'number'
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date'
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) return 'timestamp'
  if (v === '=true' || v === '=false') return 'boolean'
  if (v === '=null') return 'null'
  if (v.startsWith('=array(')) return 'array'
  return 'string'
}

export function useSetCell(bookId: string) {
  return useBookMutation<{ sheetId: string; row: number; col: number; raw: string }>(
    bookId, async (i) => {
      const { error } = await supabase.from('fusion_cells').upsert({
        sheet_id: i.sheetId, row_index: i.row, col_index: i.col,
        raw: i.raw, cell_type: inferCellType(i.raw),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sheet_id,row_index,col_index' })
      if (error) throw new Error(error.message)
    })
}

export function useAddSheet(bookId: string) {
  return useBookMutation<{ name: string; position: number }>(bookId, async (i) => {
    const { error } = await supabase.from('fusion_sheets')
      .insert({ spreadsheet_id: bookId, name: i.name, position: i.position })
    if (error) throw new Error(error.message)
  }, 'Sheet added')
}

export function useCreateRegion(bookId: string) {
  return useBookMutation<{
    sheetId: string; name: string; topRow: number; leftCol: number
    rowCount: number; columns: { name: string; type: string }[]
  }>(bookId, async (i) => {
    const { error } = await supabase.from('fusion_table_regions').insert({
      sheet_id: i.sheetId, name: i.name, top_row: i.topRow, left_col: i.leftCol,
      row_count: i.rowCount, columns: i.columns,
    })
    if (error) throw new Error(error.message)
  }, 'Table region created')
}

export function useSetRegionDataset(bookId: string) {
  return useBookMutation<{ id: string; datasetId: string | null }>(bookId, async (i) => {
    const { error } = await supabase.from('fusion_table_regions')
      .update({ dataset_id: i.datasetId }).eq('id', i.id)
    if (error) throw new Error(error.message)
  }, 'Sync target set')
}

/** A sort REARRANGES the cells — it cannot be turned off, so the surface
 *  says so before running one. */
export function useSortRegion(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { regionId: string; column: number; descending: boolean }) =>
      client(sortTableRegion).applyAction({
        p_region: i.regionId, p_column: i.column, p_descending: i.descending }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.book(bookId) })
      toast.success('Rows rearranged — a sort in Fusion cannot be undone by re-sorting')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSyncRegion(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (regionId: string) =>
      client(syncTableRegion).applyAction({ p_region: regionId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.book(bookId) })
      toast.success('Synced — the dataset has a new committed transaction')
    },
    // Fusion:NotAnEditor, :RegionNotSynced, :NoColumns
    onError: (e: Error) => { toast.error(e.message) },
  })
}

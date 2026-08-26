// Quiver — analyses, canvases, and the typed card graph (696).
//
// The catalogue is the load-bearing read: a card's kind names its signature,
// and the "next actions" rule is a filter over it — "It only shows cards that
// are able to take your current card's output type as input"
// (quiver/analysis-data-model).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  createQuiverAnalysis, saveQuiverAnalysis, deleteQuiverCard,
  quiverCardKinds, quiverDataTypes, unusedQuiverCards,
} from '@beacon/platform'

export interface Analysis {
  id: string
  rid: string
  projectId: string
  name: string
  analysisType: string
}

export interface Canvas {
  id: string
  name: string
  position: number
}

export interface QCard {
  id: string
  globalId: string
  kind: string
  title: string
  outputType: string | null
}

export interface CardInput {
  id: string
  cardId: string
  slot: number
  inputCardId: string
}

export interface Placement {
  id: string
  canvasId: string
  cardId: string
  x: number
  y: number
  width: number
  height: number
}

export interface CardKind {
  kind: string
  title: string
  input_types: string[]
  output_types: string[]
  built: boolean
  note: string | null
}

const keys = {
  list: ['quiver-analyses'] as const,
  one: (id: string) => ['quiver-analysis', id] as const,
  unused: (id: string) => ['quiver-unused', id] as const,
}

export function useAnalyses() {
  return useQuery({
    queryKey: keys.list,
    staleTime: 30_000,
    queryFn: async (): Promise<Analysis[]> => {
      const { data, error } = await supabase.from('quiver_analyses')
        .select('id, rid, project_id, name, analysis_type').is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; rid: string; project_id: string; name: string; analysis_type: string
      }[]).map((r) => ({
        id: r.id, rid: r.rid, projectId: r.project_id, name: r.name, analysisType: r.analysis_type,
      }))
    },
  })
}

/** The catalogue: every card Quiver documents, with the signature its own
 *  page declares. Immutable, so it is fetched once. */
export function useCardKinds() {
  return useQuery({
    queryKey: ['quiver-card-kinds'],
    staleTime: Infinity,
    queryFn: () => client(quiverCardKinds).executeFunction({}) as Promise<CardKind[]>,
  })
}

export function useDataTypes() {
  return useQuery({
    queryKey: ['quiver-data-types'],
    staleTime: Infinity,
    queryFn: () => client(quiverDataTypes).executeFunction({}),
  })
}

export interface AnalysisContents {
  canvases: Canvas[]
  cards: QCard[]
  inputs: CardInput[]
  placements: Placement[]
}

export function useAnalysisContents(id: string | null) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<AnalysisContents> => {
      const [cv, cd] = await Promise.all([
        supabase.from('quiver_canvases').select('id, name, position')
          .eq('analysis_id', id ?? '').order('position'),
        supabase.from('quiver_cards').select('id, global_id, kind, title, output_type')
          .eq('analysis_id', id ?? '').order('created_at'),
      ])
      if (cv.error) throw new Error(cv.error.message)
      if (cd.error) throw new Error(cd.error.message)
      const canvases = cv.data as Canvas[]
      const cards = (cd.data as {
        id: string; global_id: string; kind: string; title: string; output_type: string | null
      }[]).map((r) => ({
        id: r.id, globalId: r.global_id, kind: r.kind, title: r.title, outputType: r.output_type,
      }))
      if (cards.length === 0) return { canvases, cards, inputs: [], placements: [] }
      const [ins, pl] = await Promise.all([
        supabase.from('quiver_card_inputs').select('id, card_id, slot, input_card_id')
          .in('card_id', cards.map((c) => c.id)),
        supabase.from('quiver_canvas_cards')
          .select('id, canvas_id, card_id, x, y, width, height')
          .in('canvas_id', canvases.map((c) => c.id)),
      ])
      if (ins.error) throw new Error(ins.error.message)
      if (pl.error) throw new Error(pl.error.message)
      return {
        canvases,
        cards,
        inputs: (ins.data as {
          id: string; card_id: string; slot: number; input_card_id: string
        }[]).map((r) => ({
          id: r.id, cardId: r.card_id, slot: r.slot, inputCardId: r.input_card_id,
        })),
        placements: (pl.data as {
          id: string; canvas_id: string; card_id: string
          x: number; y: number; width: number; height: number
        }[]).map((r) => ({
          id: r.id, canvasId: r.canvas_id, cardId: r.card_id,
          x: r.x, y: r.y, width: r.width, height: r.height,
        })),
      }
    },
  })
}

/** The page's three-part definition, asked of the database rather than
 *  recomputed here — it is the same function the delete dialog needs. */
export function useUnusedCards(id: string | null) {
  return useQuery({
    queryKey: keys.unused(id ?? ''),
    enabled: id !== null,
    queryFn: () => client(unusedQuiverCards).executeFunction({ p_analysis: id ?? '' }),
  })
}

export function useCreateAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string; analysisType: string }) =>
      client(createQuiverAnalysis).applyAction({
        p_project: i.projectId, p_name: i.name, p_type: i.analysisType }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.list }); toast.success('Analysis created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

function useAnalysisMutation<T>(id: string, fn: (i: T) => Promise<void>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.one(id) })
      void qc.invalidateQueries({ queryKey: keys.unused(id) })
      if (done !== undefined) toast.success(done)
    },
    // Quiver:TypeMismatch, :CardNotBuilt, :Cycle, :TakesNoInputs, :OutputTypeAmbiguous
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useAddCard(id: string) {
  return useAnalysisMutation<{
    kind: string; title: string; outputType: string | null
    inputCardId?: string; canvasId?: string
  }>(id, async (i) => {
    const { data, error } = await supabase.from('quiver_cards')
      .insert({ analysis_id: id, kind: i.kind, title: i.title, output_type: i.outputType })
      .select('id').single()
    if (error) throw new Error(error.message)
    const cardId = (data as { id: string }).id
    // the next actions menu configures the input it was opened from
    if (i.inputCardId !== undefined) {
      const { error: e2 } = await supabase.from('quiver_card_inputs')
        .insert({ card_id: cardId, input_card_id: i.inputCardId })
      if (e2 !== null) throw new Error(e2.message)
    }
    if (i.canvasId !== undefined) {
      const { error: e3 } = await supabase.from('quiver_canvas_cards')
        .insert({ canvas_id: i.canvasId, card_id: cardId })
      if (e3 !== null) throw new Error(e3.message)
    }
  })
}

export function useConnectCards(id: string) {
  return useAnalysisMutation<{ cardId: string; inputCardId: string; slot: number }>(
    id, async (i) => {
      const { error } = await supabase.from('quiver_card_inputs')
        .upsert({ card_id: i.cardId, input_card_id: i.inputCardId, slot: i.slot },
          { onConflict: 'card_id,slot' })
      if (error) throw new Error(error.message)
    }, 'Input connected')
}

export function useAddCanvas(id: string) {
  return useAnalysisMutation<{ name: string; position: number }>(id, async (i) => {
    const { error } = await supabase.from('quiver_canvases')
      .insert({ analysis_id: id, name: i.name, position: i.position })
    if (error) throw new Error(error.message)
  }, 'Canvas created')
}

export function usePlaceCard(id: string) {
  return useAnalysisMutation<{ canvasId: string; cardId: string }>(id, async (i) => {
    const { error } = await supabase.from('quiver_canvas_cards')
      .insert({ canvas_id: i.canvasId, card_id: i.cardId })
    if (error) throw new Error(error.message)
  }, 'Added to canvas')
}

/** Deletion takes a mode, because the page gives two. */
export function useDeleteCard(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { cardId: string; mode: 'delete' | 'remove_from_canvas' }) =>
      client(deleteQuiverCard).applyAction({ p_card: i.cardId, p_mode: i.mode }),
    onSuccess: (emptied, i) => {
      void qc.invalidateQueries({ queryKey: keys.one(id) })
      void qc.invalidateQueries({ queryKey: keys.unused(id) })
      toast.success(i.mode === 'delete'
        ? `Deleted — ${String(emptied)} downstream input(s) emptied`
        : 'Removed from canvas — the card is still in the analysis')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSaveAnalysis(id: string) {
  return useMutation({
    mutationFn: () => client(saveQuiverAnalysis).applyAction({ p_analysis: id }),
    onSuccess: () => { toast.success('Analysis saved') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** A card's one output type: what it declares, or its kind's only one. */
export function outputTypeOf(card: QCard, kinds: CardKind[]): string | null {
  if (card.outputType !== null) return card.outputType
  const k = kinds.find((x) => x.kind === card.kind)
  return k !== undefined && k.output_types.length === 1 ? k.output_types[0] : null
}

/** The next actions menu: "It only shows cards that are able to take your
 *  current card's output type as input". Unbuilt kinds stay in the list —
 *  they refuse by name rather than being hidden. */
export function kindsAccepting(type: string | null, kinds: CardKind[]): CardKind[] {
  if (type === null) return kinds.filter((k) => k.input_types.includes('Flow start'))
  return kinds.filter((k) => k.input_types.includes(type))
}

// Layer: Flow — derives live stocktake progress from the active draft session
import { useActiveDraftSession, useSessionLines } from '@/features/inventory/hooks/stocktake'

/**
 * Returns progress for the active draft stocktake session, if any.
 * Used to drive the badge on the Stocktake nav link.
 */
export function useStocktakeProgress(): { active: boolean; counted: number; total: number } {
  const { data: session } = useActiveDraftSession()
  const { data: lines = [] } = useSessionLines(session?.id)

  if (!session) return { active: false, counted: 0, total: 0 }

  return {
    active: true,
    counted: lines.filter((l) => l.counted_qty !== null).length,
    total: lines.length,
  }
}

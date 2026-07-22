import { useQuery } from '@tanstack/react-query'
import type { LifecycleNode } from '@beacon/reality-graph'
import { fetchMinedProcess, type MinedProcess } from './api'

const EMPTY: MinedProcess = { states: [], transitions: [] }

export const processMiningKeys = {
  mine: (nodeType: string, hotelId: string | null) => ['process-mining', nodeType, hotelId] as const,
}

export function useMinedProcess(nodeType: LifecycleNode, hotelId: string | null) {
  return useQuery({
    queryKey: processMiningKeys.mine(nodeType, hotelId),
    queryFn:  () => (hotelId ? fetchMinedProcess(nodeType, hotelId) : Promise.resolve(EMPTY)),
    enabled:  !!hotelId,
  })
}

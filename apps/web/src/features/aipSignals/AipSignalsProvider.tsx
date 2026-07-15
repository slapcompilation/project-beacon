// P2 of the AIP-native OPERATE arc: a page-level provider so any row, at any
// nesting depth, can show its agent signal without the list threading a
// signalMap through every intermediate component. Fetch the batch once here;
// AipRowBadge reads the map from context.

import { createContext, useContext, type ReactNode } from 'react'
import { useVariantSignals, type VariantSignalMap } from './useVariantSignals'

const Ctx = createContext<VariantSignalMap | null>(null)

/** Wrap a list body; pass every variant id visible on the list. One batched
 *  round-trip (aip_signals_for_variants) backs all its rows' badges. */
export function AipSignalsProvider({ variantIds, children }: { variantIds: string[]; children: ReactNode }) {
  const map = useVariantSignals(variantIds)
  return <Ctx.Provider value={map}>{children}</Ctx.Provider>
}

/** The signal map from the nearest provider, or an empty map (badge shows
 *  nothing) when a row renders outside one. */
export function useRowSignals(): VariantSignalMap {
  return useContext(Ctx) ?? new Map<string, import('./useVariantSignals').VariantSignal>()
}

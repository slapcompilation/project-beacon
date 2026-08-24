// The client half of the checkpoint gate: a guarded mutation runs through
// runWithCheckpoint, and when the database refuses with
// Checkpoints:JustificationRequired, the pending checkpoint lands in this
// store, CheckpointHost renders the prompt, and the operation retries once
// the record exists. The loop handles the documented multiple-checkpoints
// case — each retry may surface the next applicable configuration.

import { create } from 'zustand'
import type { CheckpointItem } from './api'

const REFUSAL =
  /Checkpoints:JustificationRequired — "(.*)" awaits your justification \(configuration ([0-9a-f-]{36})\)/

export function parseCheckpointRefusal(message: string): { title: string; configId: string } | null {
  const m = REFUSAL.exec(message)
  return m === null ? null : { title: m[1], configId: m[2] }
}

interface PendingCheckpoint {
  configId: string
  items: CheckpointItem[]
  resolve: (submitted: boolean) => void
}

interface CheckpointGateState {
  pending: PendingCheckpoint | null
  ask: (configId: string, items: CheckpointItem[]) => Promise<boolean>
  settle: (submitted: boolean) => void
}

export const useCheckpointGate = create<CheckpointGateState>((set, get) => ({
  pending: null,
  ask: async (configId, items) =>
    new Promise<boolean>((resolve) => {
      set({ pending: { configId, items, resolve } })
    }),
  settle: (submitted) => {
    get().pending?.resolve(submitted)
    set({ pending: null })
  },
}))

/** Runs a guarded operation, prompting for each checkpoint it hits. `items`
 *  are what the caller knows about the interaction, attached to the record. */
export async function runWithCheckpoint<T>(
  fn: () => Promise<T>, items: CheckpointItem[] = [],
): Promise<T> {
  for (;;) {
    try {
      return await fn()
    } catch (e) {
      const refusal = parseCheckpointRefusal(e instanceof Error ? e.message : String(e))
      if (refusal === null) throw e
      const submitted = await useCheckpointGate.getState().ask(refusal.configId, items)
      if (!submitted) throw new Error('Checkpoint declined — nothing was changed')
    }
  }
}

// Actor resolution for the mutation layer.
//
// Agent runs (the cron intelligence-cycle, scenario simulation) author actions
// under a sentinel userId — it is NOT a real users row. When such an action is
// later dispatched on a human path (an operator approving an agent proposal),
// any actor field written to a users/auth.users FK must resolve to the real
// dispatching operator, never the sentinel, or the insert violates the FK.

/** The userId agent runs use when no human is in the loop. Not a real user. */
export const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000'

/** True when the id is missing or the agent sentinel — i.e. not a real user. */
export function isSystemActor(id: string | null | undefined): boolean {
  return !id || id === SYSTEM_ACTOR
}

/**
 * The real actor for a dispatch: the dispatching operator first, then the
 * action's embedded actor, skipping the sentinel. Returns null when neither is
 * a real user (the caller decides whether that's allowed for the action).
 */
export function resolveActor(
  ctxActor: string | null | undefined,
  embedded?: string | null,
): string | null {
  for (const id of [ctxActor, embedded]) {
    if (!isSystemActor(id)) return id as string
  }
  return null
}

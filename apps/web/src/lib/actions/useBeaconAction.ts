// Layer: meta — used by every mutation surface in apps/web
//
// useBeaconAction(type) — punch-list item #2 from the osdk-ts audit.
//
// Replaces the ~12-line boilerplate of:
//
//     useMutation({
//       mutationFn: async (input) => {
//         const result = await dispatchAction(buildAction(input), ctx, extras)
//         if (!result.success) throw new Error(result.error.message)
//         return result.data
//       },
//       onSuccess: () => {
//         queryClient.invalidateQueries(...)
//         toast.success('...')
//       },
//       onError: (err) => toast.error(err.message),
//     })
//
// …with a single declarative call:
//
//     useBeaconAction<{ id: string }>({
//       type: 'APPROVE_RESTOCK',
//       build: ({ id }) => ({ type: 'APPROVE_RESTOCK', requestId: id, hotelId }),
//       invalidate: () => [restockKeys.all(hotelId ?? '')],
//       successMessage: () => 'Request approved',
//     })
//
// And exposes:
//   • `dispatch(input)`        — fire the action; returns the data or null (if preflight skipped)
//   • `validate(input)`        — pure pre-submit validation; updates `validationResult`
//   • `error: BeaconError`     — last failure as a tagged variant; UIs can switch on `.code`
//                                (retry vs. validation banner vs. force-relogin)
//   • `skipped: { reason }`    — last preflight short-circuit (e.g. duplicate request)
//   • standard `isPending` / `isValidating` / `reset()` for forms
//
// Why a thin wrapper over useMutation
// ───────────────────────────────────
// We keep TanStack Query as the underlying engine (cache invalidation, request
// dedup, retry semantics) but standardise the contract: every Beacon mutation
// has the same shape, the same error type, the same toast behaviour, and the
// same preflight escape hatch. Migration is mechanical: ~50% LOC reduction at
// each call site, zero behaviour change, plus typed-error access for free.

import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { dispatchAction, type DispatchContext, type DispatchExtras } from './dispatch'
import {
  validateAction,
  type BeaconAction,
  type BeaconError,
  type ValidationResult,
  type MutationResult,
} from '@beacon/reality-graph'

// ─── Public API ──────────────────────────────────────────────────────────────

export type PreflightDecision =
  | { skip: true; reason: string }
  | { skip: false }

export interface UseBeaconActionOptions<TInput, TResult extends MutationResult> {
  /** Documents the action; must match the BeaconAction['type'] built by `build`.
   *  Used for telemetry tagging in future revisions of this hook. */
  type: BeaconAction['type']

  /** Construct the typed action from caller input. */
  build: (input: TInput) => BeaconAction

  /** Override the default DispatchContext.
   *  Default: `{ hotelId: useActiveHotelId(), actorId: auth.userId, triggeredBy: 'user' }`. */
  context?: (input: TInput) => DispatchContext

  /** Browser-only extras (e.g. `photoFile` for ADJUST_STOCK). */
  extras?: (input: TInput) => DispatchExtras | undefined

  /** Query keys to invalidate on success. Each tuple is passed to
   *  `queryClient.invalidateQueries({ queryKey })`. */
  invalidate?: (input: TInput, data: TResult) => readonly (readonly unknown[])[]

  /** Success toast text. Return `null` (or omit) to suppress. */
  successMessage?: (input: TInput, data: TResult) => string | null

  /** Error toast suppression. When `true`, errors are stored in `.error` and
   *  the caller is responsible for surfacing them (useful for inline form errors). */
  silent?: boolean

  /** Run synchronously (or async) before the action fires. Return `{ skip: true, reason }`
   *  to short-circuit — the dispatch resolves with `null` and `.skipped` is set.
   *  Use for "already in queue" / "duplicate within window" preflight checks. */
  preflight?: (input: TInput) => PreflightDecision | Promise<PreflightDecision>
}

/** Per-call options accepted by `mutate` / `mutateAsync` / `dispatch`.
 *  Callbacks receive the unwrapped result (`TResult | null`) and the input. */
export interface DispatchCallOptions<TInput, TResult> {
  onSuccess?: (data: TResult | null, input: TInput) => void
  onError?:   (err: Error, input: TInput) => void
}

export interface UseBeaconActionReturn<TInput, TResult> {
  /** Canonical name. Resolves with the mutation result, or `null` if the
   *  preflight short-circuited. Branch on `.error.code` for typed failure
   *  handling; the UI toast is automatic unless `silent: true`. */
  dispatch:         (input: TInput, options?: DispatchCallOptions<TInput, TResult>) => Promise<TResult | null>

  /** TanStack-Query-compatible alias. Fire-and-forget. Per-call `onSuccess`
   *  callback receives the unwrapped result (no `{ data, skip }` wrapper). */
  mutate:           (input: TInput, options?: DispatchCallOptions<TInput, TResult>) => void

  /** TanStack-Query-compatible alias. Same shape as `dispatch`. */
  mutateAsync:      (input: TInput, options?: DispatchCallOptions<TInput, TResult>) => Promise<TResult | null>

  /** Pure pre-submit validation. Updates `.validationResult` for forms that
   *  want inline constraint errors before the user clicks submit. */
  validate:         (input: TInput) => ValidationResult

  /** True while the mutation is in flight. */
  isPending:        boolean

  /** Reserved for future async validators. Currently always `false`. */
  isValidating:     boolean

  /** Last `validate()` result. `null` until validate is called. */
  validationResult: ValidationResult | null

  /** Last action failure as a tagged BeaconError. `null` on success or before
   *  any dispatch. Switch on `.code` for retry / banner / relogin behaviour. */
  error:            BeaconError | null

  /** Last preflight short-circuit, if any. `null` when the dispatch fired. */
  skipped:          { reason: string } | null

  /** Clear `error`, `validationResult`, and `skipped`. Does not cancel an
   *  in-flight mutation. */
  reset:            () => void
}

// ─── Implementation ──────────────────────────────────────────────────────────

export function useBeaconAction<
  TInput = void,
  TResult extends MutationResult = MutationResult,
>(
  opts: UseBeaconActionOptions<TInput, TResult>,
): UseBeaconActionReturn<TInput, TResult> {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  const userId      = useAuthStore((s) => s.userId)

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [error,            setError]            = useState<BeaconError | null>(null)
  const [skipped,          setSkipped]          = useState<{ reason: string } | null>(null)

  const validate = useCallback((input: TInput): ValidationResult => {
    const action = opts.build(input)
    const result = validateAction(action)
    setValidationResult(result)
    return result
  }, [opts])

  const reset = useCallback(() => {
    setValidationResult(null)
    setError(null)
    setSkipped(null)
  }, [])

  const mutation = useMutation({
    mutationFn: async (input: TInput): Promise<{ data: TResult | null; skip: { reason: string } | null }> => {
      // Reset transient state at the start of each dispatch
      setError(null)
      setSkipped(null)

      // Preflight short-circuit — never throws; resolves with skip metadata
      if (opts.preflight) {
        const decision = await opts.preflight(input)
        if (decision.skip) {
          setSkipped({ reason: decision.reason })
          return { data: null, skip: { reason: decision.reason } }
        }
      }

      const action = opts.build(input)

      const ctx = opts.context?.(input) ?? {
        hotelId:     hotelId ?? '',
        actorId:     userId ?? null,
        triggeredBy: 'user' as const,
      }

      const result = await dispatchAction<TResult>(action, ctx, opts.extras?.(input))

      if (!result.success) {
        setError(result.error)
        // Throw so TanStack Query enters the `error` state and `mutateAsync`
        // rejects — call sites that `await` get the natural rejection. The
        // BeaconError is captured separately in our hook's `.error` so the
        // caller can branch on `.code` without unwrapping the thrown Error.
        throw new BeaconActionError(result.error)
      }

      return { data: result.data, skip: null }
    },
    onSuccess: ({ data, skip }, input) => {
      if (skip) return
      if (data == null) return  // defensive — skip path already returned

      if (opts.invalidate) {
        const keys = opts.invalidate(input, data)
        for (const queryKey of keys) {
          void queryClient.invalidateQueries({ queryKey: queryKey })
        }
      }
      if (opts.successMessage) {
        const msg = opts.successMessage(input, data)
        if (msg) toast.success(msg)
      }
    },
    onError: (err: unknown) => {
      if (opts.silent) return
      const message = err instanceof Error ? err.message : 'Action failed'
      toast.error(message)
    },
  })

  // Wrap user-supplied per-call callbacks so they receive the unwrapped
  // `TResult | null` instead of our internal `{ data, skip }` envelope.
  const wrapOptions = useCallback(
    (options?: DispatchCallOptions<TInput, TResult>) => ({
      onSuccess: options?.onSuccess
        ? (wrapper: { data: TResult | null; skip: { reason: string } | null }, vars: TInput) => {
            options.onSuccess?.(wrapper.data, vars)
          }
        : undefined,
      onError: options?.onError
        ? (err: unknown, vars: TInput) => {
            const e = err instanceof Error ? err : new Error(String(err))
            options.onError?.(e, vars)
          }
        : undefined,
    }),
    [],
  )

  const dispatch = useCallback(
    async (input: TInput, options?: DispatchCallOptions<TInput, TResult>): Promise<TResult | null> => {
      const { data } = await mutation.mutateAsync(input, wrapOptions(options))
      return data
    },
    [mutation, wrapOptions],
  )

  const mutate = useCallback(
    (input: TInput, options?: DispatchCallOptions<TInput, TResult>): void => {
      mutation.mutate(input, wrapOptions(options))
    },
    [mutation, wrapOptions],
  )

  return {
    dispatch,
    mutate,
    mutateAsync:      dispatch,
    validate,
    isPending:        mutation.isPending,
    isValidating:     false,
    validationResult,
    error,
    skipped,
    reset,
  }
}

// ─── Internal: typed error wrapper for TanStack Query ────────────────────────

/** Error subclass thrown from inside `mutationFn` so TanStack Query enters
 *  the error state cleanly while still carrying the original BeaconError. */
class BeaconActionError extends Error {
  readonly beaconError: BeaconError
  constructor(beaconError: BeaconError) {
    super(beaconError.message)
    this.name         = 'BeaconActionError'
    this.beaconError  = beaconError
  }
}

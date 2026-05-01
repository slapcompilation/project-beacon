// Reality Graph — Result<T, E> primitive
// Layer: meta — used everywhere a function can fail in a way the caller might
// want to handle differently (validation vs. timeout vs. scope-denied vs. ...).
//
// Why this exists
// ───────────────
// Throwing raw `new Error(message)` collapses every failure mode to a string —
// the caller can't decide "retry vs. show validation banner vs. log out".
// `Result<T, E>` is the standard tagged-union solution and aligns Beacon with
// Palantir's `osdk-ts` API design (per audit punch-list item #1).
//
// Convention: `ok` is true on success, false on failure. Use `isOk` / `isErr`
// guards, NEVER inspect the discriminant directly — that's what the helpers
// are for. Helpers are tree-shakeable and zero-runtime in production.

export type Ok<T> = {
  readonly ok: true
  readonly value: T
}

export type Err<E> = {
  readonly ok: false
  readonly error: E
}

export type Result<T, E> = Ok<T> | Err<E>

// ─── Constructors ────────────────────────────────────────────────────────────

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

// ─── Type guards ─────────────────────────────────────────────────────────────

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok === true
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return r.ok === false
}

// ─── Combinators ─────────────────────────────────────────────────────────────

/** Apply `f` to the success value; pass errors through unchanged. */
export function mapResult<T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r
}

/** Extract the value or fall back to a default — for places where the failure
 *  mode is genuinely irrelevant (e.g. computed properties on missing edges). */
export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback
}

/** Async chaining — flat-map a Result-returning async function across success. */
export async function andThen<T, U, E>(
  r: Result<T, E>,
  f: (v: T) => Promise<Result<U, E>>,
): Promise<Result<U, E>> {
  return r.ok ? f(r.value) : Promise.resolve(r)
}

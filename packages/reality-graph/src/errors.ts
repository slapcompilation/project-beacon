// Reality Graph — BeaconError tagged union
// Layer: meta
//
// Every recoverable failure in a Beacon mutation or read path classifies into
// one of these variants. The variant is the *machine-readable* discriminator
// (`code`); the human-readable narrative lives in `message`. Additional
// per-variant fields capture the structured context CLAUDE.md requires
// ("every failure mode must carry derived context").
//
// Per audit punch-list item #1: aligns Beacon with Palantir osdk-ts'
// per-action `ErrorVisitor` of named error variants (`ObjectTypeNotFound`,
// `PropertyApiNameNotFound`, etc.) — but scaled to our domain.

import type { Result } from './result'

// ─── Variant fields ──────────────────────────────────────────────────────────

export interface ValidationError {
  /** The action param or field name that failed. Empty string for whole-action failures. */
  field: string
  message: string
}

// ─── The error union ─────────────────────────────────────────────────────────

export type BeaconError =
  /** Submission criteria failed before the mutation reached the server. */
  | {
      readonly code: 'VALIDATION_FAILED'
      readonly message: string
      readonly errors: readonly ValidationError[]
    }

  /** Target object does not exist or is not visible to the caller. */
  | {
      readonly code: 'NOT_FOUND'
      readonly message: string
      readonly entity?: string  // e.g. 'variant', 'restock_request'
      readonly id?: string
    }

  /** Caller's role / hotel / org scope does not permit this operation.
   *  Maps to Postgres 42501 "permission denied" and Supabase RLS rejections. */
  | {
      readonly code: 'SCOPE_DENIED'
      readonly message: string
      readonly reason?: string
    }

  /** Insert/update violated a unique constraint — usually the operator
   *  re-submitted, or a parallel session beat us to it. Postgres 23505. */
  | {
      readonly code: 'DUPLICATE_REQUEST'
      readonly message: string
      readonly conflictField?: string
    }

  /** Foreign-key, check, or NOT NULL constraint failed (Postgres 23xxx
   *  excluding 23505). The mutation is structurally invalid against the
   *  current schema. */
  | {
      readonly code: 'CONSTRAINT_VIOLATION'
      readonly message: string
      readonly constraint?: string
    }

  /** Underlying RPC / network call timed out or was canceled. Postgres 57014. */
  | {
      readonly code: 'RPC_TIMEOUT'
      readonly message: string
    }

  /** Server returned a generic failure we couldn't classify into a richer
   *  variant. The caller should treat as transient and retryable. */
  | {
      readonly code: 'RPC_FAILED'
      readonly message: string
      readonly cause?: string
    }

  /** True last resort — error shape didn't match anything we recognize.
   *  These should be telemetry-watched: any UNKNOWN means we're missing a
   *  variant for a real failure mode. */
  | {
      readonly code: 'UNKNOWN'
      readonly message: string
      readonly cause?: string
    }

// ─── Constructors ────────────────────────────────────────────────────────────

export function validationFailed(errors: readonly ValidationError[]): BeaconError {
  const summary = errors.length === 1
    ? errors[0].message
    : errors.map((e) => e.message).join('; ')
  return { code: 'VALIDATION_FAILED', message: summary, errors }
}

export function notFound(entity: string, id?: string): BeaconError {
  return {
    code: 'NOT_FOUND',
    message: id ? `${entity} not found: ${id}` : `${entity} not found`,
    entity,
    id,
  }
}

export function scopeDenied(reason?: string): BeaconError {
  return {
    code: 'SCOPE_DENIED',
    message: reason ?? 'permission denied: action not allowed in current scope',
    reason,
  }
}

export function rpcFailed(message: string, cause?: string): BeaconError {
  return { code: 'RPC_FAILED', message, cause }
}

export function unknownError(message: string, cause?: string): BeaconError {
  return { code: 'UNKNOWN', message, cause }
}

// ─── Postgres / Supabase classification ──────────────────────────────────────

interface SupabaseLikeError {
  message?: string
  code?: string         // Postgres SQLSTATE
  details?: string
  hint?: string
}

/** Best-effort classification of a Supabase / Postgres-shaped error into a
 *  `BeaconError` variant. Falls back to `RPC_FAILED` when the shape matches
 *  a network/rpc failure, `UNKNOWN` when nothing matches.
 *
 *  Postgres SQLSTATE reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 *  PostgREST (Supabase) augments with PGRST116 for "no rows returned". */
export function mapPostgrestError(raw: unknown): BeaconError {
  if (raw == null) return unknownError('null/undefined error')

  // Plain Error
  if (raw instanceof Error) {
    return classifyByMessage(raw.message)
  }

  // Supabase-like { message, code, details, hint }
  if (typeof raw === 'object') {
    const e = raw as SupabaseLikeError
    const code = e.code ?? ''
    const message = e.message ?? 'Unknown error'

    // PostgREST: PGRST116 = "no rows" (with .single()); PGRST301 = JWT expired
    if (code === 'PGRST116') return notFound('row')
    if (code === 'PGRST301') return scopeDenied('JWT expired or invalid')

    // Postgres SQLSTATE
    if (code === '42501')                 return scopeDenied(message)
    if (code === '23505')                 return { code: 'DUPLICATE_REQUEST', message, conflictField: e.details }
    if (code.startsWith('23'))            return { code: 'CONSTRAINT_VIOLATION', message, constraint: e.details }
    if (code === '57014' || code === '08006') return { code: 'RPC_TIMEOUT', message }

    // Recognized message patterns even when code missing
    return classifyByMessage(message)
  }

  return unknownError(String(raw))
}

/** Pattern-based fallback when no SQLSTATE is present (network errors, etc). */
function classifyByMessage(message: string): BeaconError {
  const m = message.toLowerCase()
  if (m.includes('permission denied') || m.includes('row-level security'))
    return scopeDenied(message)
  if (m.includes('not found') || m.includes('no rows'))
    return notFound('row')
  if (m.includes('duplicate key') || m.includes('already exists'))
    return { code: 'DUPLICATE_REQUEST', message }
  if (m.includes('timeout') || m.includes('timed out'))
    return { code: 'RPC_TIMEOUT', message }
  if (m.includes('fetch failed') || m.includes('network'))
    return rpcFailed(message)
  return unknownError(message)
}

// ─── Convenience type aliases ────────────────────────────────────────────────

/** Standard Beacon Result type — every fallible function in the action / api
 *  layer should return this. */
export type BeaconResult<T> = Result<T, BeaconError>

// The reads the host performs on the guest's behalf.
//
// "the permissions of the end user running the function determine which
// objects are loaded" (functions/permissions) — so every call here goes
// through the caller's own client, and RLS decides what comes back. The guest
// never holds a credential.
//
// Only object types the published version declared as imports are answerable:
// the page generates "code bindings for every object and link type that was
// loaded" from the repository's imports, and this is the enforcement of that.
//
// Four operations: count, page and fetchOne are handed an object type. objectSet
// is handed a RID instead — an object-set ACTION PARAMETER carries one, and the
// api encodes its value as a string or the set definition — so that one asks the
// database what the set is over before applying the same gate.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Mediator } from './isolate.ts'

/** The v2 filter shape — `{ prop: value }` or `{ prop: { $gt: n } }` — onto
 *  the documented exploration grammar (generate-urls.md). */
function toFilters(where: Record<string, unknown>): unknown[] {
  const filters: unknown[] = []
  for (const [property, raw] of Object.entries(where)) {
    if (raw !== null && typeof raw === 'object') {
      const ops = raw as Record<string, unknown>
      const range: Record<string, unknown> = {}
      if ('$gt' in ops || '$gte' in ops) range.min = ops.$gt ?? ops.$gte
      if ('$lt' in ops || '$lte' in ops) range.max = ops.$lt ?? ops.$lte
      if ('$eq' in ops) {
        filters.push({ type: 'propertyFilter', propertyType: property,
          value: { type: 'valuesFilter', values: [String(ops.$eq)] } })
      } else {
        filters.push({ type: 'propertyFilter', propertyType: property,
          value: { type: 'numberRangeFilter', ...range } })
      }
    } else {
      filters.push({ type: 'propertyFilter', propertyType: property,
        value: { type: 'valuesFilter', values: [String(raw)] } })
    }
  }
  return filters
}

export function ontologyReader(
  caller: SupabaseClient,
  ontologyId: string,
  declared: Set<string>,
): Mediator {
  return async (op, payload) => {
    // An object set is named by a RID, and a RID does not say what it is over —
    // so the declared-imports gate has to ask before it can decide. Every other
    // read here is handed its type outright.
    if (op === 'objectSet') {
      const rid = String(payload.objectSetRid ?? '')
      const named = await caller.rpc('object_set_subject_api_name', { p_rid: rid })
      if (named.error) return { ok: false, error: named.error.message }
      const subject = String(named.data ?? '')
      if (!declared.has(subject)) {
        return { ok: false, error: `Functions:UndeclaredImport — ${subject} is not imported by this function` }
      }
      const r = await caller.rpc('evaluate_object_set_by_rid',
        { p_rid: rid, p_limit: Number(payload.pageSize ?? 100) })
      return r.error ? { ok: false, error: r.error.message } : { ok: true, value: r.data ?? [] }
    }

    const objectType = String(payload.objectType ?? '')
    if (!declared.has(objectType)) {
      return { ok: false, error: `Functions:UndeclaredImport — ${objectType} is not imported by this function` }
    }
    const filters = toFilters((payload.where ?? {}) as Record<string, unknown>)

    if (op === 'count') {
      const r = await caller.rpc('count_object_set_by_api_name',
        { p_ontology: ontologyId, p_api_name: objectType, p_filters: filters })
      return r.error ? { ok: false, error: r.error.message } : { ok: true, value: r.data }
    }
    if (op === 'page' || op === 'fetchOne') {
      // "Gets a specific object with the given primary key" — a fetchOne
      // without one is an author error, not the first row of the type (749).
      if (op === 'fetchOne' && (payload.primaryKey === undefined || payload.primaryKey === null)) {
        return { ok: false, error: 'Functions:FetchOneNamesPrimaryKey — fetchOne needs a primary key' }
      }
      const r = await caller.rpc('evaluate_object_set_by_api_name', {
        p_ontology: ontologyId, p_api_name: objectType, p_filters: filters,
        p_limit: op === 'fetchOne' ? 1 : Number(payload.pageSize ?? 100),
        ...(op === 'fetchOne' ? { p_primary_key: String(payload.primaryKey) } : {}),
      })
      if (r.error) return { ok: false, error: r.error.message }
      const rows = (r.data ?? []) as unknown[]
      return { ok: true, value: op === 'fetchOne' ? (rows[0] ?? null) : rows }
    }
    return { ok: false, error: `Functions:UnsupportedOperation — ${op}` }
  }
}

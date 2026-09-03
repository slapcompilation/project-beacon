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

// The read overlay: a branch's saved changes composed over main's rows.
// "This does not apply to ontology resources: you can create, modify, or
// delete entities on the branch without affecting the main branch" — so a
// list rendered ON a branch shows the branch's version: modified fields
// overlaid, created rows present, deleted rows gone.

export interface BranchChangeLike {
  resource_kind: string
  resource_id: string
  operation: string
  fields: Record<string, unknown>
}

/** Compose top-level fields. Created rows carry only their staged fields —
 *  nested section shapes (properties as rows, datasources) stay empty until
 *  the merge lands them, which the caller's defaults must tolerate. */
export function overlayRows<T extends { id: string }>(
  rows: T[],
  changes: BranchChangeLike[],
  kind: string,
  createdDefaults: Partial<T>,
): T[] {
  const byId = new Map(changes.filter((c) => c.resource_kind === kind).map((c) => [c.resource_id, c]))
  const out: T[] = []
  for (const r of rows) {
    const c = byId.get(r.id)
    if (!c) { out.push(r); continue }
    byId.delete(r.id)
    if (c.operation === 'deleted') continue
    out.push({ ...r, ...c.fields })
  }
  for (const c of byId.values()) {
    if (c.operation !== 'created') continue
    out.push({ id: c.resource_id, ...createdDefaults, ...c.fields } as T)
  }
  return out
}

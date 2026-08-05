// How each ontology node type LISTS its instances β€” the table to read (RLS-scoped,
// no hotel filter, so a list always matches the /objects count) and how to render
// a row. The Objects page cards link here; each row opens the type's Object View.
// Presentation (icon/label/route) still comes from OBJECT_PRESENTATION.
//
// G3: the ontology row is the SOURCE and these entries are overrides. A built-in
// type with no entry here still lists β€” defaultListSpec derives one from its
// registration (source_table + title_key). Entries below earn their place by
// doing what a title key can't: joins (a variant's title is its product's name)
// and composed subtitles.

import { objectTitle } from '@beacon/reality-graph'
import type { ObjectTypeDef } from '@beacon/reality-graph'

type Row = Record<string, unknown>

export interface ObjectListSpec {
  table: string
  select: string
  orderBy?: { column: string; ascending?: boolean }
  title: (r: Row) => string
  subtitle?: (r: Row) => string | null
}

const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
const newest = { column: 'created_at', ascending: false }

export const OBJECT_LIST: Partial<Record<string, ObjectListSpec>> = {}

export function defaultListSpec(t: ObjectTypeDef): ObjectListSpec | null {
  if (!t.sourceTable) return null
  const subtitleProps = t.properties.filter((p) => p.key !== t.titleKey && p.key !== 'created_at').slice(0, 2)
  return {
    table: t.sourceTable,
    select: '*',
    orderBy: t.properties.some((p) => p.key === 'created_at') ? newest : undefined,
    title: (r) => objectTitle(t, r),
    subtitle: (r) =>
      subtitleProps.map((p) => `${p.label}: ${str(r[p.key]) || 'β€”'}`).join(' Β· ') || null,
  }
}

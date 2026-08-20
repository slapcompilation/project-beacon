// @vocabulary-declaration — restates the database CHECKs; not a consumer.
//
// Link cardinality, and which backing can express it. Foundry's, quoted from
// `mirror/object-link-types/create-link-type.md`:
//
//   "Object type foreign keys: Supports 'one-to-one' and 'many-to-one'
//    cardinality link types. This option allows you to select properties that
//    represent the foreign key and corresponding primary key..."
//
//   "In a many-to-many cardinality, select a datasource that includes all
//    combinations of links between the primary key of the first object type
//    and the second."
//
// So the backing is not a free choice: a foreign key cannot express many-to-many
// (one column holds one value), and a join table for a many-to-one is a table
// where a column would do. Four of our seven join-backed link types were
// many-to-one before migration 352 removed them — the same mistake four times.
//
// This file exists because the vocabulary lived only as rows. When migration 353
// emptied the ontology, `many_to_one` became a CHECK value nothing consumed, and
// the guard was right to say so: a value whose only evidence is data disappears
// with the data.

export const LINK_CARDINALITIES = ['one_to_one', 'many_to_one', 'one_to_many', 'many_to_many'] as const
export type LinkCardinality = typeof LINK_CARDINALITIES[number]

export const LINK_BACKINGS = ['foreign_key', 'join_table', 'object_backed'] as const
export type LinkBackingKind = typeof LINK_BACKINGS[number]

/** Foundry renders the cardinality as a sentence under the link's title —
 *  `Many-to-one link type` (oma-user-interface-link-type.png). */
export const CARDINALITY_LABEL: Record<LinkCardinality, string> = {
  one_to_one: 'One-to-one link type',
  many_to_one: 'Many-to-one link type',
  one_to_many: 'One-to-many link type',
  many_to_many: 'Many-to-many link type',
}

/** The three cards of the Configuration section's Join method. The create
 *  dialog's prose names them at length; the link type view labels them short. */
export const BACKING_LABEL: Record<LinkBackingKind, string> = {
  foreign_key: 'Foreign key',
  join_table: 'Dataset',
  object_backed: 'Object type',
}

export const BACKING_ICON: Record<LinkBackingKind, 'key' | 'th' | 'cube'> = {
  foreign_key: 'key', join_table: 'th', object_backed: 'cube',
}

/** Which backing kinds can express each cardinality. */
export const CARDINALITY_BACKINGS: Record<LinkCardinality, ReadonlyArray<LinkBackingKind>> = {
  one_to_one:   ['foreign_key', 'join_table', 'object_backed'],
  many_to_one:  ['foreign_key', 'join_table', 'object_backed'],
  // A foreign key holds one value, so it cannot carry the many side.
  one_to_many:  ['join_table', 'object_backed'],
  many_to_many: ['join_table', 'object_backed'],
}

export const canBack = (c: LinkCardinality, backing: LinkBackingKind): boolean =>
  CARDINALITY_BACKINGS[c].includes(backing)

/** Foundry recommends the foreign key where it fits — a join table for a
 *  many-to-one is a table doing a column's job. */
export const preferredBacking = (c: LinkCardinality): LinkBackingKind =>
  canBack(c, 'foreign_key') ? 'foreign_key' : 'join_table'

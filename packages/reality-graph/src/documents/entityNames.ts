// Whether an extracted entity name actually names something.
//
// Foundry's `Entity` object type has PK = `entityName` and title = `entityName`
// — the name IS the identity. So "supplier" is not an entity, it is the
// category; "food product" is a type; "Item 1" is a position in a table.
//
// The first real contract produced all three. They cost nothing to store and a
// lot to have: each becomes an Entity node, collects `mentions` edges from every
// chunk that says the word, and is offered to the resolver as a candidate to
// match against real suppliers and variants. A node called "supplier" mentioned
// by half the document is noise with a high degree.
//
// The prompt asks for specific names; this refuses the ones that arrive anyway.
// Prompt for intent, filter for the contract — the same fail-closed discipline
// the ingestion stage gates use.

export const ENTITY_CATEGORIES = ['supplier', 'product', 'location', 'clause', 'term'] as const
export type EntityCategory = typeof ENTITY_CATEGORIES[number]

/** Bare words that name a kind of thing rather than a thing. */
const CATEGORY_WORDS = new Set<string>([
  ...ENTITY_CATEGORIES,
  'suppliers', 'products', 'locations', 'clauses', 'terms',
  'vendor', 'vendors', 'customer', 'customers', 'client', 'clients',
  'buyer', 'seller', 'contractor', 'item', 'items', 'goods', 'service',
  'services', 'material', 'materials', 'company', 'contract', 'invoice',
  'document', 'party', 'parties',
])

/** "food product", "frozen goods", "fresh produce" — a type, not a name. */
const GENERIC_TYPE =
  /^(the\s+|a\s+|an\s+)?(food|frozen|fresh|dry|chilled|bakery|dairy|misc\w*|general|other|various)\s+(product|item|good|supply|supplies|material|stuff|type)s?$/i

/** "Item 1", "line 2", "row 3", "#4" — a position in a table. */
const POSITIONAL = /^(item|line|row|entry|position|no\.?|#|point|paragraph)\s*[-–]?\s*\d+$/i

/** Deictic references that mean nothing outside their sentence. */
const DEICTIC = /^(the\s+)?(above|below|foregoing|aforementioned|same|it|this|that|these|those)$/i

export interface EntityNameVerdict {
  ok: boolean
  /** Why it was refused — logged, so a bad prompt is visible in the data. */
  reason?: 'category-word' | 'generic-type' | 'positional' | 'deictic' | 'too-short' | 'numeric'
}

export function checkEntityName(name: string): EntityNameVerdict {
  const n = name.trim()
  const lower = n.toLowerCase()

  if (n.length < 2) return { ok: false, reason: 'too-short' }
  // A pure number identifies nothing on its own; "Clause 7.2" survives because
  // of the word.
  if (/^[\d\s.,\-/#]+$/.test(n)) return { ok: false, reason: 'numeric' }
  if (CATEGORY_WORDS.has(lower)) return { ok: false, reason: 'category-word' }
  if (GENERIC_TYPE.test(lower)) return { ok: false, reason: 'generic-type' }
  if (POSITIONAL.test(lower)) return { ok: false, reason: 'positional' }
  if (DEICTIC.test(lower)) return { ok: false, reason: 'deictic' }
  return { ok: true }
}

export const isNameableEntity = (name: string): boolean => checkEntityName(name).ok

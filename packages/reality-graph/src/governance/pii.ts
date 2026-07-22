// Sensitive-data scanner (P8, Foundry Data-Protection parity). A deterministic
// detector grammar over document text: it derives the sensitivity marking from
// what a document actually contains, so the classification isn't a guess an
// operator has to remember to set. Pure + testable; the marking it produces is
// what propagates to chunks/entities and gates retrieval at the LLM boundary.

export type PIIType = 'email' | 'phone' | 'credit_card' | 'iban'

export type Sensitivity = 'public' | 'internal' | 'confidential' | 'restricted'

export const SENSITIVITY_RANK: Record<Sensitivity, number> = {
  public: 0, internal: 1, confidential: 2, restricted: 3,
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// International (+cc …) or a clearly-grouped domestic number — grouping/‘+’ keeps
// bare order numbers from matching.
const PHONE = /(?:\+\d[\d\s().-]{7,}\d)|(?:\b\d{3}[\s.-]\d{3,4}[\s.-]\d{3,4}\b)/g
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g
// 13–19 digit runs (optional separators); confirmed by Luhn to cut false hits.
const CARD_CANDIDATE = /\b(?:\d[ -]?){13,19}\b/g

function luhnValid(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (d < 0 || d > 9) return false
    if (alt) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    alt = !alt
  }
  return digits.length >= 13 && sum % 10 === 0
}

/** The types of personal/financial data present in `text`. Deterministic — the
 *  same text always yields the same set. Empty when nothing sensitive is found. */
export function scanForPII(text: string): PIIType[] {
  if (!text) return []
  const found = new Set<PIIType>()
  if (EMAIL.test(text)) found.add('email')
  if (PHONE.test(text)) found.add('phone')
  if (IBAN.test(text)) found.add('iban')
  for (const m of text.match(CARD_CANDIDATE) ?? []) {
    if (luhnValid(m.replace(/[ -]/g, ''))) { found.add('credit_card'); break }
  }
  // Regexes carry lastIndex with the /g flag — reset so repeat calls are stable.
  EMAIL.lastIndex = PHONE.lastIndex = IBAN.lastIndex = CARD_CANDIDATE.lastIndex = 0
  return [...found]
}

/** The minimum sensitivity a document's detected PII warrants. Financial data
 *  (cards, IBANs) is restricted; contact data (email, phone) is confidential;
 *  nothing found leaves the operator's chosen base untouched. */
export function sensitivityFromPII(types: ReadonlyArray<PIIType>, base: Sensitivity = 'internal'): Sensitivity {
  let floor: Sensitivity = base
  if (types.includes('email') || types.includes('phone')) floor = raise(floor, 'confidential')
  if (types.includes('credit_card') || types.includes('iban')) floor = raise(floor, 'restricted')
  return floor
}

function raise(a: Sensitivity, b: Sensitivity): Sensitivity {
  return SENSITIVITY_RANK[a] >= SENSITIVITY_RANK[b] ? a : b
}

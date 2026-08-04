// Is this document a filled-in instance, or a blank form?
//
// INV11122 was ingested, chunked, embedded, entity-extracted and marked
// `contextualized` — the full pipeline, on a document with no supplier, no
// customer and no real line items. Its "From:" block is the labels Όνομα /
// Επωνυμία / Διεύθυνση / Πόλη / Τ.Κ. with nothing after them, and its two lines
// are Είδος 1 and Είδος 2 — "Item 1" and "Item 2".
//
// It cost an LLM pass, produced five junk entities, and then cost a day of
// reconciliation work that could not be verified, because there is nothing in it
// to reconcile. Nothing in the pipeline noticed, because every stage gate asks
// "did this stage produce output" and blank forms produce output fine.
//
// CONTRACT-MODEL.md hit the same class twice already — quote samples that were
// "a template or a generic example... the shape is legible, the data is not
// there". Third time, so it becomes a check rather than a note.
//
// Deliberately a SIGNAL, not a gate. A blank form is a legitimate thing to
// store — you may want the template. What it must not do is look like evidence.

export interface TemplateVerdict {
  /** 0..1 — how strongly this reads as an unfilled form. */
  score: number
  /** What fired, in the operator's words. */
  signals: string[]
  /** Above the threshold: treat its extracted facts as illustrative, not real. */
  isBlank: boolean
}

/** Placeholder item labels, in the languages we have seen. Deliberately narrow —
 *  a real line called "Item 1" is possible, which is why this is one signal
 *  among several rather than a verdict on its own. */
const PLACEHOLDER_LINE = /(^|\n|\|)\s*(item|είδος|articulo|artikel|line|product)\s*[-–]?\s*\d+\s*(\||$|\n)/gi

/** Field labels with nothing after them: "Name\nSurname\nAddress" stacked with
 *  no values. Matches the label vocabulary, not any one language's grammar. */
const BARE_LABELS = [
  'name', 'surname', 'address', 'city', 'postcode', 'zip', 'phone', 'email',
  'company', 'date', 'signature', 'title', 'quantity', 'description',
  'όνομα', 'επωνυμία', 'διεύθυνση', 'πόλη', 'τ.κ.', 'τηλέφωνο', 'ημερομηνία',
  'υπογραφή', 'ποσότητα', 'περιγραφή',
]

/** Instructions to whoever fills the form in. A document telling you to complete
 *  it has not been completed. */
const FILL_IN_INSTRUCTION =
  /(to be (completed|filled)|for completion|fill in|please complete|συμπλήρωση|συμπληρώνεται|na sympliro)/i

/** Currency-looking round numbers that are obviously specimen values. */
const SPECIMEN_AMOUNT = /(^|\s|\|)[€$£]\s?(100|200|250|500|1,?000|1,?200|1,?500|2,?000)\.00(\s|$|\|)/g

const THRESHOLD = 0.5

export function detectBlankTemplate(text: string): TemplateVerdict {
  const signals: string[] = []
  let score = 0
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { score: 0, signals: [], isBlank: false }

  const placeholders = [...text.matchAll(PLACEHOLDER_LINE)].length
  if (placeholders >= 2) {
    score += 0.4
    signals.push(`${String(placeholders)} placeholder line items ("Item 1", "Είδος 2")`)
  }

  // A label on its own line, with no value beside or after it.
  const bare = lines.filter((l) => {
    const stripped = l.replace(/[:：]\s*$/, '').toLowerCase()
    return BARE_LABELS.includes(stripped)
  }).length
  if (bare >= 4) {
    score += 0.4
    signals.push(`${String(bare)} field labels with nothing filled in`)
  }

  if (FILL_IN_INSTRUCTION.test(text)) {
    score += 0.3
    signals.push('contains an instruction to complete the form')
  }

  const specimens = [...text.matchAll(SPECIMEN_AMOUNT)].length
  if (specimens >= 2 && placeholders >= 1) {
    score += 0.2
    signals.push('round specimen amounts against placeholder lines')
  }

  score = Math.min(1, score)
  return { score, signals, isBlank: score >= THRESHOLD }
}

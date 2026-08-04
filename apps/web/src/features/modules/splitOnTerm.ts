// Pure text-splitting for the source viewer's keyword search, kept apart from
// the component on purpose: SourceViewer imports the Supabase client, which
// throws at module load without .env.local. A unit test for string splitting
// should not need a database — importing it through the component is what made
// CI red while every local run passed.

/** Splits text on a search term, keeping the term, so matches can be wrapped
 *  without dangerouslySetInnerHTML. Case-insensitive like their search bar. */
export function splitOnTerm(text: string, term: string): { text: string; match: boolean }[] {
  const needle = term.trim()
  if (!needle) return [{ text, match: false }]
  const out: { text: string; match: boolean }[] = []
  const lower = text.toLowerCase()
  const target = needle.toLowerCase()
  let at = 0
  for (;;) {
    const hit = lower.indexOf(target, at)
    if (hit === -1) { out.push({ text: text.slice(at), match: false }); break }
    if (hit > at) out.push({ text: text.slice(at, hit), match: false })
    out.push({ text: text.slice(hit, hit + needle.length), match: true })
    at = hit + needle.length
  }
  return out.filter((s) => s.text !== '')
}

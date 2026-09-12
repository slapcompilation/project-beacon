// The preview table's pure half: cell rendering, filter chips, the History
// summary's arithmetic. Reaches nothing, so a test of it needs no credential.
//
// Shapes are read off dataset-preview/images/dataset-preview.png and
// dataset-app-history-page.png; see readings/dataset-preview.md §3 and §5.

/** What a jsonb cell can hold. Structurally the platform's Json, restated
 *  here so the pure module imports nothing. */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

/** One include/exclude filter, the two verbs the cell menu offers. A null
 *  value means the SQL null, because `null` renders as a cell you can click. */
export interface PreviewFilter { column: string; op: 'include' | 'exclude'; value: Json | null }

/** The chip above the grid: `end_borough: "Manhattan"`, and `≠` for an exclude. */
export function filterLabel(f: PreviewFilter): string {
  const v = f.value === null ? 'null' : typeof f.value === 'string' ? `"${f.value}"` : JSON.stringify(f.value)
  return `${f.column}${f.op === 'exclude' ? ' ≠ ' : ': '}${v}`
}

/** What a cell shows. Null is the word, so it can be told from an empty string;
 *  objects and arrays are their JSON, since the grid has no nested renderer. */
export function formatCell(v: Json | undefined): { text: string; isNull: boolean } {
  if (v === null || v === undefined) return { text: 'null', isNull: true }
  if (typeof v === 'object') return { text: JSON.stringify(v), isNull: false }
  return { text: String(v), isNull: false }
}

/** Right-align numbers, as the capture does; everything else stays left. */
export const isNumeric = (v: Json | undefined): boolean => typeof v === 'number'

/** `9m 32s` — the rail's form for a number of seconds. */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${String(s)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${String(m)}m ${String(s % 60)}s`
  return `${String(Math.floor(m / 60))}h ${String(m % 60)}m`
}

/** The rail's duration, from two timestamps; a running job measures to now. */
export function duration(startedAt: string | null, finishedAt: string | null, now = Date.now()): string {
  if (startedAt === null) return '—'
  const ms = (finishedAt === null ? now : new Date(finishedAt).getTime()) - new Date(startedAt).getTime()
  return formatSeconds(ms / 1000)
}

/** Counts as the captures print them: `16,719` with separators, and `91.1k`
 *  once large — dataset-preview.png abbreviates 91,077 in the strip and the
 *  stats counts while printing 16,719 whole, so the threshold is an inference
 *  set between the two. */
export function formatCount(n: number): string {
  if (n >= 20_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return n.toLocaleString('en-US')
}

/** The History rail's time: `5 minutes ago` within the hour, `Today at
 *  10:28 AM` the same day, else `Apr 22, 8:55 PM` — the three forms
 *  dataset-app-history-page.png and create-branch.png show. Locale pinned so
 *  the form is the capture's wherever it runs. */
export function historyTime(iso: string, now = Date.now()): string {
  const t = new Date(iso)
  const s = Math.max(0, Math.round((now - t.getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) { const m = Math.floor(s / 60); return `${String(m)} minute${m === 1 ? '' : 's'} ago` }
  const time = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const d = new Date(now)
  if (t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() && t.getDate() === d.getDate()) {
    return `Today at ${time}`
  }
  return `${t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

/** The Summary's fifth card. Median of the finished jobs, in seconds; null when
 *  none has finished, so the card can say so rather than print 0s. */
export function medianDurationSeconds(jobs: { startedAt: string | null; finishedAt: string | null }[]): number | null {
  const secs = jobs
    .filter((j): j is { startedAt: string; finishedAt: string } => j.startedAt !== null && j.finishedAt !== null)
    .map((j) => (new Date(j.finishedAt).getTime() - new Date(j.startedAt).getTime()) / 1000)
    .sort((a, b) => a - b)
  if (secs.length === 0) return null
  const mid = Math.floor(secs.length / 2)
  return secs.length % 2 === 1 ? secs[mid] : (secs[mid - 1] + secs[mid]) / 2
}

/** The four Summary cards' vocabulary is the build API's — "RUNNING SUCCEEDED
 *  FAILED CANCELED" — while build_jobs.state carries the job tokens
 *  (WAITING … COMPLETED). This is the fold from one to the other, so the cards
 *  can be labelled as the capture labels them. */
export type SummaryBucket = 'Running' | 'Succeeded' | 'Failed' | 'Canceled'
export function summaryBucket(state: string): SummaryBucket {
  switch (state) {
    case 'COMPLETED': return 'Succeeded'
    case 'FAILED': return 'Failed'
    case 'ABORTED': case 'ABORT_PENDING': return 'Canceled'
    default: return 'Running'
  }
}

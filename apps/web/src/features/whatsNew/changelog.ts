// Product changelog — the "What's New" release-notes feed. Release notes are a
// global product fact (same for every tenant), so the source of truth is this
// committed list, newest first. Ship a new entry alongside the release.
//
// The unseen dot is honest: it reflects entries newer than the last time this
// user opened the page (tracked in localStorage), not a hardcoded flag.

export type ChangeCategory = 'feature' | 'improvement' | 'fix'

export interface ChangelogEntry {
  /** ISO date the change shipped. Drives ordering + the unseen dot. */
  date: string
  title: string
  category: ChangeCategory
  /** One line each — what changed, in operator terms. */
  highlights: string[]
}

// Newest first. Keep entries operator-facing (what they can now do), not commit-speak.
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-07-21',
    title: 'Search Around the graph',
    category: 'feature',
    highlights: [
      'Explore any object’s connections as an interactive radial graph — click a neighbour to hop and build a trail.',
      'Opens from Supplier, Variant, and Document pages.',
    ],
  },
  {
    date: '2026-07-20',
    title: 'Documents on the objects they describe',
    category: 'feature',
    highlights: [
      'Supplier and Variant pages now list the contracts and documents that reference them, with the page and snippet.',
      'Ask the copilot a question and it answers from your documents, citing the source and page.',
    ],
  },
  {
    date: '2026-07-19',
    title: 'Document ingestion, Foundry-grade',
    category: 'feature',
    highlights: [
      'Upload a PDF and it’s parsed full-page, chunked, summarised, embedded, and linked to real suppliers and variants.',
      'Extracted entities (suppliers, products, clauses, terms) become part of the graph.',
    ],
  },
  {
    date: '2026-07-14',
    title: 'Studio: build → govern → prove',
    category: 'improvement',
    highlights: [
      'Studio landing narrates the loop — build agents, govern with policy, prove with evals, sandbox scenarios.',
      'Insights gained an overview lens directory so every analysis view is one click away.',
    ],
  },
  {
    date: '2026-07-09',
    title: 'Typed lifecycles + guardrails',
    category: 'improvement',
    highlights: [
      'Restocks, purchase orders, cases, and proposals now move only through their legal states — illegal transitions are refused.',
      'The learning loop grows its own vocabulary as you approve new reasons.',
    ],
  },
  {
    date: '2026-06-30',
    title: 'Calibration + trust budget',
    category: 'feature',
    highlights: [
      'The system tracks whether its stated confidence matches reality, and only auto-executes where it’s earned trust.',
      'Every auto-executed action still emits a full trace in the review feed.',
    ],
  },
]

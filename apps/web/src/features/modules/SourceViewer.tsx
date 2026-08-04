// Source viewer — the fourth step of Foundry's ontology-augmented-generation
// chain, and the one that makes the other three checkable by a person.
//
// Their words for the job (functions/chunking): render the source "on the side
// for source-of-truth cross-validation for the users". A cited chunk that nobody
// can trace back to the page it came from is an assertion, not evidence.
//
// THE BINDING IS THEIRS (mirror/workshop/widgets-pdf-viewer.md): "Define an
// object set with a SINGLE OBJECT and select the media reference typed property
// for the PDF." So the widget takes an object set and a property name — never a
// path — which is why document.storage_path had to become a media_reference
// property first (migration 340).
//
// Their input variables too: a page number that navigates, and a search term
// that "will be populated into the search bar, and a keyword search will be
// executed against that term", with match highlighting and a hit count.
//
// WHAT WE DO NOT DO, and why the widget is called source_viewer rather than
// pdf_viewer: theirs renders PDF pixels and supports annotation objects created
// through actions. Ours renders the extracted text — which is what our documents
// actually are — and offers the original for download. Naming it pdf_viewer
// would promise a renderer we do not have.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Callout, Card, Icon, InputGroup, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { supabase } from '@/lib/supabase/client'
import { createSignedDocumentUrl } from '@/features/documents/api'

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

interface SourceRow { id: string; title: string; storage_path: string; mime_type: string }

export function SourceViewer({
  record, property, page, term, title,
}: {
  /** The single object the set holds. Foundry requires exactly one. */
  record: Record<string, unknown> | undefined
  /** The media reference property to read the file from. */
  property: string
  /** Navigates to this page, per their page-number input. */
  page?: number
  /** Populates the search bar and runs the search, per their text input. */
  term?: string
  title?: string
}) {
  const [search, setSearch] = useState(term ?? '')
  const [current, setCurrent] = useState(0)
  const firstMatch = useRef<HTMLSpanElement | null>(null)

  // Their text input is a default, not a lock — "even without configuring the
  // widget, you can still manually enter any search term".
  useEffect(() => { setSearch(term ?? '') }, [term])

  const reference = typeof record?.[property] === 'string' ? record[property] : null
  const docId = typeof record?.id === 'string' ? record.id : null

  // The chunk text IS the extracted source, already page-numbered by ingestion,
  // so the viewer reads what the pipeline produced rather than re-parsing a file.
  const { data, isLoading } = useQuery({
    queryKey: ['source-viewer', docId, page ?? null],
    enabled: !!docId,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('document_chunks')
        .select('page, chunk_number, text_full')
        .eq('document_id', docId ?? '')
        .order('page').order('chunk_number')
      if (error) throw new Error(error.message)
      return rows as { page: number; chunk_number: number; text_full: string }[]
    },
    staleTime: 60_000,
  })

  const pages = useMemo(() => {
    const by = new Map<number, string>()
    for (const c of data ?? []) by.set(c.page, (by.get(c.page) ?? '') + c.text_full)
    return [...by.entries()].sort((a, b) => a[0] - b[0])
  }, [data])

  const shown = page ? pages.filter(([p]) => p === page) : pages
  const hits = useMemo(
    () => shown.reduce((n, [, text]) => n + splitOnTerm(text, search).filter((s) => s.match).length, 0),
    [shown, search])

  // "Snaps to first result" — scroll once the matches have rendered.
  useEffect(() => { setCurrent(0); firstMatch.current?.scrollIntoView({ block: 'center' }) }, [search])

  if (!record) {
    return (
      <Card className="text-xs text-muted-foreground">
        {title ?? 'Source'} — this viewer shows one object. Point it at a set holding a single document.
      </Card>
    )
  }

  let seen = -1
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon="document-open" size={13} className="text-violet-500" />
        <span className="text-sm font-semibold truncate">
          {title ?? (typeof record.title === 'string' ? record.title : 'Source')}
        </span>
        {page && <Tag minimal className="!text-[9px]">page {page}</Tag>}
        <InputGroup size="small" leftIcon="search" placeholder="Find in document"
          value={search} className="ml-auto" style={{ width: 200 }}
          onChange={(e) => { setSearch(e.currentTarget.value) }} />
        {search.trim() !== '' && (
          <Tag minimal intent={hits > 0 ? Intent.PRIMARY : Intent.NONE} className="!text-[9px] tabular-nums">
            {hits} {hits === 1 ? 'match' : 'matches'}
          </Tag>
        )}
        {reference && docId && <OpenOriginal path={reference} />}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Spinner size={SpinnerSize.SMALL} /></div>
      ) : shown.length === 0 ? (
        <Callout className="!text-xs" icon="info-sign">
          Nothing extracted yet{page ? ` for page ${String(page)}` : ''}. The source is still readable
          through the original.
        </Callout>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-3 rounded border border-border/40 bg-muted/10 p-3">
          {shown.map(([p, text]) => (
            <div key={p}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                page {p}
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed">
                {splitOnTerm(text, search).map((seg, i) => {
                  if (!seg.match) return <span key={i}>{seg.text}</span>
                  seen += 1
                  const isCurrent = seen === current
                  return (
                    <span key={i}
                      ref={seen === 0 ? firstMatch : undefined}
                      className={isCurrent ? 'bg-emerald-300/70 rounded-[2px]' : 'bg-violet-300/50 rounded-[2px]'}>
                      {seg.text}
                    </span>
                  )
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** The original file, behind a short-lived signed URL — the documents bucket is
 *  private and stays that way. */
function OpenOriginal({ path }: { path: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button size="small" variant="minimal" icon="share" loading={busy} title="Open the original file"
      onClick={() => {
        setBusy(true)
        void createSignedDocumentUrl(path)
          .then((url) => { window.open(url, '_blank', 'noopener') })
          .finally(() => { setBusy(false) })
      }} />
  )
}

export type { SourceRow }

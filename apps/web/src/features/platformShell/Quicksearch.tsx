// Quicksearch, jump-to mode (readings/home-and-navigation.md §8.2): "a short
// list of personalized results to directly navigate users to the main types of
// available content". Opened from the sidebar's Search row or Cmd/Ctrl+J.
//
// FULL RESULTS MODE IS OMITTED BY NAME. It "searches additional fields and
// metadata", which needs an index; jump-to "only searches on titles", which a
// client-side pass over what is already loaded does honestly. So the screenshot's
// blue `All search results for '…'` row is absent rather than dead.
//
// The four kinds are the four documented tabs, each read through the hook its
// own page uses — so permissions come free: RLS scopes every one of them, which
// is "Quicksearch respects all existing permissions in the platform".

import { useMemo, useState } from 'react'
import { Button, Dialog, Icon, InputGroup } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useObjectTypes } from '@/features/objectTypes/hooks'
import { useDatasets, datasetLocation } from '@/features/datasets/api'
import { useProjects } from '@/features/projects/api'
import { useAppStore } from '@/stores/app.store'
import { ALL_APPS, titleForPath } from './apps'

/** The modifier this OS renders in the hint. The handler accepts both. */
export const MOD = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl+'

type Kind = 'Apps' | 'Objects' | 'Datasets' | 'Files'
interface Hit { key: string; icon: IconName; name: string; detail: string; kind: Kind; path: string; term: string }

const PER_KIND = 5
const TOTAL = 12

const hit = (key: string, icon: IconName, name: string, detail: string, kind: Kind, path: string, term = name): Hit =>
  ({ key, icon, name, detail, kind, path, term: term.toLowerCase() })

export function Quicksearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const recents = useAppStore((s) => s.recents)
  const { data: objectTypes = [] } = useObjectTypes()
  const { data: datasets = [] } = useDatasets()
  const { data: projects = [] } = useProjects()

  const candidates: Hit[] = useMemo(() => [
    ...ALL_APPS.map((a) => hit(`app:${a.path}`, a.icon, a.name, a.tagline, 'Apps', a.path)),
    // An object type answers to both its label and its API name; both are titles.
    ...objectTypes.map((t) => hit(`ot:${t.id}`, 'cube', t.label, t.api_name, 'Objects',
      `/ontology/object-types?type=${t.id}`, `${t.label} ${t.api_name}`)),
    ...datasets.map((d) => hit(`ds:${d.id}`, 'database', d.name, datasetLocation(d), 'Datasets', '/datasets')),
    ...projects.map((p) => hit(`pj:${p.id}`, 'folder-close', p.name, p.apiName, 'Files', '/projects')),
  ], [objectTypes, datasets, projects])

  // Empty query: the jump-to list is "personalized by your recently accessed".
  const recentHits: Hit[] = useMemo(() => recents.flatMap((path) => {
    const name = titleForPath(path)
    return name ? [hit(`re:${path}`, ALL_APPS.find((a) => a.path === path)?.icon ?? 'document', name, path, 'Apps', path)] : []
  }), [recents])

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!q) return recentHits.slice(0, TOTAL)
    const perKind = new Map<Kind, number>()
    const out: Hit[] = []
    for (const h of candidates) {
      const n = perKind.get(h.kind) ?? 0
      if (n >= PER_KIND || !h.term.includes(q)) continue
      perKind.set(h.kind, n + 1)
      out.push(h)
      if (out.length >= TOTAL) break
    }
    return out
  }, [q, candidates, recentHits])

  const go = (h: Hit | undefined) => { if (h) { onClose(); void navigate(h.path) } }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((n) => Math.min(n + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((n) => Math.max(n - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(shown[cursor]) }
  }

  return (
    <Dialog isOpen onClose={onClose} className="quicksearch" portalClassName="quicksearch-portal" style={{ width: 720 }}>
      <div className="qs-top">
        <InputGroup className="qs-input" leftIcon="search" fill autoFocus value={query}
          placeholder="Search apps, objects, datasets and files" aria-label="Quicksearch"
          onValueChange={(v) => { setQuery(v); setCursor(0) }} onKeyDown={onKeyDown}
          rightElement={
            <>
              {query && <Button variant="minimal" size="small" onClick={() => { setQuery(''); setCursor(0) }}>Clear</Button>}
              <Button variant="minimal" size="small" icon="cross" aria-label="Close" onClick={onClose} />
            </>
          } />
      </div>

      <div className="qs-head">
        <span>JUMP TO</span>
        <span>{q ? 'Highlighted samples from your results' : 'Recently accessed'}</span>
      </div>

      <ul className="qs-list">
        {shown.map((h, idx) => (
          <li key={h.key}>
            <button type="button" className={cn('qs-row', idx === cursor && 'is-active')}
              onMouseEnter={() => { setCursor(idx) }} onClick={() => { go(h) }}>
              <Icon icon={h.icon} size={14} />
              <span className="qs-name">{h.name}</span>
              <span className="qs-detail">{h.detail}</span>
              <span className="qs-pill">{h.kind}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="qs-none">{q ? 'No title matches that.' : 'Nothing visited yet.'}</li>
        )}
      </ul>

      <div className="qs-hotkeys">
        <span>HOTKEYS</span>
        <span><kbd>{MOD}J</kbd> Open Quicksearch</span>
        <span><kbd>↑</kbd>/<kbd>↓</kbd> Move in list</span>
        <span><kbd>⏎</kbd> select item</span>
      </div>
    </Dialog>
  )
}

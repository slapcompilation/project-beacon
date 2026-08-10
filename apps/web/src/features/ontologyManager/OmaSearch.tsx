// The header's search. "You can click into the Search bar or hold down
// Cmd/Ctrl + K to open the Search bar dialog." (§6.2)
//
// It searches THIS ontology's resources, over what the pages have already
// loaded — so it inherits their RLS scoping and adds no query. §6.8's other
// behaviour, where searching turns the sidebar into faceted match counts, is
// omitted: there is one flat list, ranked by nothing.

import { useMemo, useState } from 'react'
import { Dialog, Icon, InputGroup, Menu, MenuItem } from '@blueprintjs/core'
import { useNavigate } from 'react-router-dom'
import type { OmaResource } from './resources'

const LIMIT = 12

export function OmaSearch({ resources, onClose }: { resources: OmaResource[]; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const q = query.trim().toLowerCase()
  const hits = useMemo(
    () => (q ? resources.filter((r) => r.terms.includes(q)) : resources).slice(0, LIMIT),
    [q, resources],
  )

  const go = (r: OmaResource | undefined) => { if (r) { onClose(); void navigate(r.path) } }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((n) => Math.min(n + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((n) => Math.max(n - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(hits[cursor]) }
  }

  return (
    <Dialog isOpen onClose={onClose} title="Search Ontology resources" icon="search" style={{ width: 560 }}>
      <div className="oma-search-body">
        <InputGroup fill autoFocus leftIcon="search" value={query} aria-label="Search Ontology resources"
          placeholder="Search by name, RID, aliases..."
          onValueChange={(v) => { setQuery(v); setCursor(0) }} onKeyDown={onKeyDown} />
        <Menu className="oma-search-list">
          {hits.map((r, i) => (
            <MenuItem key={r.key} icon={<Icon icon={r.icon} size={14} />} active={i === cursor}
              text={r.label} label={r.kind} onClick={() => { go(r) }} />
          ))}
          {hits.length === 0 && <MenuItem disabled text="Nothing in this ontology matches." />}
        </Menu>
      </div>
    </Dialog>
  )
}

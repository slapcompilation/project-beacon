// The documentation renderer, restricted the way the page restricts it:
// "Inline HTML is disabled." — everything here is React text nodes, nothing
// is ever injected — and "[optional link text](rid)" resolves through
// rid_display to an icon-and-name link; a rid the reader cannot see (RLS)
// stays plain text (projects/add-documentation).

import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Icon, type IconName } from '@blueprintjs/core'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'

const KIND_ICONS: Partial<Record<string, IconName>> = {
  project: 'folder-open',
  folder: 'folder-close',
  dataset: 'th',
  restricted_view: 'eye-off',
  object_type: 'cube',
}

const KIND_ROUTES: Partial<Record<string, string>> = {
  project: '/projects',
  dataset: '/datasets',
}

function RidLink({ rid, text }: { rid: string; text: string | null }) {
  const { data } = useQuery({
    queryKey: ['rid-display', rid],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ kind: string; name: string } | null> => {
      const res = (await supabase.rpc('rid_display', { p_rid: rid })) as {
        data: { kind: string; name: string }[] | null
        error: { message: string } | null
      }
      if (res.error) throw new Error(res.error.message)
      return res.data?.at(0) ?? null
    },
  })
  if (!data) return <>{text ?? rid}</>
  const icon = KIND_ICONS[data.kind] ?? 'document'
  const route = KIND_ROUTES[data.kind]
  const body = (
    <span className="doc-rid-link">
      <Icon icon={icon} size={11} />
      {text ?? data.name}
    </span>
  )
  return route !== undefined ? <Link to={route}>{body}</Link> : body
}

/** Inline spans: links first (rid or external), then `code`, **bold**, *italic*. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const link = /\[([^\]]*)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  const push = (s: string) => {
    // Emphasis and code inside a plain run.
    const spans = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
    for (const sp of spans) {
      if (sp === '') continue
      const key = `${keyBase}-${String(k++)}`
      if (sp.startsWith('**') && sp.endsWith('**')) out.push(<strong key={key}>{sp.slice(2, -2)}</strong>)
      else if (sp.startsWith('`') && sp.endsWith('`')) out.push(<code key={key}>{sp.slice(1, -1)}</code>)
      else if (sp.startsWith('*') && sp.endsWith('*') && sp.length > 2) out.push(<em key={key}>{sp.slice(1, -1)}</em>)
      else out.push(<span key={key}>{sp}</span>)
    }
  }
  while ((m = link.exec(text)) !== null) {
    if (m.index > last) push(text.slice(last, m.index))
    const label = m[1] === '' ? null : m[1]
    const target = m[2]
    const key = `${keyBase}-l${String(k++)}`
    if (target.startsWith('ri.')) {
      out.push(<RidLink key={key} rid={target} text={label} />)
    } else if (/^https?:\/\//.test(target)) {
      out.push(<a key={key} href={target} target="_blank" rel="noreferrer">{label ?? target}</a>)
    } else {
      // "only image files uploaded to Foundry will be rendered" — we host no
      // uploads, so a non-rid relative target stays text.
      out.push(<span key={key}>{label ?? target}</span>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) push(text.slice(last))
  return out
}

export interface DocHeading { level: number; text: string }

export function extractHeadings(md: string): DocHeading[] {
  const out: DocHeading[] = []
  for (const line of md.split('\n')) {
    const m = /^(#{1,4})\s+(.*)$/.exec(line)
    if (m) out.push({ level: m[1].length, text: m[2].trim() })
  }
  return out
}

export function DocMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.split('\n')
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    const k = `b${String(key++)}`
    if (line.trim() === '') { i++; continue }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      const content = inline(h[2].trim(), k)
      if (level === 1) blocks.push(<h1 key={k}>{content}</h1>)
      else if (level === 2) blocks.push(<h2 key={k}>{content}</h2>)
      else if (level === 3) blocks.push(<h3 key={k}>{content}</h3>)
      else blocks.push(<h4 key={k}>{content}</h4>)
      i++
      continue
    }
    if (line.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++ }
      i++
      blocks.push(<pre key={k}><code>{buf.join('\n')}</code></pre>)
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(<li key={`${k}-${String(items.length)}`}>{inline(lines[i].replace(/^\s*[-*]\s+/, ''), `${k}-${String(items.length)}`)}</li>)
        i++
      }
      blocks.push(<ul key={k}>{items}</ul>)
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(<li key={`${k}-${String(items.length)}`}>{inline(lines[i].replace(/^\s*\d+\.\s+/, ''), `${k}-${String(items.length)}`)}</li>)
        i++
      }
      blocks.push(<ol key={k}>{items}</ol>)
      continue
    }
    // A paragraph runs to the next blank line or block start.
    const buf: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() !== ''
           && !/^(#{1,4})\s|^```|^\s*[-*]\s+|^\s*\d+\.\s+/.test(lines[i])) {
      buf.push(lines[i]); i++
    }
    blocks.push(<p key={k}>{inline(buf.join(' '), k)}</p>)
  }
  return <div className="doc-markdown">{blocks}</div>
}

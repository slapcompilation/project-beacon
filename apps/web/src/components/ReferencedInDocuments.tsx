// Reverse document lineage on an operational Object View (P10). Shows which
// uploaded documents reference this supplier/variant and how — the pipeline's
// output surfaced where the operator actually works. Rendered only when at
// least one document links back, so it stays out of the way otherwise.

import { Link } from 'react-router-dom'
import { Icon, Tag, Intent } from '@blueprintjs/core'
import { ObjectSection } from '@/components/ObjectSection'
import { useDocumentsForNode } from '@/features/documents/hooks'

export function ReferencedInDocuments({
  nodeType,
  nodeId,
}: {
  nodeType: 'supplier' | 'variant'
  nodeId:   string
}) {
  const { data: docs = [], isLoading } = useDocumentsForNode(nodeType, nodeId)
  if (isLoading || docs.length === 0) return null

  return (
    <ObjectSection title="Referenced in Documents" icon="search-around"
      subtitle="Uploaded documents that name or describe this item">
      <div className="flex flex-col">
        {docs.map((d) => (
          <div key={`${d.document_id}-${d.link_kind}`}
            className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0">
            <div className="min-w-0">
              <Link to={`/documents/${d.document_id}`}
                className="text-sm font-medium hover:underline flex items-center gap-1.5">
                <Icon icon="document" size={14} className="text-muted-foreground shrink-0" />
                <span className="truncate">{d.document_title}</span>
              </Link>
              {d.snippet && (
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {d.page != null && <span className="font-medium">p.{d.page} — </span>}
                  “{d.snippet.trim()}”
                </div>
              )}
            </div>
            <Tag minimal
              intent={d.link_kind === 'described' ? Intent.SUCCESS : Intent.NONE}
              title={d.link_kind === 'described'
                ? 'An operator approved this link'
                : 'Auto-resolved from a name match — review in the document'}>
              {d.link_kind === 'described' ? 'Linked' : 'Mentioned'}
            </Tag>
          </div>
        ))}
      </div>
    </ObjectSection>
  )
}

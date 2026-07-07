// Document Object View — metadata + signed-URL preview for one uploaded file.
// Uniform anatomy: header → metric strip → action bar → body sections.

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Callout, Card, Dialog, DialogBody, DialogFooter,
  HTMLSelect, Icon, InputGroup, Intent, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import {
  useDeleteDocument,
  useDocument,
  useDocumentEntityLinks,
  useIngestDocument,
  useLinkDocumentToEntity,
  useSignedDocumentUrl,
  useUnlinkDocumentFromEntity,
} from '@/features/documents/hooks'
import type { EntityNodeType, IngestionStage } from '@/features/documents/api'
import { AuditRail } from '@/components/AuditRail'
import { ObjectViewFrame } from '@/components/ObjectViewFrame'
import { Metric } from '@/components/MetricStrip'
import { ObjectSection } from '@/components/ObjectSection'
import {
  useApproveSuggestion,
  useAutoExtractEntityLinks,
  useRejectSuggestion,
  useSuggestionsForDocument,
} from '@/features/entityLinks/hooks'

export default function DocumentObjectPage() {
  const { documentId = '' } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { data: row, isLoading } = useDocument(documentId)
  const { data: signedUrl } = useSignedDocumentUrl(row?.storage_path)
  const { data: entityLinks = [] } = useDocumentEntityLinks(documentId)
  const del     = useDeleteDocument()
  const ingest  = useIngestDocument(documentId)
  const link    = useLinkDocumentToEntity(documentId)
  const unlink  = useUnlinkDocumentFromEntity(documentId)
  const autoExtract = useAutoExtractEntityLinks(documentId)
  const { data: suggestions = [] } = useSuggestionsForDocument(documentId)
  const approve = useApproveSuggestion()
  const reject  = useRejectSuggestion()
  const [linkOpen, setLinkOpen] = useState(false)

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending')

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner intent={Intent.PRIMARY} /></div>
  }
  if (!row) {
    return (
      <NonIdealState
        icon="search-template"
        title="Document not found"
        action={<Button onClick={() => { void navigate('/documents') }}>Back to Documents</Button>}
      />
    )
  }

  return (
    <>
    <ObjectViewFrame
      header={{
        breadcrumb: { label: 'Documents', to: '/documents' },
        icon: 'document',
        title: row.title,
        star: { id: `document:${row.id}`, label: row.title, subtitle: 'Document', path: `/documents/${documentId}`, icon: 'document' },
        tags: (
          <>
            <Tag minimal>{row.source}</Tag>
            <Tag minimal intent={stageIntent(row.ingestion_stage)}>{row.ingestion_stage}</Tag>
          </>
        ),
        id: row.id,
      }}

      metrics={
        <>
        <Metric label="Source"   value={row.source} capitalize />
        <Metric label="Stage"    value={row.ingestion_stage} capitalize />
        <Metric label="Size"     value={formatBytes(row.size_bytes)} />
        <Metric label="Uploaded" value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} capitalize />
        </>
      }
      actions={
        <>
        <Button
          variant="minimal"
          icon="link"
          onClick={() => { setLinkOpen(true) }}
        >
          Link to entity
        </Button>
        {row.ingestion_stage === 'raw' && (
          <Button
            intent={Intent.PRIMARY}
            variant="minimal"
            icon="eye-open"
            loading={ingest.isPending}
            onClick={() => { ingest.mutate() }}
          >
            Run ingestion
          </Button>
        )}
        {row.ingestion_stage !== 'raw' && (
          <Button
            variant="minimal"
            icon="refresh"
            loading={ingest.isPending}
            onClick={() => { ingest.mutate() }}
          >
            Re-ingest
          </Button>
        )}
        {row.chunks && row.chunks.length > 0 && (
          <Button
            variant="minimal"
            icon="search-template"
            loading={autoExtract.isPending}
            onClick={() => { autoExtract.mutate() }}
          >
            Suggest entity links
          </Button>
        )}
        {signedUrl && (
          <Button
            intent={Intent.PRIMARY}
            variant="minimal"
            icon="download"
            onClick={() => { window.open(signedUrl, '_blank', 'noopener') }}
          >
            Open file
          </Button>
        )}
        <Button
          intent={Intent.DANGER}
          variant="minimal"
          icon="trash"
          loading={del.isPending}
          onClick={() => {
            del.mutate(
              { id: row.id, storagePath: row.storage_path },
              { onSuccess: () => { void navigate('/documents') } },
            )
          }}
        >
          Delete
        </Button>
        </>
      }
      rail={<AuditRail nodeType="document" nodeId={row.id} />}
    >

        <ObjectSection title="File" icon="document">
          <Card className="space-y-1 text-xs">
            <div className="font-mono"><span className="text-muted-foreground">MIME:</span> {row.mime_type}</div>
            <div className="font-mono break-all"><span className="text-muted-foreground">Path:</span> {row.bucket_name}/{row.storage_path}</div>
            {row.page_count != null && (
              <div className="font-mono"><span className="text-muted-foreground">Pages:</span> {String(row.page_count)}</div>
            )}
          </Card>
        </ObjectSection>

        <ObjectSection title="Preview" icon="eye-open">
          {!signedUrl ? (
            <Card className="text-xs italic text-muted-foreground">Generating signed URL…</Card>
          ) : row.mime_type.startsWith('image/') ? (
            <Card className="p-0 overflow-hidden">
              <img src={signedUrl} alt={row.title} className="max-h-[600px] w-full object-contain bg-muted/40" />
            </Card>
          ) : row.mime_type === 'application/pdf' ? (
            <Card className="p-0 overflow-hidden">
              <iframe src={signedUrl} title={row.title} className="w-full h-[600px] border-0" />
            </Card>
          ) : row.mime_type.startsWith('audio/') ? (
            <Card>
              <audio controls src={signedUrl} className="w-full" />
            </Card>
          ) : (
            <Card className="text-xs text-muted-foreground">
              No inline preview for <span className="font-mono">{row.mime_type}</span>. Use Open file to download.
            </Card>
          )}
        </ObjectSection>

        <ObjectSection title="Chunks" icon="layers">
          {!row.chunks || row.chunks.length === 0 ? (
            <Callout intent={Intent.NONE} icon="info-sign">
              {row.ingestion_stage === 'raw'
                ? 'No chunks yet. Click Run ingestion above to extract per-page text via Anthropic vision.'
                : `Stage is ${row.ingestion_stage} but the row carries no chunks. Try Re-ingest.`}
            </Callout>
          ) : (
            <div className="space-y-1.5">
              {row.chunks.map((c) => (
                <Card key={c.chunk_id} className="text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag minimal intent={Intent.PRIMARY} className="text-[10px]">page {String(c.page)}</Tag>
                    <span className="font-mono text-[10px] text-muted-foreground">{c.chunk_id}</span>
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{c.text_preview}</p>
                </Card>
              ))}
            </div>
          )}
        </ObjectSection>

        {pendingSuggestions.length > 0 && (
          <ObjectSection title={`Suggestions (${String(pendingSuggestions.length)})`} icon="search-template">
            <div className="space-y-1.5">
              {pendingSuggestions.map((s) => {
                const borderClass =
                  s.confidence >= 0.85 ? 'border-l-emerald-500' :
                  s.confidence >= 0.65 ? 'border-l-amber-400'   :
                  'border-l-red-500'
                const busy = approve.isPending || reject.isPending
                return (
                  <Card key={s.id} className={`text-xs space-y-2 border-l-2 ${borderClass}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag minimal intent={Intent.PRIMARY} className="font-mono">{s.entity_type}</Tag>
                      <Tag minimal>{Math.round(s.confidence * 100)}%</Tag>
                      {s.chunk_key && <Tag minimal icon="layers">{s.chunk_key}</Tag>}
                      <Link to={objectPathFor(s.entity_type, s.entity_id)} className="font-mono hover:underline truncate">
                        {s.entity_id}
                      </Link>
                    </div>
                    <p>{s.reasoning}</p>
                    {s.evidence_snippet && (
                      <blockquote className="italic text-muted-foreground border-l-2 border-border/40 pl-3 leading-relaxed">
                        "{s.evidence_snippet}"
                      </blockquote>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="minimal"
                        size="small"
                        intent={Intent.DANGER}
                        icon="cross"
                        disabled={busy}
                        onClick={() => { reject.mutate(s) }}
                      >
                        Reject
                      </Button>
                      <Button
                        intent={Intent.PRIMARY}
                        size="small"
                        icon="tick"
                        loading={busy}
                        onClick={() => { approve.mutate(s) }}
                      >
                        Approve &amp; link
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </ObjectSection>
        )}

        <ObjectSection title="Linked entities" icon="link">
          {entityLinks.length === 0 ? (
            <Card className="text-xs italic text-muted-foreground">
              No entity links yet. Use Link to entity above to write a <span className="font-mono">describes_entity</span> edge from this document to a Variant / Supplier / Case / etc. Operators and agents can then cite this document as the source of truth for that node.
            </Card>
          ) : (
            <div className="space-y-1.5">
              {entityLinks.map((edge) => (
                <div key={edge.id} className="flex items-center gap-2 px-2 py-1.5 border border-border/40 rounded text-xs">
                  <Icon icon="link" size={11} className="text-muted-foreground" />
                  <Tag minimal intent={Intent.PRIMARY}>{edge.target_type}</Tag>
                  <Link to={objectPathFor(edge.target_type, edge.target_id)} className="font-mono hover:underline truncate">
                    {edge.target_id}
                  </Link>
                  <span className="flex-1" />
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(edge.created_at), { addSuffix: true })}</span>
                  <Button
                    variant="minimal"
                    size="small"
                    icon="cross"
                    intent={Intent.DANGER}
                    disabled={unlink.isPending}
                    onClick={() => { unlink.mutate(edge.id) }}
                  />
                </div>
              ))}
            </div>
          )}
        </ObjectSection>

        <ObjectSection title="Audit" icon="time">
          <Card className="text-xs space-y-1">
            <div>Uploaded by user <span className="font-mono">{row.uploaded_by_user_id}</span></div>
            <div>Created {new Date(row.created_at).toISOString()}</div>
            <div>Updated {new Date(row.updated_at).toISOString()}</div>
          </Card>
        </ObjectSection>
    </ObjectViewFrame>

      <LinkEntityDialog
        open={linkOpen}
        onClose={() => { setLinkOpen(false) }}
        pending={link.isPending}
        onSubmit={(entityType, entityId) => {
          link.mutate({ entityType, entityId }, { onSuccess: () => { setLinkOpen(false) } })
        }}
      />
    </>
  )
}

const ENTITY_TYPES: EntityNodeType[] = [
  'variant', 'supplier', 'purchase_order', 'restock_request',
  'product', 'hotel', 'organization', 'case',
]

function LinkEntityDialog({ open, onClose, onSubmit, pending }: {
  open: boolean
  onClose: () => void
  pending: boolean
  onSubmit: (entityType: EntityNodeType, entityId: string) => void
}) {
  const [type, setType] = useState<EntityNodeType>('variant')
  const [id, setId]     = useState('')
  return (
    <Dialog isOpen={open} onClose={onClose} title="Link document to entity" className="!w-[24rem]">
      <DialogBody>
        <p className="text-xs text-muted-foreground mb-2">
          Writes a <span className="font-mono">describes_entity</span> edge from this document to the target node. Operators and agents can then surface this document as the source of truth.
        </p>
        <div className="space-y-2">
          <HTMLSelect
            value={type}
            onChange={(e) => { setType(e.currentTarget.value as EntityNodeType) }}
            options={ENTITY_TYPES.map((t) => ({ value: t, label: t }))}
            fill
          />
          <InputGroup
            placeholder="Entity UUID"
            value={id}
            onChange={(e) => { setId(e.target.value) }}
            className="font-mono"
          />
        </div>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button variant="minimal" disabled={pending} onClick={onClose}>Cancel</Button>
            <Button
              intent={Intent.PRIMARY}
              icon="link"
              loading={pending}
              disabled={!id.trim()}
              onClick={() => { onSubmit(type, id.trim()) }}
            >
              Link
            </Button>
          </>
        }
      />
    </Dialog>
  )
}

function objectPathFor(type: EntityNodeType, id: string): string {
  switch (type) {
    case 'variant':         return `/variant/${id}`
    case 'supplier':        return `/supplier/${id}`
    case 'purchase_order':  return `/po/${id}`
    case 'restock_request': return `/restock/${id}`
    case 'product':         return `/product/${id}`
    case 'case':            return `/cases/${id}`
    case 'hotel':           return `/hotel/${id}`
    case 'organization':    return `/`
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function stageIntent(stage: IngestionStage): Intent {
  switch (stage) {
    case 'raw':            return Intent.NONE
    case 'ocr':
    case 'embedded':       return Intent.PRIMARY
    case 'contextualized': return Intent.WARNING
    case 'linked':         return Intent.SUCCESS
  }
}

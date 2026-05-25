// Document Object View — metadata + signed-URL preview for one uploaded file.
// Uniform anatomy: header → metric strip → action bar → body sections.

import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Callout, Card, Icon, Intent, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import {
  useDeleteDocument,
  useDocument,
  useSignedDocumentUrl,
} from '@/features/documents/hooks'
import type { IngestionStage } from '@/features/documents/api'

export default function DocumentObjectPage() {
  const { documentId = '' } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { data: row, isLoading } = useDocument(documentId)
  const { data: signedUrl } = useSignedDocumentUrl(row?.storage_path)
  const del = useDeleteDocument()

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
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link to="/documents" className="text-xs text-muted-foreground hover:text-foreground">Documents</Link>
          <Icon icon="chevron-right" size={10} className="text-muted-foreground" />
          <Icon icon="document" size={14} className="text-violet-500" />
          <h1 className="text-sm font-semibold truncate">{row.title}</h1>
          <Tag minimal>{row.source}</Tag>
          <Tag minimal intent={stageIntent(row.ingestion_stage)}>{row.ingestion_stage}</Tag>
        </div>
        <p className="text-[11px] text-muted-foreground font-mono">{row.id}</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border shrink-0">
        <Metric label="Source"   value={row.source} />
        <Metric label="Stage"    value={row.ingestion_stage} />
        <Metric label="Size"     value={formatBytes(row.size_bytes)} />
        <Metric label="Uploaded" value={formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} />
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-3 border-b shrink-0">
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Section title="File" icon="document">
          <Card className="space-y-1 text-xs">
            <div className="font-mono"><span className="text-muted-foreground">MIME:</span> {row.mime_type}</div>
            <div className="font-mono break-all"><span className="text-muted-foreground">Path:</span> {row.bucket_name}/{row.storage_path}</div>
            {row.page_count != null && (
              <div className="font-mono"><span className="text-muted-foreground">Pages:</span> {String(row.page_count)}</div>
            )}
          </Card>
        </Section>

        <Section title="Preview" icon="eye-open">
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
        </Section>

        <Section title="Ingestion pipeline" icon="layers">
          <Callout intent={Intent.NONE} icon="info-sign">
            Stage is <span className="font-mono">{row.ingestion_stage}</span>. The OCR / Vision / Whisper pipeline + chunk extraction + cited_in edge writers arrive in Phase 16.b. The <span className="font-mono">chunks</span> column is reserved so the upgrade is additive.
          </Callout>
        </Section>

        <Section title="Audit" icon="time">
          <Card className="text-xs space-y-1">
            <div>Uploaded by user <span className="font-mono">{row.uploaded_by_user_id}</span></div>
            <div>Created {new Date(row.created_at).toISOString()}</div>
            <div>Updated {new Date(row.updated_at).toISOString()}</div>
          </Card>
        </Section>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-semibold capitalize">{value}</div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: 'document' | 'eye-open' | 'layers' | 'time'; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
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

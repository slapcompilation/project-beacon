// Documents index — every uploaded file with its source + ingestion stage.
// OCR / chunk extraction land in Phase 16.b; for now every row is in 'raw'.

import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Button, Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { useDocuments, useUploadDocument } from '@/features/documents/hooks'
import type { DocumentRow, IngestionStage } from '@/features/documents/api'

export default function DocumentsPage() {
  const { data: rows = [], isLoading, isError, refetch, isFetching } = useDocuments()
  const upload = useUploadDocument()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File | null) => {
    if (!file) return
    upload.mutate({ file })
    if (fileRef.current) fileRef.current.value = ''
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }
  if (isError) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to load documents"
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }

  const totalBytes = rows.reduce((s, r) => s + r.size_bytes, 0)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            Documents
            {rows.length > 0 && <Tag minimal>{String(rows.length)}</Tag>}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Source files for the ontology. Phase 16.a stores raw uploads; OCR + chunk extraction + cited_in edges arrive in Phase 16.b.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{formatBytes(totalBytes)}</span> stored
          </span>
          <Button variant="minimal" size="small" icon="refresh" loading={isFetching} onClick={() => { void refetch() }}>Refresh</Button>
          <Button
            intent={Intent.PRIMARY}
            icon="upload"
            loading={upload.isPending}
            onClick={() => { fileRef.current?.click() }}
          >
            Upload
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => { handleFile(e.target.files?.[0] ?? null) }}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {rows.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="document" size={32} className="text-muted-foreground/40" />}
            title="No documents yet"
            description="Upload a PDF, image, audio file, or text document above. Operators and agents will be able to cite it from page-level chunks once Phase 16.b lands."
          />
        ) : (
          rows.map((row) => <DocumentRowCard key={row.id} row={row} />)
        )}
      </div>

      {rows.length > 0 && (
        <div className="shrink-0 border-t px-4 py-2 bg-muted/20 text-[10px] text-muted-foreground">
          Bucket: <span className="font-mono">documents</span> (private, signed URLs only). Allowed types: pdf · images · audio · text · docx · xlsx. 50 MB per file.
        </div>
      )}
    </div>
  )
}

function DocumentRowCard({ row }: { row: DocumentRow }) {
  return (
    <Link to={`/documents/${row.id}`}>
      <Card interactive className="flex items-start gap-3 hover:bg-surface-2">
        <Icon icon={iconForMime(row.mime_type)} size={20} className="text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{row.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <Tag minimal>{row.source}</Tag>
            <Tag minimal intent={stageIntent(row.ingestion_stage)}>{row.ingestion_stage}</Tag>
            <span>{row.mime_type}</span>
            <span>·</span>
            <span>{formatBytes(row.size_bytes)}</span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        {row.page_count != null && (
          <span className="text-[11px] text-muted-foreground shrink-0">
            {String(row.page_count)} page{row.page_count === 1 ? '' : 's'}
          </span>
        )}
      </Card>
    </Link>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function iconForMime(mime: string): 'document' | 'media' | 'volume-up' | 'th' {
  if (mime.startsWith('image/')) return 'media'
  if (mime.startsWith('audio/')) return 'volume-up'
  if (mime === 'application/pdf') return 'document'
  if (mime.includes('sheet') || mime === 'text/csv') return 'th'
  return 'document'
}

function stageIntent(stage: IngestionStage): Intent {
  switch (stage) {
    case 'raw':              return Intent.NONE
    case 'ocr':              return Intent.PRIMARY
    case 'embedded':         return Intent.PRIMARY
    case 'contextualized':   return Intent.WARNING
    case 'linked':           return Intent.SUCCESS
  }
}

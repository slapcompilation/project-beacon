// Uploading a file into a dataset.
//
// Foundry's own step is "Drag and drop the file into the dataset preview
// window" (mirror/dataset-preview/overview.md), so the drop target is the
// control and the file picker is the fallback rather than the other way round.
//
// Nothing here chooses a transaction type. The rule is the server's: the same
// filename with the same schema is an UPDATE, a different filename an APPEND,
// and a same-filename different-schema upload is refused by name because no
// page defines it. A control that let someone pick would be inventing a choice
// the product does not offer.

import { useRef, useState } from 'react'
import { Button, Card, Icon, Spinner, SpinnerSize } from '@blueprintjs/core'
import { UPLOAD_ACCEPT, useUploadFile } from './api'

export function UploadCard({ datasetId, branchName }: { datasetId: string; branchName: string }) {
  const upload = useUploadFile(datasetId, branchName)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const send = (files: FileList | null) => {
    if (!files) return
    // One transaction per file: a branch may hold only one open transaction at
    // a time, so they go in sequence rather than at once.
    void Array.from(files).reduce(
      (chain, f) => chain.then(() => upload.mutateAsync(f).then(() => undefined)),
      Promise.resolve(),
    )
  }

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40">
        <Icon icon="upload" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">Upload</span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">{branchName}</span>
      </div>

      <div
        className={`m-3 rounded border border-dashed px-4 py-6 text-center transition-colors ${
          over ? 'border-primary bg-muted' : 'border-border'
        }`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => { setOver(false) }}
        onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files) }}
      >
        {upload.isPending ? (
          <span className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} /> Parsing and committing…
          </span>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Drag a <code>.csv</code> or <code>.tsv</code> here, and its schema is inferred.
            </p>
            <Button size="small" variant="outlined" icon="document-open" className="mt-2"
              onClick={() => { input.current?.click() }}>
              Choose a file
            </Button>
          </>
        )}
        <input ref={input} type="file" accept={UPLOAD_ACCEPT} multiple className="hidden"
          onChange={(e) => { send(e.currentTarget.files); e.currentTarget.value = '' }} />
      </div>

      <p className="px-3 pb-2 text-[10px] text-muted-foreground">
        A new filename is appended; re-uploading one replaces it. Inference is a suggestion — Foundry
        says results should be validated — and a row with the wrong number of fields fails the upload
        rather than being filled in.
      </p>
    </Card>
  )
}

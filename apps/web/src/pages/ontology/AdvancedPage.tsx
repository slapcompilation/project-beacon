// The Advanced settings page, which in Ontology Manager holds exactly two
// things: Export and Import of the working state.
//
// "You can export your Ontology working state by selecting the Advanced
//  settings page from the application's home page and then selecting Export."
//
// The file is downloaded and re-uploaded by the browser rather than stored
// anywhere: it is a JSON file a person edits in a text editor, which is the
// first of the two workflows the page names.
import { useRef, useState } from 'react'
import { Button, Callout, Card, Intent } from '@blueprintjs/core'
import { toast } from 'sonner'
import { exportWorkingState, importWorkingState, type Json } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import { useOmaOntology } from '@/features/ontologyManager/resources'

export default function AdvancedPage() {
  const { ontology } = useOmaOntology()
  const ontologyId = ontology?.id ?? null
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const doExport = async () => {
    if (ontologyId === null) return
    setBusy(true)
    try {
      const state = await client(exportWorkingState)
        .executeFunction({ p_ontology: ontologyId }) as Record<string, unknown>
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `ontology-working-state-${ontologyId}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      const n = Array.isArray(state.changes) ? state.changes.length : 0
      toast.success(`Exported ${n} change${n === 1 ? '' : 's'}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setBusy(false) }
  }

  const doImport = async (f: File) => {
    setBusy(true)
    try {
      const parsed = JSON.parse(await f.text()) as Json
      const n = await client(importWorkingState).applyAction({ p_file: parsed })
      // "You will see the number of changes made in the file that need to be
      // saved in the application header."
      toast.success(`Imported ${String(n)} change${n === 1 ? '' : 's'} — save them to apply`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">Advanced</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Export the working state as JSON, edit it in a text editor, and import it back.
        </p>
      </div>

      <Card compact className="space-y-2">
        <h3 className="text-sm font-semibold">Export</h3>
        <p className="text-xs text-muted-foreground">
          Any changes in your working state are included — saved changes are not, because they
          are already in the ontology.
        </p>
        <Button icon="export" onClick={() => { void doExport() }}
          disabled={ontologyId === null || busy}>Export</Button>
      </Card>

      <Card compact className="space-y-2">
        <h3 className="text-sm font-semibold">Import</h3>
        <Callout intent={Intent.WARNING} className="!text-xs">
          Import recreates the <strong>entire</strong> working state from the file. Any unsaved
          changes you have now are replaced.
        </Callout>
        <input ref={file} type="file" accept="application/json" className="hidden"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0]
            if (f) void doImport(f)
          }} />
        <Button icon="import" onClick={() => { file.current?.click() }} disabled={busy}>
          Choose a file…
        </Button>
        <p className="text-xs text-muted-foreground">
          A working state cannot be imported into a different ontology: its changes name
          resources by id, so the ids would not exist there.
        </p>
      </Card>
    </div>
  )
}

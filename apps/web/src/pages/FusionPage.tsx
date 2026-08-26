// Fusion — the spreadsheet list, and one spreadsheet as a grid.
//
// "A Fusion spreadsheet looks and behaves like other spreadsheet
// applications, meaning that you can type anything anywhere, use cell
// references and functions" (fusion/sheets-overview) — so the grid is the
// surface, with sheet tabs beneath it and a Data menu for the sync.
//
// Formulas are shown, not computed: the function library holds 202
// functions and none is built, which the grid says rather than pretending.

import { useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, HTMLSelect, Icon, InputGroup,
  Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/projects/api'
import { useDatasets } from '@/features/datasets/api'
import {
  useSpreadsheets, useBookContents, useCreateSpreadsheet, useSetCell, useAddSheet,
  useCreateRegion, useSetRegionDataset, useSortRegion, useSyncRegion,
  type Spreadsheet, type BookContents, type TableRegion,
} from '@/features/fusion/api'

const COLS = 12
const ROWS = 24
const colName = (i: number) => String.fromCharCode(65 + i)

export default function FusionPage() {
  const { data: books = [], isLoading } = useSpreadsheets()
  const [params, setParams] = useSearchParams()
  const openId = params.get('s')
  const open = books.find((b) => b.id === openId) ?? null

  if (open) return <SpreadsheetView book={open} onClose={() => { setParams({}) }} />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Fusion</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              A spreadsheet whose table regions sync to datasets — so a sheet of numbers becomes
              something the rest of the platform can build on.
            </p>
          </div>
          <NewSpreadsheetButton />
        </header>

        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : books.length === 0 ? (
          <NonIdealState icon="th" title="No spreadsheets yet"
            description="A spreadsheet lives in a project. Its table regions can sync to datasets other applications consume." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {books.map((b) => (
              <Card key={b.id} interactive compact onClick={() => { setParams({ s: b.id }) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="th" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{b.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{b.rid}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewSpreadsheetButton() {
  const { data: projects = [] } = useProjects()
  const create = useCreateSpreadsheet()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')
  return (
    <>
      <Button intent={Intent.PRIMARY} icon="add" onClick={() => { setOpen(true) }}>
        New spreadsheet
      </Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New spreadsheet">
        <DialogBody>
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="fu-label">Name</span>
              <InputGroup value={name} placeholder="Trip log"
                onChange={(e) => { setName(e.currentTarget.value) }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="fu-label">Project</span>
              <HTMLSelect value={projectId} onChange={(e) => { setProjectId(e.currentTarget.value) }}>
                <option value="">Pick a project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </HTMLSelect>
            </label>
            <Button intent={Intent.PRIMARY} icon="tick" loading={create.isPending}
              disabled={name.trim() === '' || projectId === ''}
              onClick={() => {
                create.mutate({ projectId, name: name.trim() },
                  { onSuccess: () => { setOpen(false); setName('') } })
              }}>Create</Button>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

function SpreadsheetView({ book, onClose }: { book: Spreadsheet; onClose: () => void }) {
  const { data: contents } = useBookContents(book.id)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const addSheet = useAddSheet(book.id)

  if (!contents) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  const sheet = contents.sheets.find((s) => s.id === sheetId) ?? contents.sheets.at(0) ?? null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="fu-header">
        <Button variant="minimal" size="small" icon="arrow-left" onClick={onClose} />
        <Icon icon="th" size={14} className="text-violet-500" />
        <span className="fu-title">{book.name}</span>
        {sheet && <DataMenu book={book} contents={contents} sheetId={sheet.id} />}
      </div>

      {sheet === null ? (
        <NonIdealState icon="th" title="No sheets" />
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-auto">
            <Grid book={book} contents={contents} sheetId={sheet.id} />
          </div>
          <div className="fu-sheettabs">
            {contents.sheets.map((s) => (
              <Button key={s.id} size="small"
                variant={s.id === sheet.id ? undefined : 'minimal'}
                onClick={() => { setSheetId(s.id) }}>{s.name}</Button>
            ))}
            <Button size="small" variant="minimal" icon="add" loading={addSheet.isPending}
              onClick={() => {
                addSheet.mutate({ name: `Sheet${String(contents.sheets.length + 1)}`,
                  position: contents.sheets.length })
              }} />
          </div>
        </>
      )}
    </div>
  )
}

function Grid({ book, contents, sheetId }: {
  book: Spreadsheet; contents: BookContents; sheetId: string
}) {
  const setCell = useSetCell(book.id)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const at = (r: number, c: number) =>
    contents.cells.find((x) => x.sheetId === sheetId && x.row === r && x.col === c)
  const regions = contents.regions.filter((r) => r.sheetId === sheetId)
  const inRegion = (r: number, c: number) => regions.find((reg) =>
    r >= reg.topRow && r < reg.topRow + reg.rowCount
    && c >= reg.leftCol && c < reg.leftCol + Math.max(reg.columns.length, 1))

  return (
    <table className="fu-grid">
      <thead>
        <tr>
          <th className="fu-corner" />
          {Array.from({ length: COLS }, (_, c) => <th key={c}>{colName(c)}</th>)}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: ROWS }, (_, r) => (
          <tr key={r}>
            <th className="fu-rowhead">{r + 1}</th>
            {Array.from({ length: COLS }, (_, c) => {
              const cell = at(r, c)
              const key = `${String(r)}:${String(c)}`
              const reg = inRegion(r, c)
              const isFormula = (cell?.raw ?? '').startsWith('=')
              return (
                <td key={c}
                  className={`${reg ? 'fu-in-region' : ''} ${cell?.cellType === 'number' ? 'fu-num' : ''}`}
                  onClick={() => { setEditing(key); setDraft(cell?.raw ?? '') }}>
                  {editing === key ? (
                    <input className="fu-input" autoFocus value={draft}
                      onChange={(e) => { setDraft(e.currentTarget.value) }}
                      onBlur={() => {
                        if (draft !== (cell?.raw ?? '')) {
                          setCell.mutate({ sheetId, row: r, col: c, raw: draft })
                        }
                        setEditing(null)
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
                  ) : (
                    <span className={isFormula ? 'fu-formula' : ''}
                      title={isFormula ? 'Formulas are stored, not computed here' : undefined}>
                      {cell?.raw ?? ''}
                    </span>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The Data menu: create a table region, sort it, and sync it to a dataset. */
function DataMenu({ book, contents, sheetId }: {
  book: Spreadsheet; contents: BookContents; sheetId: string
}) {
  const { data: datasets = [] } = useDatasets()
  const createRegion = useCreateRegion(book.id)
  const setTarget = useSetRegionDataset(book.id)
  const sort = useSortRegion(book.id)
  const sync = useSyncRegion(book.id)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [rows, setRows] = useState('4')
  const [cols, setCols] = useState('city, miles')
  const regions = contents.regions.filter((r) => r.sheetId === sheetId)
  const synced = regions.find((r) => r.datasetId !== null) ?? null

  return (
    <>
      <Button size="small" variant="minimal" icon="database" className="ml-auto"
        onClick={() => { setOpen(true) }}>Data</Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="Data" className="fu-dialog">
        <DialogBody>
          <div className="space-y-3">
            <p className="fu-label">Table regions</p>
            {regions.length === 0 && <p className="fu-hint">No table regions on this sheet yet.</p>}
            {regions.map((r) => (
              <RegionRow key={r.id} region={r} datasets={datasets}
                onTarget={(dsId) => { setTarget.mutate({ id: r.id, datasetId: dsId }) }}
                onSort={(col, desc) => { sort.mutate({ regionId: r.id, column: col, descending: desc }) }}
                onSync={() => { sync.mutate(r.id) }}
                syncing={sync.isPending} sorting={sort.isPending} />
            ))}

            {synced === null && (
              <Card compact className="space-y-2">
                <p className="fu-label">New table region</p>
                <InputGroup size="small" value={name} placeholder="trips"
                  onChange={(e) => { setName(e.currentTarget.value) }} />
                <div className="flex gap-2">
                  <InputGroup size="small" value={rows} placeholder="rows including header"
                    onChange={(e) => { setRows(e.currentTarget.value) }} />
                  <InputGroup size="small" value={cols} placeholder="column names, comma separated"
                    onChange={(e) => { setCols(e.currentTarget.value) }} />
                </div>
                <Button size="small" icon="add" loading={createRegion.isPending}
                  disabled={name.trim() === ''}
                  onClick={() => {
                    createRegion.mutate({
                      sheetId, name: name.trim(), topRow: 0, leftCol: 0,
                      rowCount: Math.max(Number(rows) || 2, 2),
                      columns: cols.split(',').map((c) => ({ name: c.trim(), type: 'STRING' }))
                        .filter((c) => c.name !== ''),
                    }, { onSuccess: () => { setName('') } })
                  }}>Create region</Button>
              </Card>
            )}
            {synced !== null && (
              <Callout intent={Intent.PRIMARY} icon="info-sign" className="!text-xs">
                One sync per sheet: a sheet sync or a table sync, never both.
                “{synced.name}” already syncs here.
              </Callout>
            )}
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

function RegionRow({ region, datasets, onTarget, onSort, onSync, syncing, sorting }: {
  region: TableRegion
  datasets: { id: string; name: string }[]
  onTarget: (id: string | null) => void
  onSort: (column: number, descending: boolean) => void
  onSync: () => void
  syncing: boolean
  sorting: boolean
}) {
  const [col, setCol] = useState('0')
  return (
    <Card compact className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon="th-derived" size={12} className="text-muted-foreground" />
        <span className="text-xs font-semibold">{region.name}</span>
        <Tag minimal className="!text-[9px]">{region.rowCount} rows</Tag>
        <Tag minimal className="!text-[9px]">{region.columns.length} cols</Tag>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <HTMLSelect value={col} onChange={(e) => { setCol(e.currentTarget.value) }}>
          {region.columns.map((c, i) => (
            <option key={c.name} value={String(i)}>{c.name}</option>
          ))}
        </HTMLSelect>
        <Button size="small" icon="sort-asc" loading={sorting}
          onClick={() => { onSort(Number(col), false) }}>Sort</Button>
        <span className="fu-hint">
          A sort rearranges the rows themselves — it cannot be turned off.
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <HTMLSelect value={region.datasetId ?? ''}
          onChange={(e) => { onTarget(e.currentTarget.value || null) }}>
          <option value="">Not synced</option>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </HTMLSelect>
        <Button size="small" intent={Intent.PRIMARY} icon="cloud-upload" loading={syncing}
          disabled={region.datasetId === null} onClick={onSync}>Sync to dataset</Button>
      </div>
    </Card>
  )
}

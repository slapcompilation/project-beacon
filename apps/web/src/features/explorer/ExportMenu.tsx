// "Export: Ways to export your object set, such as exporting to Excel or
// copying object IDs to your clipboard, appear here." (apply-actions.md)
// Ours are the two named: a CSV download (Excel's lingua franca) of the
// filtered rows as loaded, and the object IDs to the clipboard.

import { Button, Menu, MenuItem, Popover } from '@blueprintjs/core'
import { toast } from 'sonner'
import type { PropertyRow } from '@/features/objectTypes/api'
import type { ObjectRow } from './api'

const csvField = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function ExportMenu({ rows, pks, typeLabel, props }: {
  rows: ObjectRow[]
  pks: string[]
  typeLabel: string
  props: PropertyRow[]
}) {
  const downloadCsv = () => {
    const cols = props.map((p) => p.property_id)
    const csv = [
      props.map((p) => csvField(p.display_name)).join(','),
      ...rows.map((r) => cols.map((c) => csvField(r[c])).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${typeLabel.toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyIds = () => {
    void navigator.clipboard.writeText(pks.join('\n')).then(() => {
      toast.success(`${pks.length} object ID${pks.length === 1 ? '' : 's'} copied`)
    })
  }

  return (
    <Popover content={
      <Menu>
        <MenuItem icon="th-derived" text={`Export CSV (${rows.length} rows)`}
          disabled={rows.length === 0} onClick={downloadCsv} />
        <MenuItem icon="clipboard" text={`Copy ${pks.length} object ID${pks.length === 1 ? '' : 's'}`}
          disabled={pks.length === 0} onClick={copyIds} />
      </Menu>
    }>
      <Button icon="export" endIcon="caret-down">Export</Button>
    </Popover>
  )
}

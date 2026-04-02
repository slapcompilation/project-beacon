/**
 * Print-based PDF export — zero external dependencies.
 * Opens a new window, writes a minimal HTML page with a table,
 * triggers window.print(), then closes after the dialog dismisses.
 */
export function exportToPdf(
  title: string,
  columns: string[],
  rows: (string | number)[][]
): void {
  const escape = (v: string | number) =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const thead = `<tr>${columns.map((c) => `<th>${escape(c)}</th>`).join('')}</tr>`
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escape(c)}</td>`).join('')}</tr>`)
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escape(title)}</title>
  <style>
    body { font-family: sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 16px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${escape(title)}</h1>
  <table>
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  win.document.write(html)
  win.document.close()
}

// ─── Purchase order ───────────────────────────────────────────────────────────

export interface PurchaseOrderLine {
  supplier: string | null
  product: string
  variant: string
  quantity: number
  notes: string | null
}

export function printPurchaseOrder(hotelName: string, lines: PurchaseOrderLine[]): void {
  const escape = (v: string | number | null) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  // Group by supplier (null supplier → "No Supplier")
  const groups = new Map<string, PurchaseOrderLine[]>()
  for (const line of lines) {
    const key = line.supplier?.trim() || 'No Supplier'
    const existing = groups.get(key) ?? []
    existing.push(line)
    groups.set(key, existing)
  }

  const sections = [...groups.entries()]
    .map(([supplier, rows]) => {
      const tableRows = rows
        .map(
          (r) =>
            `<tr>
              <td>${escape(r.product)}</td>
              <td>${escape(r.variant)}</td>
              <td style="text-align:right">${escape(r.quantity)}</td>
              <td>${escape(r.notes)}</td>
            </tr>`
        )
        .join('')

      return `
        <h2>${escape(supplier)}</h2>
        <table>
          <thead>
            <tr><th>Product</th><th>Variant</th><th style="text-align:right">Qty</th><th>Notes</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>`
    })
    .join('<br/>')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Purchase Order — ${escape(hotelName)}</title>
  <style>
    body { font-family: sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 11px; margin-bottom: 20px; }
    h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ddd; padding: 5px 7px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Purchase Order</h1>
  <p class="meta">${escape(hotelName)} &nbsp;·&nbsp; ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
  ${sections}
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  win.document.write(html)
  win.document.close()
}

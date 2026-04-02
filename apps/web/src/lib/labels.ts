import QRCode from 'qrcode'

export interface LabelVariant {
  sku: string
  name: string
  productName: string
}

/**
 * Generates PNG QR codes via qrcode.toDataURL (no canvas/DOM needed),
 * builds a print-ready HTML page, and opens window.print().
 */
export async function printVariantLabels(variants: LabelVariant[]): Promise<void> {
  if (variants.length === 0) return

  const items = await Promise.all(
    variants.map(async (v) => ({
      ...v,
      qrDataUrl: await QRCode.toDataURL(v.sku, {
        width: 80,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      }),
    }))
  )

  const cells = items
    .map(
      (item) => `
      <div style="border:1px solid #ccc;border-radius:6px;padding:8px;display:flex;align-items:center;gap:8px;page-break-inside:avoid;">
        <img src="${item.qrDataUrl}" width="80" height="80" />
        <div style="font-size:11px;line-height:1.4;">
          <div style="font-weight:700;">${item.productName}</div>
          ${item.name ? `<div style="color:#555;">${item.name}</div>` : ''}
          <div style="font-family:monospace;margin-top:2px;">${item.sku}</div>
        </div>
      </div>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Labels</title>
  <style>
    body { margin: 16px; font-family: sans-serif; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="grid">${cells}</div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  win.document.write(html)
  win.document.close()
}

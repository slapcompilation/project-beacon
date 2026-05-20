import { Intent, Tag } from '@blueprintjs/core'
import { getStockStatus, type ProductVariant } from '@beacon/types'

interface StockBadgeProps {
  variants: ProductVariant[]
}

export function StockBadge({ variants }: StockBadgeProps) {
  const status = getStockStatus(variants)
  const intent =
    status === 'in_stock'  ? Intent.SUCCESS :
    status === 'low_stock' ? Intent.WARNING :
    Intent.DANGER

  return (
    <Tag minimal intent={intent} className="!font-medium">
      {status === 'in_stock' && 'In Stock'}
      {status === 'low_stock' && 'Low Stock'}
      {status === 'out_of_stock' && 'Out of Stock'}
    </Tag>
  )
}

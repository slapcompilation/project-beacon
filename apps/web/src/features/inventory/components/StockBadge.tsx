import { Badge } from '@/components/ui/badge'
import { getStockStatus, type ProductVariant } from '@beacon/types'
import { cn } from '@/lib/utils'

interface StockBadgeProps {
  variants: ProductVariant[]
}

export function StockBadge({ variants }: StockBadgeProps) {
  const status = getStockStatus(variants)

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        status === 'in_stock' && 'border-green-200 bg-green-50 text-green-700',
        status === 'low_stock' && 'border-yellow-200 bg-yellow-50 text-yellow-700',
        status === 'out_of_stock' && 'border-red-200 bg-red-50 text-red-700'
      )}
    >
      {status === 'in_stock' && 'In Stock'}
      {status === 'low_stock' && 'Low Stock'}
      {status === 'out_of_stock' && 'Out of Stock'}
    </Badge>
  )
}

// Layer: Eye — aggregates intelligence signals into a single alert count for nav badge
import { useMemo } from 'react'
import { useProducts, useExpiringVariants } from '@/features/inventory/hooks'
import { useNotifications } from '@/features/notifications/hooks'

/**
 * Returns the number of items that currently need attention:
 * - Expiring within 30 days
 * - Out-of-stock or low-stock variants
 * - Unread notifications
 *
 * Used to drive the badge on the Alerts nav link.
 */
export function useAlertCount(): number {
  const { data: products = [] } = useProducts()
  const { data: expiring = [] } = useExpiringVariants(30)
  const { data: notifications = [] } = useNotifications()

  return useMemo(() => {
    let count = expiring.length

    for (const product of products) {
      for (const variant of product.product_variants) {
        if (
          variant.current_stock === 0 ||
          (variant.low_stock_threshold > 0 && variant.current_stock <= variant.low_stock_threshold)
        ) {
          count++
        }
      }
    }

    count += notifications.filter((n) => !n.read).length

    return count
  }, [products, expiring, notifications])
}

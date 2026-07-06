// Layer: Cross-domain — Product Object Page
// Palantir-pattern: product is the parent entity of all variants. This page shows
// the full product context: all variants, aggregate stock, category, cost profile.
// Route: /product/:productId
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Button,
  Card,
  Icon,
  Intent,
  NonIdealState,
  Tag,
} from '@blueprintjs/core'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Product, ProductVariant, Category } from '@beacon/types'
import { stockUrgency } from '@beacon/reality-graph'
import { getTotalStock, getStockStatus } from '@beacon/types'
import { ObjectViewFrame } from '@/components/ObjectViewFrame'
import { Metric } from '@/components/MetricStrip'
import { AuditRail } from '@/components/AuditRail'

// ─── Local types ──────────────────────────────────────────────────────────────

interface ProductWithContext extends Product {
  categories: Pick<Category, 'id' | 'name'> | null
  product_variants: (ProductVariant & {
    locations: { name: string } | null
  })[]
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchProductWithVariants(productId: string): Promise<ProductWithContext | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(id, name), product_variants(*, locations(name))')
    .eq('id', productId)
    .single() as unknown as {
      data: ProductWithContext | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const URGENCY_INTENT: Record<ReturnType<typeof stockUrgency>, Intent> = {
  critical:    Intent.DANGER,
  low:         Intent.WARNING,
  ok:          Intent.SUCCESS,
  overstocked: Intent.PRIMARY,
}

const URGENCY_LABEL: Record<ReturnType<typeof stockUrgency>, string> = {
  critical:    'Critical',
  low:         'Low',
  ok:          'OK',
  overstocked: 'Full',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProductObjectPage() {
  const { productId = '' } = useParams<{ productId: string }>()
  const navigate      = useNavigate()

  const { data: product, isLoading, error } = useQuery({
    queryKey:  ['product-object', productId],
    queryFn:   () => fetchProductWithVariants(productId),
    enabled:   !!productId,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading product…
      </div>
    )
  }

  if (error || !product) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Product not found"
        description="Product not found or access denied."
        action={
          <Button variant="minimal" intent={Intent.PRIMARY} onClick={() => { void navigate(-1) }}>
            ← Go back
          </Button>
        }
      />
    )
  }

  const variants     = product.product_variants
  const totalStock   = getTotalStock(variants)
  const stockStatus  = getStockStatus(variants)
  const totalValue   = variants.reduce((s, v) => s + v.current_stock * v.cost, 0)
  const criticalCount = variants.filter((v) => stockUrgency(v) === 'critical').length
  const lowCount      = variants.filter((v) => stockUrgency(v) === 'low').length

  const stockTagIntent =
    stockStatus === 'out_of_stock' ? Intent.DANGER :
    stockStatus === 'low_stock'    ? Intent.WARNING :
                                     Intent.SUCCESS

  return (
    <ObjectViewFrame
      header={{
        breadcrumb: { label: 'Inventory', to: '/graph' },
        icon: 'box',
        title: product.name,
        star: { id: `product:${productId}`, label: product.name, path: `/product/${productId}`, icon: 'box' },
        tags: (
          <>
            <Tag intent={stockTagIntent} minimal>
              {stockStatus === 'out_of_stock' ? 'OUT OF STOCK' :
               stockStatus === 'low_stock'    ? 'LOW STOCK' : 'IN STOCK'}
            </Tag>
            {product.categories && <Tag minimal icon="tag">{product.categories.name}</Tag>}
            {!product.enabled && <Tag minimal>DISABLED</Tag>}
          </>
        ),
        id: product.sku,
      }}

      metrics={
        <>
        <Metric label="Total Stock" value={totalStock} sub={`across ${variants.length} variant${variants.length !== 1 ? 's' : ''}`} accent={totalStock === 0 ? 'red' : undefined} />
        <Metric label="Stock Value" value={`€${totalValue.toFixed(2)}`} sub={`@ €${product.cost.toFixed(2)} / unit`} />
        <Metric
          label="Attention"
          value={criticalCount > 0 ? criticalCount : lowCount > 0 ? lowCount : '—'}
          sub={criticalCount > 0 ? 'critical variant' + (criticalCount > 1 ? 's' : '') : lowCount > 0 ? 'low variant' + (lowCount > 1 ? 's' : '') : 'All variants OK'}
          accent={criticalCount > 0 ? 'red' : lowCount > 0 ? 'amber' : 'green'}
        />
        <Metric label="Variants" value={variants.length} sub={`${variants.filter((v) => v.enabled).length} enabled`} />
        </>
      }
      rail={<AuditRail nodeType="product" nodeId={productId} />}
    >

        {/* Description */}
        {product.description && (
          <Card compact className="!bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Description</p>
            <p className="text-xs text-foreground leading-relaxed">{product.description}</p>
          </Card>
        )}

        {/* Tags */}
        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <Tag key={tag} icon="tag" minimal>{tag}</Tag>
            ))}
          </div>
        )}

        {/* Variants table */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Variants ({variants.length})
          </h2>
          {variants.length === 0 ? (
            <Card compact className="!bg-muted/20 text-center">
              <p className="text-sm text-muted-foreground">No variants defined for this product.</p>
            </Card>
          ) : (
            <Card compact className="!p-0 divide-y">
              {variants.map((v) => {
                const urgency = stockUrgency(v)
                return (
                  <Link
                    key={v.id}
                    to={`/variant/${v.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{v.name}</span>
                        <Tag intent={URGENCY_INTENT[urgency]} minimal>
                          {URGENCY_LABEL[urgency]}
                        </Tag>
                        {!v.enabled && (
                          <span className="text-[10px] text-muted-foreground">disabled</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="font-mono">{v.sku}</span>
                        {v.locations && (
                          <span className="flex items-center gap-0.5">
                            <Icon icon="map-marker" size={10} />
                            {v.locations.name}
                          </span>
                        )}
                        {v.unit_of_measure && <span>{v.unit_of_measure}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn(
                        'text-sm font-bold font-mono tabular-nums',
                        urgency === 'critical' ? 'text-red-600' :
                        urgency === 'low'      ? 'text-amber-600' : 'text-foreground',
                      )}>
                        {v.current_stock}
                      </div>
                      {v.low_stock_threshold > 0 && (
                        <div className="text-[10px] text-muted-foreground">PAR {v.low_stock_threshold}</div>
                      )}
                    </div>
                    <Icon icon="chevron-right" size={14} className="text-muted-foreground/40 shrink-0" />
                  </Link>
                )
              })}
            </Card>
          )}
        </div>

        {/* Metadata */}
        <Card compact className="!p-0 divide-y text-xs">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Product ID</span>
            <span className="font-mono text-[10px]">{product.id}</span>
          </div>
          {product.categories && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Category</span>
              <span>{product.categories.name}</span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Created</span>
            <span>{formatDistanceToNow(new Date(product.created_at), { addSuffix: true })}</span>
          </div>
        </Card>
    </ObjectViewFrame>
  )
}

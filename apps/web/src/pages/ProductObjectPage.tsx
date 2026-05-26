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
  const { productId } = useParams<{ productId: string }>()
  const navigate      = useNavigate()

  const { data: product, isLoading, error } = useQuery({
    queryKey:  ['product-object', productId],
    queryFn:   () => fetchProductWithVariants(productId!),
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

  const variants     = product.product_variants ?? []
  const totalStock   = getTotalStock(variants)
  const stockStatus  = getStockStatus(variants)
  const totalValue   = variants.reduce((s, v) => s + v.current_stock * (v.cost ?? 0), 0)
  const criticalCount = variants.filter((v) => stockUrgency(v) === 'critical').length
  const lowCount      = variants.filter((v) => stockUrgency(v) === 'low').length

  const stockTagIntent =
    stockStatus === 'out_of_stock' ? Intent.DANGER :
    stockStatus === 'low_stock'    ? Intent.WARNING :
                                     Intent.SUCCESS

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0 bg-background">
        <div className="flex items-start gap-4">
          <Button
            icon="arrow-left"
            variant="minimal"
            size="small"
            onClick={() => { void navigate(-1) }}
          >
            Back
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-100 dark:bg-slate-900/40 shrink-0">
                <Icon icon="box" size={20} className="text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold leading-none">{product.name}</h1>
                  <Tag intent={stockTagIntent} minimal>
                    {stockStatus === 'out_of_stock' ? 'OUT OF STOCK' :
                     stockStatus === 'low_stock'    ? 'LOW STOCK' : 'IN STOCK'}
                  </Tag>
                  {!product.enabled && (
                    <Tag minimal>DISABLED</Tag>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="font-mono">{product.sku}</span>
                  {product.categories && (
                    <span className="flex items-center gap-1">
                      <Icon icon="tag" size={12} />
                      {product.categories.name}
                    </span>
                  )}
                  <span>{formatDistanceToNow(new Date(product.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-5xl">

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Stock</div>
            <div className={cn(
              'text-xl font-bold font-mono tabular-nums',
              totalStock === 0 ? 'text-red-600' : 'text-foreground',
            )}>{totalStock}</div>
            <div className="text-[10px] text-muted-foreground">across {variants.length} variant{variants.length !== 1 ? 's' : ''}</div>
          </Card>
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stock Value</div>
            <div className="text-xl font-bold font-mono tabular-nums">€{totalValue.toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground">@ €{(product.cost ?? 0).toFixed(2)} / unit</div>
          </Card>
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Attention</div>
            <div className={cn(
              'text-xl font-bold font-mono tabular-nums',
              criticalCount > 0 ? 'text-red-600' : lowCount > 0 ? 'text-amber-600' : 'text-emerald-600',
            )}>
              {criticalCount > 0 ? criticalCount : lowCount > 0 ? lowCount : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {criticalCount > 0 ? 'critical variant' + (criticalCount > 1 ? 's' : '') :
               lowCount > 0 ? 'low variant' + (lowCount > 1 ? 's' : '') : 'All variants OK'}
            </div>
          </Card>
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Variants</div>
            <div className="text-xl font-bold font-mono tabular-nums">{variants.length}</div>
            <div className="text-[10px] text-muted-foreground">
              {variants.filter((v) => v.enabled).length} enabled
            </div>
          </Card>
        </div>

        {/* Description */}
        {product.description && (
          <Card compact className="!bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Description</p>
            <p className="text-xs text-foreground leading-relaxed">{product.description}</p>
          </Card>
        )}

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
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
      </div>
    </div>
  )
}

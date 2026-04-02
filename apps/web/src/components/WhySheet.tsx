// Layer: Flow — Contextual graph traversal, surfaced inline on any decision surface.
// Palantir principle: every alert, restock, and waste signal should be traceable
// to its root cause in one click. This component makes the Reality Graph visible.

import { useState } from 'react'
import { GitBranch } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FlowGraph } from '@/features/graph/components/FlowGraph'
import { cn } from '@/lib/utils'

interface WhyButtonProps {
  variantId: string
  variantName: string
  currentStock?: number
  /** Button style variant — 'link' (inline text) or 'pill' (border pill) */
  variant?: 'link' | 'pill'
  className?: string
}

/**
 * Self-contained "Why?" trigger + Sheet.
 * Drop this next to any metric that has a causal history — the sheet opens
 * the Reality Graph flow for that variant, showing the full causal chain:
 * consumed → restocked → alert triggered → corrected.
 */
export function WhyButton({
  variantId,
  variantName,
  currentStock,
  variant = 'link',
  className,
}: WhyButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={cn(
          'inline-flex items-center gap-0.5 transition-colors',
          variant === 'link'
            ? 'text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline'
            : 'rounded border border-muted-foreground/20 bg-muted/40 px-1.5 py-px text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
          className,
        )}
        title="Trace causal history for this item"
      >
        <GitBranch className="h-2.5 w-2.5" />
        Why?
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-xl flex flex-col p-0 gap-0">
          <SheetHeader className="border-b px-5 py-4 flex-shrink-0">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              Causal history · {variantName}
            </SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every stock movement, restock, correction, and alert — in order.
            </p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <FlowGraph
              variantId={variantId}
              variantName={variantName}
              currentStock={currentStock}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

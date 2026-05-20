// "Why?" trigger + Drawer. Opens the variant's causal chain inline.

import { useState } from 'react'
import { Drawer, Icon } from '@blueprintjs/core'
import { FlowGraph } from '@/features/graph/components/FlowGraph'
import { cn } from '@/lib/utils'

interface WhyButtonProps {
  variantId: string
  variantName: string
  currentStock?: number
  /** 'link' (inline text) or 'pill' (bordered chip) */
  variant?: 'link' | 'pill'
  className?: string
}

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
        <Icon icon="git-branch" size={10} />
        Why?
      </button>

      <Drawer
        isOpen={open}
        onClose={() => { setOpen(false) }}
        position="right"
        size="36rem"
        title={
          <span className="flex items-center gap-2">
            <Icon icon="git-branch" size={14} className="text-muted-foreground" />
            Causal history · {variantName}
          </span>
        }
        className="!p-0"
      >
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-muted-foreground mb-3">
            Every stock movement, restock, correction, and alert — in order.
          </p>
          <FlowGraph
            variantId={variantId}
            variantName={variantName}
            currentStock={currentStock}
          />
        </div>
      </Drawer>
    </>
  )
}

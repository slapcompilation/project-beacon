// Resizable split pane: list on left, optional detail on right. Closes on Escape.

import { useCallback, useRef, useState, useEffect } from 'react'
import { Button } from '@blueprintjs/core'
import { cn } from '@/lib/utils'

interface MasterDetailLayoutProps {
  children: React.ReactNode
  detail?: React.ReactNode
  onCloseDetail?: () => void
  minMasterWidth?: number
  defaultDetailWidth?: number
  className?: string
}

export function MasterDetailLayout({
  children,
  detail,
  onCloseDetail,
  minMasterWidth = 360,
  defaultDetailWidth = 420,
  className,
}: MasterDetailLayoutProps) {
  const [detailWidth, setDetailWidth] = useState(defaultDetailWidth)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true

    const startX = e.clientX
    const startWidth = detailWidth

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX - ev.clientX
      const containerWidth = containerRef.current?.offsetWidth ?? 1200
      const maxDetail = containerWidth - minMasterWidth
      const newWidth = Math.max(280, Math.min(maxDetail, startWidth + delta))
      setDetailWidth(newWidth)
    }

    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [detailWidth, minMasterWidth])

  useEffect(() => {
    if (!detail) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseDetail?.()
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler) }
  }, [detail, onCloseDetail])

  const isOpen = !!detail

  return (
    <div ref={containerRef} className={cn('flex h-full overflow-hidden', className)}>
      <div
        className="flex-1 overflow-y-auto min-w-0"
        style={isOpen ? { minWidth: minMasterWidth } : undefined}
      >
        {children}
      </div>

      {isOpen && (
        <>
          <div
            className="hidden lg:flex w-1 flex-shrink-0 cursor-col-resize items-center justify-center bg-border/50 hover:bg-primary/30 transition-colors group"
            onMouseDown={handleMouseDown}
          >
            <div className="w-0.5 h-8 rounded-full bg-muted-foreground/30 group-hover:bg-primary/60 transition-colors" />
          </div>

          <div
            className={cn(
              'flex-shrink-0 overflow-y-auto border-l border-border bg-surface-1',
              'fixed inset-0 z-40 lg:relative lg:z-auto',
            )}
            style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? detailWidth : undefined }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Detail
              </span>
              <Button
                variant="minimal"
                size="small"
                icon="cross"
                onClick={onCloseDetail}
                aria-label="Close detail"
              />
            </div>
            {detail}
          </div>
        </>
      )}
    </div>
  )
}
